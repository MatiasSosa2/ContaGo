/**
 * Artículos con variantes: alta/edición (arma las variantes con todas las combinaciones),
 * foto, precio por variante y actualización masiva de precios.
 * Cada variante es un Producto: stock, costo promedio, movimientos y ventas siguen igual.
 */

import prisma from '@/lib/prisma'
import { revalidatePath, revalidateTag, updateTag } from 'next/cache'
import type { ActionResult } from '@/lib/validations'
import { getBusinessId } from './shared'
import {
  claveVariante, combinaciones, nombreVariante, normalizarAtributos, parseValores,
  type AtributoDef, type ValoresVariante,
} from '@/lib/variantes'

export type ArticuloInput = {
  /** Editando un artículo existente */
  articuloId?: string | null
  /** Editando un producto suelto (sin artículo todavía) */
  productoId?: string | null
  nombre: string
  tipo: 'MERCADERIA' | 'SERVICIO'
  categoria: string
  subcategoria: string
  marca: string
  unidad: string
  /** Precio base del artículo */
  precioVenta: number
  atributos: AtributoDef[]
  /** Precio propio por variante (clave de claveVariante); null o ausente = sigue el precio base */
  precios: Record<string, number | null>
  /** Foto nueva (data URL ya achicada); null = sacarla; undefined = no tocar */
  foto?: string | null
}

const limpio = (s: string | null | undefined, max: number) => (s ?? '').trim().slice(0, max)
const FOTO_MAX = 400_000

function revalidar(businessId: string) {
  revalidateTag(`dashboard:${businessId}`, 'max')
  revalidatePath('/stock')
  updateTag(`catalogs:${businessId}`)
}

function validarFoto(foto: string | null | undefined): string | null {
  if (foto == null) return null
  if (!/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(foto)) return 'La foto no es válida'
  if (foto.length > FOTO_MAX) return 'La foto es muy pesada'
  return null
}

/** Crea o edita un artículo y deja sus variantes en línea con las combinaciones de atributos */
export async function guardarArticulo(input: ArticuloInput): Promise<ActionResult<{ articuloId: string }>> {
  const nombre = limpio(input.nombre, 100)
  if (!nombre) return { success: false, error: 'El nombre es obligatorio' }
  const precioBase = Number.isFinite(input.precioVenta) && input.precioVenta >= 0 ? input.precioVenta : 0
  const errorFoto = validarFoto(input.foto)
  if (errorFoto) return { success: false, error: errorFoto }
  const atributos = normalizarAtributos(input.atributos ?? [])
  const combos = combinaciones(atributos)
  if (combos.length > 200) return { success: false, error: 'Son demasiadas variantes (máximo 200)' }

  const businessId = await getBusinessId()
  const datos = {
    nombre,
    tipo: input.tipo === 'SERVICIO' ? 'SERVICIO' : 'MERCADERIA',
    categoria: limpio(input.categoria, 80) || null,
    subcategoria: limpio(input.subcategoria, 80) || null,
    marca: limpio(input.marca, 80) || null,
    unidad: limpio(input.unidad, 30) || 'unidad',
    precioVenta: precioBase,
    atributos: atributos.length > 0 ? JSON.stringify(atributos) : null,
    ...(input.foto !== undefined ? { foto: input.foto, fotoAt: input.foto ? new Date() : null } : {}),
  }

  // Artículo existente, o uno nuevo (también al editar un producto suelto por primera vez)
  let articuloId = input.articuloId ?? null
  if (articuloId) {
    const res = await prisma.articulo.updateMany({ where: { id: articuloId, businessId }, data: datos })
    if (res.count === 0) return { success: false, error: 'El artículo no existe' }
  } else {
    if (input.productoId) {
      const suelto = await prisma.producto.findFirst({ where: { id: input.productoId, businessId }, select: { id: true } })
      if (!suelto) return { success: false, error: 'El producto no existe' }
    }
    const creado = await prisma.articulo.create({ data: { ...datos, businessId }, select: { id: true } })
    articuloId = creado.id
    if (input.productoId) await prisma.producto.update({ where: { id: input.productoId }, data: { articuloId } })
  }

  const actuales = await prisma.producto.findMany({
    where: { articuloId, businessId },
    select: { id: true, atributos: true, activo: true },
    orderBy: { createdAt: 'asc' },
  })
  const porClave = new Map(actuales.map((p) => [claveVariante(parseValores(p.atributos)), p]))
  const deseadas: (ValoresVariante | null)[] = combos.length > 0 ? combos : [null]
  const usados = new Set<string>()

  const comun = {
    tipo: datos.tipo, categoria: datos.categoria, marca: datos.marca, unidad: datos.unidad,
  }
  const ops = []
  for (const v of deseadas) {
    const clave = claveVariante(v)
    const propio = input.precios?.[clave]
    const precio = typeof propio === 'number' && Number.isFinite(propio) && propio >= 0 ? propio : null
    let existente = porClave.get(clave)
    // Un producto que no tenía variantes queda como la primera (conserva stock e historial)
    if (!existente && actuales.length === 1 && !actuales[0].atributos && !usados.has(actuales[0].id)) existente = actuales[0]
    const data = {
      ...comun,
      nombre: nombreVariante(nombre, v, atributos),
      atributos: v ? JSON.stringify(v) : null,
      precioPropio: precio !== null,
      precioVenta: precio ?? precioBase,
      activo: true,
    }
    if (existente && !usados.has(existente.id)) {
      usados.add(existente.id)
      ops.push(prisma.producto.update({ where: { id: existente.id }, data }))
    } else {
      ops.push(prisma.producto.create({ data: { ...data, articuloId, businessId, metodoCosteo: 'PROMEDIO' } }))
    }
  }
  // Las que ya no están: se archivan (no se borran, para no perder ventas ni movimientos)
  const sobran = actuales.filter((p) => !usados.has(p.id) && p.activo).map((p) => p.id)
  if (sobran.length > 0) ops.push(prisma.producto.updateMany({ where: { id: { in: sobran } }, data: { activo: false } }))
  await prisma.$transaction(ops)

  revalidar(businessId)
  return { success: true, data: { articuloId } }
}

/** Cambia (o saca) la foto. Si el producto es suelto, le crea su artículo. */
export async function guardarFotoArticulo(ref: { articuloId?: string | null; productoId?: string | null }, foto: string | null): Promise<ActionResult<{ articuloId: string }>> {
  const errorFoto = validarFoto(foto)
  if (errorFoto) return { success: false, error: errorFoto }
  const businessId = await getBusinessId()
  let articuloId = ref.articuloId ?? null
  if (!articuloId && ref.productoId) {
    const p = await prisma.producto.findFirst({ where: { id: ref.productoId, businessId } })
    if (!p) return { success: false, error: 'El producto no existe' }
    const creado = await prisma.articulo.create({
      data: {
        nombre: p.nombre, tipo: p.tipo, categoria: p.categoria, marca: p.marca, unidad: p.unidad,
        precioVenta: p.precioVenta, businessId,
      },
      select: { id: true },
    })
    articuloId = creado.id
    await prisma.producto.update({ where: { id: p.id }, data: { articuloId } })
  }
  if (!articuloId) return { success: false, error: 'Falta el artículo' }
  const res = await prisma.articulo.updateMany({ where: { id: articuloId, businessId }, data: { foto, fotoAt: foto ? new Date() : null } })
  if (res.count === 0) return { success: false, error: 'El artículo no existe' }
  revalidar(businessId)
  return { success: true, data: { articuloId } }
}

/** Foto para /api/foto/[id] (solo del negocio activo) */
export async function getFotoArticulo(articuloId: string) {
  const businessId = await getBusinessId()
  const a = await prisma.articulo.findFirst({ where: { id: articuloId, businessId }, select: { foto: true } })
  return a?.foto ?? null
}

/** Precio rápido de una variante desde la ficha. null = vuelve al precio del artículo. */
export async function actualizarPrecioVariante(productoId: string, precio: number | null): Promise<ActionResult> {
  if (precio !== null && (!Number.isFinite(precio) || precio < 0)) return { success: false, error: 'Precio inválido' }
  const businessId = await getBusinessId()
  const p = await prisma.producto.findFirst({
    where: { id: productoId, businessId },
    select: { id: true, articulo: { select: { id: true, precioVenta: true, productos: { where: { activo: true }, select: { id: true } } } } },
  })
  if (!p) return { success: false, error: 'El producto no existe' }
  const art = p.articulo
  // Sin artículo o con una sola variante: el precio es el del artículo
  if (!art || art.productos.length <= 1) {
    if (precio === null) return { success: true }
    await prisma.producto.update({ where: { id: p.id }, data: { precioVenta: precio, precioPropio: false } })
    if (art) await prisma.articulo.update({ where: { id: art.id }, data: { precioVenta: precio } })
  } else {
    await prisma.producto.update({
      where: { id: p.id },
      data: precio === null || precio === art.precioVenta
        ? { precioVenta: art.precioVenta, precioPropio: false }
        : { precioVenta: precio, precioPropio: true },
    })
  }
  revalidar(businessId)
  return { success: true }
}

export type PreciosMasivoInput = {
  /** Vacío = todos */
  categoria?: string | null
  marca?: string | null
  /** +10 = sube 10 %, −5 = baja 5 % */
  porcentaje: number
  /** Redondeo del precio nuevo: 1, 10, 100 */
  redondeo: 1 | 10 | 100
}

/** Sube o baja un % los precios (artículos y variantes con precio propio) de una categoría o marca */
export async function actualizarPreciosMasivo(input: PreciosMasivoInput): Promise<ActionResult<{ cambiados: number }>> {
  const pct = Number(input.porcentaje)
  if (!Number.isFinite(pct) || pct === 0 || pct <= -100 || pct > 1000) return { success: false, error: 'Ingresá un porcentaje válido' }
  const paso = [1, 10, 100].includes(input.redondeo) ? input.redondeo : 1
  const nuevo = (precio: number) => Math.max(0, Math.round((precio * (1 + pct / 100)) / paso) * paso)
  const businessId = await getBusinessId()
  const where = {
    businessId,
    activo: true,
    ...(input.categoria ? { categoria: input.categoria } : {}),
    ...(input.marca ? { marca: input.marca } : {}),
  }
  const productos = await prisma.producto.findMany({ where, select: { id: true, precioVenta: true, precioPropio: true, articuloId: true } })
  const articuloIds = Array.from(new Set(productos.map((p) => p.articuloId).filter((x): x is string => !!x)))
  const articulos = await prisma.articulo.findMany({ where: { id: { in: articuloIds }, businessId }, select: { id: true, precioVenta: true } })
  const baseNueva = new Map(articulos.map((a) => [a.id, nuevo(a.precioVenta)]))

  const ops = [
    ...articulos.map((a) => prisma.articulo.update({ where: { id: a.id }, data: { precioVenta: baseNueva.get(a.id)! } })),
    ...productos.map((p) => prisma.producto.update({
      where: { id: p.id },
      data: { precioVenta: !p.precioPropio && p.articuloId && baseNueva.has(p.articuloId) ? baseNueva.get(p.articuloId)! : nuevo(p.precioVenta) },
    })),
  ]
  await prisma.$transaction(ops)
  revalidar(businessId)
  return { success: true, data: { cambiados: productos.length } }
}

/** Archiva el artículo y todas sus variantes (no se borran ventas ni movimientos) */
export async function deleteArticulo(articuloId: string) {
  const businessId = await getBusinessId()
  await prisma.$transaction([
    prisma.articulo.updateMany({ where: { id: articuloId, businessId }, data: { activo: false } }),
    prisma.producto.updateMany({ where: { articuloId, businessId }, data: { activo: false } }),
  ])
  revalidar(businessId)
}

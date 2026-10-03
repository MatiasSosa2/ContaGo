/**
 * Inventario y bienes de uso: productos, movimientos de stock y bienes.
 * Las expone src/app/actions.ts (que elige entre datos reales y demo).
 */

import prisma from '@/lib/prisma'
import { revalidatePath, revalidateTag, updateTag } from 'next/cache'
import { createProductoSchema, type ActionResult } from '@/lib/validations'
import { getBusinessId, type DashboardPeriodKey, computePeriodRange } from './shared'

export async function getProductos(
  period?: DashboardPeriodKey,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
  selectedDay?: string,
  selectedWeekStart?: string,
) {
  const businessId = await getBusinessId()
  const productos = await prisma.producto.findMany({
    where: { businessId, activo: true },
    orderBy: { nombre: 'asc' },
    // Artículo al que pertenece la variante (la foto se pide aparte, por /api/foto)
    include: { articulo: { select: { id: true, nombre: true, subcategoria: true, atributos: true, precioVenta: true, fotoAt: true } } },
  })

  if (!period) {
    return productos.map(p => ({
      ...p,
      stockInicialPeriodo: 0,
      entradasPeriodo: 0,
      salidasPeriodo: 0,
      cmvPeriodo: 0,
      valorInicialPeriodo: 0,
      valorCompradoPeriodo: 0,
      valorFinalPeriodo: 0,
    }))
  }

  // Stock asof "to": revertir movimientos posteriores a "to"
  const { from, to } = computePeriodRange(period, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart)
  const movsPosteriores = await prisma.movimientoStock.findMany({
    where: { producto: { businessId }, fecha: { gt: to } },
    select: { productoId: true, tipo: true, cantidad: true },
  })
  const delta: Record<string, number> = {}
  for (const m of movsPosteriores) {
    const signed = m.tipo === 'ENTRADA' ? m.cantidad : m.tipo === 'SALIDA' ? -m.cantidad : m.cantidad
    delta[m.productoId] = (delta[m.productoId] || 0) + signed
  }

  // Movimientos hasta el cierre del período, en orden: se "reproducen" para saber
  // unidades y valor (al costo promedio ponderado de cada momento) al inicio y al cierre.
  // Así Inicial + Comprado − Vendido = Final, siempre, y valorizado a lo que realmente costó.
  const movs = await prisma.movimientoStock.findMany({
    where: { producto: { businessId }, fecha: { lte: to } },
    orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
    select: { productoId: true, tipo: true, cantidad: true, precio: true, costoUnitario: true, fecha: true },
  })
  type Flujo = { stock: number; valor: number; valorInicial: number; entradas: number; salidas: number; ajuste: number; comprado: number; cmv: number; abierto: boolean }
  const costoActual = Object.fromEntries(productos.map((p) => [p.id, p.precioCosto ?? 0]))
  const flujo: Record<string, Flujo> = {}
  const cerrarInicio = (f: Flujo) => { if (!f.abierto) { f.valorInicial = f.valor; f.abierto = true } }
  for (const m of movs) {
    const f = (flujo[m.productoId] ??= { stock: 0, valor: 0, valorInicial: 0, entradas: 0, salidas: 0, ajuste: 0, comprado: 0, cmv: 0, abierto: false })
    const enPeriodo = m.fecha >= from
    if (enPeriodo) cerrarInicio(f)
    const cpp = f.stock > 0 ? f.valor / f.stock : costoActual[m.productoId] ?? 0
    if (m.tipo === 'ENTRADA') {
      const costo = m.precio > 0 ? m.precio : cpp
      f.stock += m.cantidad
      f.valor += m.cantidad * costo
      if (enPeriodo) { f.entradas += m.cantidad; f.comprado += m.cantidad * costo }
    } else if (m.tipo === 'SALIDA') {
      // CMV: cada salida a su CPP del momento (salidas viejas sin costo guardado: el del momento)
      const costo = m.costoUnitario ?? cpp
      f.stock -= m.cantidad
      f.valor -= m.cantidad * costo
      if (enPeriodo) { f.salidas += m.cantidad; f.cmv += m.cantidad * costo }
    } else {
      // Ajuste: la cantidad es el stock resultante
      const antes = f.stock
      f.stock = m.cantidad
      f.valor = m.cantidad * cpp
      if (enPeriodo) f.ajuste += m.cantidad - antes
    }
  }

  return productos.map(p => {
    const f = flujo[p.id]
    if (f) cerrarInicio(f)
    const stockFinal = (p.stockActual ?? 0) - (delta[p.id] || 0)
    const ent = f?.entradas ?? 0
    const sal = f?.salidas ?? 0
    const aj = f?.ajuste ?? 0
    const stockInicial = stockFinal - ent + sal - aj
    return {
      ...p,
      stockActual: stockFinal,
      stockInicialPeriodo: stockInicial,
      entradasPeriodo: ent,
      salidasPeriodo: sal,
      cmvPeriodo: f?.cmv ?? 0,
      valorInicialPeriodo: f?.valorInicial ?? 0,
      valorCompradoPeriodo: f?.comprado ?? 0,
      valorFinalPeriodo: f?.valor ?? 0,
    }
  })
}

export async function createProducto(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const alertaRaw = formData.get('alertaStock') as string | null
  const alertaStockParsed = alertaRaw && alertaRaw.trim() !== '' ? parseFloat(alertaRaw) : null
  const imagenRaw = (formData.get('imagenUrl') as string | null)?.trim() || ''
  const raw = {
    nombre: (formData.get('nombre') as string)?.trim(),
    descripcion: (formData.get('descripcion') as string)?.trim(),
    imagenUrl: imagenRaw,
    tipo: ((formData.get('tipo') as string) || 'MERCADERIA') as 'MERCADERIA' | 'SERVICIO',
    categoria: (formData.get('categoria') as string)?.trim(),
    marca: (formData.get('marca') as string)?.trim(),
    unidad: (formData.get('unidad') as string)?.trim() || 'unidad',
    metodoCosteo: (formData.get('metodoCosteo') as string) || 'PROMEDIO',
    precioVenta: parseFloat(formData.get('precioVenta') as string) || 0,
    // Costo, stock inicial y en tránsito arrancan siempre en 0: se calculan vía movimientos.
    precioCosto: 0,
    stockActual: 0,
    enTransito: 0,
    alertaStock: alertaStockParsed !== null && !Number.isNaN(alertaStockParsed) ? alertaStockParsed : null,
  }

  const parsed = createProductoSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const businessId = await getBusinessId()

  const creado = await prisma.producto.create({ data: {
    ...parsed.data,
    descripcion: parsed.data.descripcion || null,
    imagenUrl: parsed.data.imagenUrl || null,
    categoria: parsed.data.categoria || null,
    marca: parsed.data.marca || null,
    businessId,
  }, select: { id: true } })
  revalidateTag(`dashboard:${businessId}`, 'max')
  revalidatePath('/stock')
  // Los catálogos del formulario de registración también lo tienen que ver
  updateTag(`catalogs:${businessId}`)
  return { success: true, data: { id: creado.id } }
}

export async function updateProducto(id: string, formData: FormData): Promise<ActionResult> {
  const businessId = await getBusinessId()

  // Preservar campos calculados desde DB (no se editan por form)
  const existente = await prisma.producto.findFirst({
    where: { id, businessId },
    select: { precioCosto: true, stockActual: true, enTransito: true },
  })
  if (!existente) {
    return { success: false, error: 'El producto no existe o no pertenece al negocio activo' }
  }

  const alertaRaw = formData.get('alertaStock') as string | null
  const alertaStockParsed = alertaRaw && alertaRaw.trim() !== '' ? parseFloat(alertaRaw) : null
  const imagenRaw = (formData.get('imagenUrl') as string | null)?.trim() || ''
  const raw = {
    nombre: (formData.get('nombre') as string)?.trim(),
    descripcion: (formData.get('descripcion') as string)?.trim(),
    imagenUrl: imagenRaw,
    tipo: ((formData.get('tipo') as string) || 'MERCADERIA') as 'MERCADERIA' | 'SERVICIO',
    categoria: (formData.get('categoria') as string)?.trim(),
    marca: (formData.get('marca') as string)?.trim(),
    unidad: (formData.get('unidad') as string)?.trim() || 'unidad',
    metodoCosteo: (formData.get('metodoCosteo') as string) || 'PROMEDIO',
    precioVenta: parseFloat(formData.get('precioVenta') as string) || 0,
    // Preservados desde DB (no editables por form)
    precioCosto: existente.precioCosto,
    stockActual: existente.stockActual,
    enTransito: existente.enTransito,
    alertaStock: alertaStockParsed !== null && !Number.isNaN(alertaStockParsed) ? alertaStockParsed : null,
  }

  const parsed = createProductoSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const result = await prisma.producto.updateMany({ where: { id, businessId }, data: {
    ...parsed.data,
    descripcion: parsed.data.descripcion || null,
    imagenUrl: parsed.data.imagenUrl || null,
    categoria: parsed.data.categoria || null,
    marca: parsed.data.marca || null,
  }})

  if (result.count === 0) {
    return { success: false, error: 'El producto no existe o no pertenece al negocio activo' }
  }

  revalidateTag(`dashboard:${businessId}`, 'max')
  revalidatePath('/stock')
  return { success: true }
}

export async function deleteProducto(id: string) {
  const businessId = await getBusinessId()
  await prisma.producto.updateMany({ where: { id, businessId }, data: { activo: false } })
  revalidateTag(`dashboard:${businessId}`, 'max')
  revalidatePath('/stock')
}

// ---- Stock: Movimientos ----

export async function getMovimientosStock(productoId: string | string[]) {
  const businessId = await getBusinessId()
  return await prisma.movimientoStock.findMany({
    where: {
      // Una variante o todas las de un artículo
      productoId: Array.isArray(productoId) ? { in: productoId } : productoId,
      producto: { businessId },
    },
    orderBy: { fecha: 'desc' },
    take: 1000,
  })
}

/**
 * Ajuste de stock desde la ficha (conteo, rotura, pérdida): se carga el stock contado y se
 * registra solo la diferencia como entrada o salida al costo promedio, así Inventario,
 * CMV y Balance lo toman igual que cualquier otro movimiento.
 */
export async function ajustarStock(productoId: string, contado: number, motivo: string): Promise<ActionResult> {
  if (!Number.isFinite(contado) || contado < 0) return { success: false, error: 'Ingresá el stock contado' }
  const businessId = await getBusinessId()
  const producto = await prisma.producto.findFirst({
    where: { id: productoId, businessId },
    select: { id: true, stockActual: true, precioCosto: true },
  })
  if (!producto) return { success: false, error: 'Producto no encontrado' }
  const diferencia = Math.round((contado - producto.stockActual) * 100) / 100
  if (Math.abs(diferencia) < 0.001) return { success: false, error: 'El stock contado es igual al actual' }

  const entra = diferencia > 0
  await prisma.$transaction([
    prisma.movimientoStock.create({
      data: {
        productoId,
        tipo: entra ? 'ENTRADA' : 'SALIDA',
        cantidad: Math.abs(diferencia),
        precio: entra ? producto.precioCosto : 0,
        // La salida por ajuste (merma, rotura) va al costo de lo vendido con el CPP actual
        costoUnitario: entra ? null : producto.precioCosto,
        motivo: `Ajuste de stock${motivo.trim() ? `: ${motivo.trim().slice(0, 150)}` : ''}`,
        fecha: new Date(),
      },
    }),
    prisma.producto.update({ where: { id: productoId }, data: { stockActual: contado } }),
  ])
  revalidateTag(`dashboard:${businessId}`, 'max')
  revalidatePath('/stock')
  return { success: true }
}

// ---- Reportes: datos extendidos ----

export async function getBienesDeUso(
  activosOnly = true,
  period?: DashboardPeriodKey,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
  selectedDay?: string,
  selectedWeekStart?: string,
) {
  const businessId = await getBusinessId()
  const dateFilter = period
    ? (() => {
        const { to } = computePeriodRange(period, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart)
        return { fechaAdquisicion: { lte: to } }
      })()
    : {}
  return prisma.bienDeUso.findMany({
    where: { businessId, ...(activosOnly ? { activo: true } : {}), ...dateFilter },
    orderBy: { nombre: 'asc' },
  })
}


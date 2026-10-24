/**
 * Inventario y bienes de uso: productos, movimientos de stock y bienes.
 * Las expone src/app/actions.ts (que elige entre datos reales y demo).
 */

import prisma from '@/lib/prisma'
import { revalidatePath, revalidateTag, updateTag } from 'next/cache'
import { createProductoSchema, createMovimientoStockSchema, type ActionResult } from '@/lib/validations'
import { getBusinessId, parseMovementDate, type DashboardPeriodKey, computePeriodRange } from './shared'
import {
  aplicarMovimiento, costoEfectivo, deltaUnidades, DIF_INVENTARIO, REVALUACION, type EstadoStock,
} from '@/lib/stock-costos'

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
      stockHoy: p.stockActual ?? 0,
      diferenciaUnidadesPeriodo: 0,
      diferenciaValorPeriodo: 0,
      revaluacionPeriodo: 0,
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
    // Ajustes viejos (tipo AJUSTE) se contaban como entrada; las revaluaciones no mueven unidades
    const signed = m.tipo === 'AJUSTE' ? m.cantidad : deltaUnidades(m)
    delta[m.productoId] = (delta[m.productoId] || 0) + signed
  }

  // Movimientos hasta el cierre del período, en orden: se "reproducen" para saber unidades
  // y valor (al costo de cada momento: promedio o fijo) al inicio y al cierre.
  // Inicial + Comprado − Vendido ± Diferencias ± Cambios de costo = Final.
  const movs = await prisma.movimientoStock.findMany({
    where: { producto: { businessId }, fecha: { lte: to } },
    orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
    select: { productoId: true, tipo: true, concepto: true, cantidad: true, precio: true, costoUnitario: true, fecha: true },
  })
  type Flujo = EstadoStock & {
    valorInicial: number; entradas: number; salidas: number; ajuste: number; comprado: number; cmv: number
    difU: number; dif$: number; reval$: number; abierto: boolean
  }
  const costoActual = Object.fromEntries(productos.map((p) => [p.id, costoEfectivo(p)]))
  const flujo: Record<string, Flujo> = {}
  const cerrarInicio = (f: Flujo) => { if (!f.abierto) { f.valorInicial = f.valor; f.abierto = true } }
  for (const m of movs) {
    const f = (flujo[m.productoId] ??= {
      stock: 0, valor: 0, valorInicial: 0, entradas: 0, salidas: 0, ajuste: 0, comprado: 0, cmv: 0,
      difU: 0, dif$: 0, reval$: 0, abierto: false,
    })
    const enPeriodo = m.fecha >= from
    if (enPeriodo) cerrarInicio(f)
    const ef = aplicarMovimiento(f, m, costoActual[m.productoId] ?? 0)
    if (!enPeriodo) continue
    f.entradas += ef.compraU; f.comprado += ef.compra$
    f.salidas += ef.ventaU; f.cmv += ef.venta$
    f.difU += ef.difU; f.dif$ += ef.dif$
    f.reval$ += ef.reval$; f.ajuste += ef.ajusteU
  }

  return productos.map(p => {
    const f = flujo[p.id]
    if (f) cerrarInicio(f)
    const stockFinal = (p.stockActual ?? 0) - (delta[p.id] || 0)
    const ent = f?.entradas ?? 0
    const sal = f?.salidas ?? 0
    const aj = f?.ajuste ?? 0
    const difU = f?.difU ?? 0
    const stockInicial = stockFinal - ent + sal - difU - aj
    return {
      ...p,
      stockActual: stockFinal,
      // Stock de hoy (para corregirlo desde la ficha aunque se mire un período pasado)
      stockHoy: p.stockActual ?? 0,
      stockInicialPeriodo: stockInicial,
      entradasPeriodo: ent,
      salidasPeriodo: sal,
      cmvPeriodo: f?.cmv ?? 0,
      valorInicialPeriodo: f?.valorInicial ?? 0,
      valorCompradoPeriodo: f?.comprado ?? 0,
      valorFinalPeriodo: f?.valor ?? 0,
      // Sobrantes/faltantes cargados a mano y cambios de costo del período
      diferenciaUnidadesPeriodo: difU,
      diferenciaValorPeriodo: f?.dif$ ?? 0,
      revaluacionPeriodo: f?.reval$ ?? 0,
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

  const businessId = await getBusinessId(true)

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
  const businessId = await getBusinessId(true)

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
  const businessId = await getBusinessId(true)
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
 * Diferencia de inventario desde la ficha (conteo, rotura, robo, vencido…): se carga el stock
 * nuevo y se registra la diferencia como sobrante (ganancia) o faltante (pérdida), valorizada
 * al costo unitario de hoy. No mueve la caja ni va al costo de lo vendido.
 * La fecha (yyyy-mm-dd, hoy por defecto) define en qué período cae el resultado.
 */
export async function ajustarStock(productoId: string, contado: number, motivo: string, fecha?: string): Promise<ActionResult> {
  if (!Number.isFinite(contado) || contado < 0) return { success: false, error: 'Ingresá el stock nuevo' }
  const cuando = parseMovementDate(fecha)
  if (Number.isNaN(cuando.getTime())) return { success: false, error: 'Fecha inválida' }
  if (cuando.getTime() > Date.now() + 60_000) return { success: false, error: 'La fecha no puede ser futura' }
  const businessId = await getBusinessId(true)
  const producto = await prisma.producto.findFirst({
    where: { id: productoId, businessId },
    select: { id: true, stockActual: true, precioCosto: true, costoFijo: true },
  })
  if (!producto) return { success: false, error: 'Producto no encontrado' }
  const diferencia = Math.round((contado - producto.stockActual) * 100) / 100
  if (Math.abs(diferencia) < 0.001) return { success: false, error: 'El stock nuevo es igual al actual' }

  const entra = diferencia > 0
  const costo = costoEfectivo(producto)
  const detalle = motivo.trim().slice(0, 150)
  await prisma.$transaction([
    prisma.movimientoStock.create({
      data: {
        productoId,
        tipo: entra ? 'ENTRADA' : 'SALIDA',
        concepto: DIF_INVENTARIO,
        cantidad: Math.abs(diferencia),
        precio: costo,
        costoUnitario: costo,
        motivo: `${entra ? 'Sobrante' : 'Faltante'} de inventario${detalle ? `: ${detalle}` : ''}`,
        fecha: cuando,
      },
    }),
    prisma.producto.update({ where: { id: productoId }, data: { stockActual: contado } }),
  ])
  revalidateTag(`dashboard:${businessId}`, 'max')
  revalidatePath('/stock')
  return { success: true }
}

/**
 * Costo unitario fijo (o volver al promedio con null). Vale desde ahora: el stock que hay se
 * valoriza al costo nuevo (sin resultado) y las ventas de ahora en más salen a ese costo.
 * Lo anterior no cambia. Queda un movimiento REVALUACION como historial.
 */
export async function fijarCostoUnitario(productoId: string, costo: number | null): Promise<ActionResult> {
  if (costo !== null && (!Number.isFinite(costo) || costo < 0)) return { success: false, error: 'Ingresá un costo válido' }
  const businessId = await getBusinessId(true)
  const producto = await prisma.producto.findFirst({
    where: { id: productoId, businessId },
    select: { id: true, precioCosto: true, costoFijo: true },
  })
  if (!producto) return { success: false, error: 'Producto no encontrado' }
  const nuevo = costo === null ? null : Math.round(costo * 100) / 100
  if (nuevo === producto.costoFijo) return { success: true }
  const costoNuevo = nuevo ?? producto.precioCosto ?? 0
  await prisma.$transaction([
    prisma.movimientoStock.create({
      data: {
        productoId,
        tipo: REVALUACION,
        cantidad: 0,
        precio: costoNuevo,
        costoUnitario: costoNuevo,
        motivo: nuevo === null ? 'Vuelve al costo promedio' : 'Costo unitario fijo',
        fecha: new Date(),
      },
    }),
    prisma.producto.update({ where: { id: productoId }, data: { costoFijo: nuevo } }),
  ])
  revalidateTag(`dashboard:${businessId}`, 'max')
  revalidatePath('/stock')
  return { success: true }
}

/** Cambia la unidad de medida (solo el nombre: el número de stock queda igual) */
export async function cambiarUnidad(ref: { articuloId?: string | null; productoId?: string | null }, unidad: string): Promise<ActionResult> {
  const u = unidad.trim().slice(0, 30)
  if (!u) return { success: false, error: 'Elegí una unidad' }
  const businessId = await getBusinessId(true)
  if (ref.articuloId) {
    await prisma.$transaction([
      prisma.articulo.updateMany({ where: { id: ref.articuloId, businessId }, data: { unidad: u } }),
      prisma.producto.updateMany({ where: { articuloId: ref.articuloId, businessId }, data: { unidad: u } }),
    ])
  } else if (ref.productoId) {
    await prisma.producto.updateMany({ where: { id: ref.productoId, businessId }, data: { unidad: u } })
  } else {
    return { success: false, error: 'Falta el producto' }
  }
  revalidateTag(`dashboard:${businessId}`, 'max')
  revalidatePath('/stock')
  updateTag(`catalogs:${businessId}`)
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



export async function deleteBienDeUso(id: string): Promise<ActionResult> {
  const businessId = await getBusinessId(true)
  await prisma.bienDeUso.updateMany({
    where: { id, businessId },
    data: { activo: false },
  })
  revalidatePath('/bienes-de-uso')
  return { success: true }
}


export async function createBienDeUso(formData: FormData): Promise<ActionResult> {
  const { createBienDeUsoSchema } = await import('@/lib/validations')
  const raw = {
    nombre: (formData.get('nombre') as string)?.trim(),
    descripcion: (formData.get('descripcion') as string)?.trim(),
    categoria: (formData.get('categoria') as string)?.trim(),
    marca: (formData.get('marca') as string)?.trim(),
    valorAdquisicion: parseFloat(formData.get('valorAdquisicion') as string) || 0,
    valorResidual: parseFloat(formData.get('valorResidual') as string) || 0,
    fechaAdquisicion: (formData.get('fechaAdquisicion') as string) || undefined,
    vidaUtilMeses: formData.get('vidaUtilMeses') ? parseInt(formData.get('vidaUtilMeses') as string, 10) : undefined,
  }
  const parsed = createBienDeUsoSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }
  const businessId = await getBusinessId(true)
  const data = parsed.data
  await prisma.bienDeUso.create({
    data: {
      nombre: data.nombre,
      descripcion: data.descripcion || null,
      categoria: data.categoria || null,
      marca: data.marca || null,
      valorAdquisicion: data.valorAdquisicion,
      valorResidual: data.valorResidual,
      fechaAdquisicion: data.fechaAdquisicion ? new Date(data.fechaAdquisicion) : new Date(),
      vidaUtilMeses: data.vidaUtilMeses ?? null,
      businessId,
    },
  })
  revalidatePath('/bienes-de-uso')
  revalidatePath('/')
  return { success: true }
}


export async function addMovimientoStock(formData: FormData): Promise<ActionResult> {
  const businessId = await getBusinessId(true)
  const raw = {
    productoId: formData.get('productoId') as string,
    tipo: formData.get('tipo') as string,
    cantidad: parseFloat(formData.get('cantidad') as string),
    precio: parseFloat(formData.get('precio') as string) || 0,
    motivo: (formData.get('motivo') as string)?.trim(),
    fecha: formData.get('fecha') as string,
  }

  const parsed = createMovimientoStockSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const { productoId, tipo, cantidad, precio, motivo, fecha: fechaStr } = parsed.data
  const fecha = parseMovementDate(fechaStr)
  const result = await prisma.$transaction(async (tx) => {
    const producto = await tx.producto.findFirst({
      where: { id: productoId, businessId },
      select: { id: true, nombre: true, stockActual: true, precioCosto: true },
    })
    if (!producto) return { success: false as const, error: 'El producto no existe o no pertenece al negocio activo' }
    if (tipo === 'SALIDA' && cantidad > producto.stockActual) {
      return { success: false as const, error: `No hay stock suficiente de ${producto.nombre}` }
    }

    const updated = await tx.producto.updateMany({
      where: {
        id: productoId,
        businessId,
        ...(tipo === 'SALIDA' ? { stockActual: { gte: cantidad } } : {}),
      },
      data: {
        stockActual: tipo === 'ENTRADA'
          ? { increment: cantidad }
          : tipo === 'SALIDA'
            ? { decrement: cantidad }
            : cantidad,
      },
    })
    if (updated.count === 0) {
      return { success: false as const, error: 'El producto cambió durante el ajuste. Volvé a intentarlo.' }
    }

    await tx.movimientoStock.create({
      data: {
        productoId, tipo, cantidad, precio, motivo: motivo || null, fecha,
        costoUnitario: tipo === 'SALIDA' ? producto.precioCosto : null,
      },
    })
    return { success: true as const }
  })
  if (!result.success) return result

  revalidatePath('/stock')
  return { success: true }
}

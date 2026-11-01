/**
 * income-statement.ts
 *
 * Datos del Estado de resultados (criterio devengado):
 * - Ventas: ventas de productos del período, cobradas o no.
 * - CMV: unidades que salieron del inventario × su costo promedio ponderado (CPP) del
 *   momento de la salida. Es el mismo número que "Inventario vendido" en Inventario.
 * - Otros ingresos: el resto de los ingresos registrados (sobrantes de caja, categorías
 *   propias...), cobrados o no. NO los cobros de crédito (la venta ya contó cuando se
 *   registró; el cobro solo mueve la caja).
 * - Venta de bien de uso: solo su resultado = precio de venta − valor de libros (ganancia en
 *   otros ingresos, pérdida en gastos). El precio cobrado se ve en el Flujo de efectivo.
 * - Diferencia de inventario: sobrantes (otros ingresos) y faltantes (gastos) cargados a mano,
 *   al costo del momento. No van al CMV.
 * - Diferencia de costo: con costo unitario fijo, lo que se pagó de más (gasto) o de menos
 *   (otro ingreso) en cada compra respecto del costo fijo.
 * - Gastos: todos los egresos registrados, pagados o no (incluye faltantes de caja). NO las
 *   compras de mercadería (se reconocen como CMV al vender), NI las compras de bienes de uso
 *   (son un activo: impactan en la caja y en el Estado patrimonial), ni los pagos de deuda
 *   (el gasto ya contó cuando se registró).
 * Los cobros/pagos y las compras de mercadería se ven en el Flujo de efectivo.
 */

import prisma from '@/lib/prisma'
import { aplicarMovimiento, DIF_INVENTARIO, type EstadoStock } from '@/lib/stock-costos'

export type IncomeStatementItem = { label: string; amount: number; sub: string | null }

export type IncomeStatementData = {
  ventas: number
  cmv: number
  /** Ventas y costo de lo vendido por categoría de inventario (suman ventas y cmv) */
  ventasPorCategoria: Record<string, number>
  cmvPorCategoria: Record<string, number>
  otherIncomeItems: IncomeStatementItem[]
  expenseItems: IncomeStatementItem[]
}

const SALE_SUBTYPES = ['SALE_PRODUCT', 'SALE']
// No van al resultado: se reconocen en otro momento (ver arriba)
const EXCLUDED_INCOME_SUBTYPES = ['COBRO_CREDITO']
const EXCLUDED_EXPENSE_SUBTYPES = ['PURCHASE_PRODUCT', 'PURCHASE', 'PURCHASE_BIEN_USO', 'PAGO_DEUDA']

export async function getIncomeStatementData(
  businessId: string,
  from: Date,
  to: Date,
  currency: string,
): Promise<IncomeStatementData> {
  // Los movimientos de stock están valorizados en pesos (los productos se operan en ARS):
  // solo entran al estado cuando el reporte es en pesos; en USD no hay CMV que mostrar.
  // Sin filtro por `activo`: un producto archivado hoy igual tuvo ventas y costo en el período.
  const [txs, salidas] = await Promise.all([
    prisma.transaction.findMany({
      where: { businessId, currency, date: { gte: from, lte: to } },
      select: {
        type: true,
        subType: true,
        amount: true,
        description: true,
        bienDeUsoId: true,
        operacionId: true,
        producto: { select: { categoria: true } },
        category: { select: { name: true } },
        subcategory: { select: { name: true } },
      },
    }),
    currency === 'ARS'
      ? prisma.movimientoStock.findMany({
          where: {
            fecha: { gte: from, lte: to },
            producto: { businessId },
            OR: [{ tipo: 'SALIDA' }, { tipo: 'ENTRADA', costoUnitario: { not: null } }],
          },
          select: { id: true, tipo: true, concepto: true, cantidad: true, precio: true, costoUnitario: true, productoId: true, producto: { select: { precioCosto: true, categoria: true } } },
        })
      : Promise.resolve([]),
  ])

  let ventas = 0
  const SIN_CAT = 'Sin categoría'
  const catDe = (c: string | null | undefined) => c?.trim() || SIN_CAT
  const ventasPorCategoria: Record<string, number> = {}
  const sumar = (m: Record<string, number>, k: string, v: number) => { m[k] = (m[k] ?? 0) + v }
  // Ventas de operaciones con varios productos: cada parte cobrada se reparte entre las
  // categorías según el subtotal de cada ítem
  const opIds = Array.from(new Set(txs.filter((t) => t.type === 'INCOME' && SALE_SUBTYPES.includes(t.subType ?? '') && t.operacionId).map((t) => t.operacionId!)))
  const itemsOp = opIds.length > 0
    ? await prisma.operacionItem.findMany({
        where: { operacionId: { in: opIds } },
        select: { operacionId: true, subtotal: true, producto: { select: { categoria: true } } },
      })
    : []
  const repartoOp = new Map<string, { cat: string; peso: number }[]>()
  for (const it of itemsOp) {
    const lista = repartoOp.get(it.operacionId) ?? []
    lista.push({ cat: catDe(it.producto?.categoria), peso: it.subtotal })
    repartoOp.set(it.operacionId, lista)
  }
  const otherIncomeItems: IncomeStatementItem[] = []
  const expenseItems: IncomeStatementItem[] = []

  const bienesVendidos = new Set<string>()
  for (const tx of txs) {
    const subType = tx.subType ?? ''
    // Venta de bien de uso: no va el precio cobrado, sino el resultado (ver más abajo)
    if (subType === 'SALE_BIEN_USO') {
      if (tx.bienDeUsoId) bienesVendidos.add(tx.bienDeUsoId)
      continue
    }
    const item = {
      label: tx.category?.name?.trim() || tx.description?.trim() || 'Otros',
      amount: tx.amount,
      sub: tx.subcategory?.name?.trim() || null,
    }
    if (tx.type === 'INCOME') {
      if (SALE_SUBTYPES.includes(subType)) {
        ventas += tx.amount
        const reparto = tx.operacionId ? repartoOp.get(tx.operacionId) : undefined
        const pesoTotal = reparto?.reduce((s, r) => s + r.peso, 0) ?? 0
        if (reparto && pesoTotal > 0) {
          for (const r of reparto) sumar(ventasPorCategoria, r.cat, tx.amount * (r.peso / pesoTotal))
        } else {
          sumar(ventasPorCategoria, catDe(tx.producto?.categoria), tx.amount)
        }
      }
      else if (!EXCLUDED_INCOME_SUBTYPES.includes(subType)) otherIncomeItems.push(item)
    } else if (!EXCLUDED_EXPENSE_SUBTYPES.includes(subType)) {
      expenseItems.push(item)
    }
  }

  // Resultado por venta de bienes de uso = precio de venta (todas sus partes, aunque sea en
  // cuotas) − valor de libros (valor de compra; el sistema no amortiza). Se reconoce en la
  // fecha de la venta: ganancia en otros ingresos, pérdida en gastos.
  if (bienesVendidos.size > 0) {
    const [bienes, partes] = await Promise.all([
      prisma.bienDeUso.findMany({
        where: { id: { in: [...bienesVendidos] }, businessId },
        select: { id: true, nombre: true, valorAdquisicion: true, depreciacionAcumulada: true },
      }),
      prisma.transaction.findMany({
        where: { businessId, currency, subType: 'SALE_BIEN_USO', bienDeUsoId: { in: [...bienesVendidos] } },
        select: { bienDeUsoId: true, amount: true, date: true },
      }),
    ])
    for (const bien of bienes) {
      const propias = partes.filter((p) => p.bienDeUsoId === bien.id)
      const fechaVenta = new Date(Math.min(...propias.map((p) => p.date.getTime())))
      if (fechaVenta < from || fechaVenta > to) continue
      const precio = propias.reduce((s, p) => s + p.amount, 0)
      const resultado = precio - Math.max(0, bien.valorAdquisicion - bien.depreciacionAcumulada)
      if (Math.abs(resultado) < 0.01) continue
      if (resultado > 0) otherIncomeItems.push({ label: 'Resultado por venta de bienes de uso', amount: resultado, sub: bien.nombre })
      else expenseItems.push({ label: 'Pérdida por venta de bienes de uso', amount: -resultado, sub: bien.nombre })
    }
  }

  // Salidas viejas sin costo guardado: se reconstruye el CPP cronológico hasta cada
  // venta (mismo replay que el Estado patrimonial), no el promedio de hoy.
  const productosSinCosto = [...new Set(salidas.filter((m) => m.tipo === 'SALIDA' && m.costoUnitario == null).map((m) => m.productoId))]
  const cppEnLaVenta = new Map<string, number>()
  if (productosSinCosto.length > 0) {
    const historial = await prisma.movimientoStock.findMany({
      where: { productoId: { in: productosSinCosto }, producto: { businessId }, fecha: { lte: to } },
      orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, productoId: true, tipo: true, concepto: true, cantidad: true, precio: true, costoUnitario: true },
    })
    const costoReferencia = new Map(salidas.map((m) => [m.productoId, m.producto.precioCosto ?? 0]))
    const estadoPorProducto = new Map<string, EstadoStock>()
    for (const h of historial) {
      const e = estadoPorProducto.get(h.productoId) ?? { stock: 0, valor: 0 }
      if (h.tipo === 'SALIDA' && h.costoUnitario == null) {
        cppEnLaVenta.set(h.id, e.stock > 0 ? e.valor / e.stock : costoReferencia.get(h.productoId) ?? 0)
      }
      aplicarMovimiento(e, h, costoReferencia.get(h.productoId) ?? 0)
      estadoPorProducto.set(h.productoId, e)
    }
  }

  let cmv = 0
  const cmvPorCategoria: Record<string, number> = {}
  let sobrante = 0
  let faltante = 0
  let difCosto = 0
  for (const m of salidas) {
    const costo = m.costoUnitario ?? cppEnLaVenta.get(m.id) ?? m.producto.precioCosto ?? 0
    if (m.concepto === DIF_INVENTARIO) {
      if (m.tipo === 'ENTRADA') sobrante += m.cantidad * costo
      else faltante += m.cantidad * costo
    } else if (m.tipo === 'SALIDA') {
      cmv += m.cantidad * costo
      sumar(cmvPorCategoria, catDe(m.producto.categoria), m.cantidad * costo)
    } else if (m.precio > 0) {
      // Compra con costo fijo: precio pagado − costo fijo
      difCosto += m.cantidad * (m.precio - costo)
    }
  }
  if (sobrante > 0.5) otherIncomeItems.push({ label: 'Diferencia de inventario', amount: sobrante, sub: 'Sobrantes' })
  if (faltante > 0.5) expenseItems.push({ label: 'Diferencia de inventario', amount: faltante, sub: 'Faltantes' })
  if (difCosto > 0.5) expenseItems.push({ label: 'Diferencia de costo', amount: difCosto, sub: 'Compras sobre el costo fijo' })
  else if (difCosto < -0.5) otherIncomeItems.push({ label: 'Diferencia de costo', amount: -difCosto, sub: 'Compras bajo el costo fijo' })

  return { ventas, cmv, ventasPorCategoria, cmvPorCategoria, otherIncomeItems, expenseItems }
}

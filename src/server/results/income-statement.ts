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
 * - Gastos: todos los egresos registrados, pagados o no (incluye faltantes de caja). NO las
 *   compras de mercadería (se reconocen como CMV al vender), NI las compras de bienes de uso
 *   (son un activo: impactan en la caja y en el Estado patrimonial), ni los pagos de deuda
 *   (el gasto ya contó cuando se registró).
 * Los cobros/pagos y las compras de mercadería se ven en el Flujo de efectivo.
 */

import prisma from '@/lib/prisma'

export type IncomeStatementItem = { label: string; amount: number; sub: string | null }

export type IncomeStatementData = {
  ventas: number
  cmv: number
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
  const [txs, salidas] = await Promise.all([
    prisma.transaction.findMany({
      where: { businessId, currency, date: { gte: from, lte: to } },
      select: {
        type: true,
        subType: true,
        amount: true,
        description: true,
        bienDeUsoId: true,
        category: { select: { name: true } },
        subcategory: { select: { name: true } },
      },
    }),
    // Mismo universo que Inventario: productos activos
    prisma.movimientoStock.findMany({
      where: { tipo: 'SALIDA', fecha: { gte: from, lte: to }, producto: { businessId, activo: true } },
      select: { cantidad: true, costoUnitario: true, producto: { select: { precioCosto: true } } },
    }),
  ])

  let ventas = 0
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
      if (SALE_SUBTYPES.includes(subType)) ventas += tx.amount
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

  // Salidas viejas sin costo guardado: se valorizan al CPP actual
  const cmv = salidas.reduce((acc, m) => acc + m.cantidad * (m.costoUnitario ?? m.producto.precioCosto ?? 0), 0)

  return { ventas, cmv, otherIncomeItems, expenseItems }
}

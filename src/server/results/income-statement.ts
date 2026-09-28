/**
 * income-statement.ts
 *
 * Datos del Estado de resultados (criterio devengado):
 * - Ventas: ventas de productos del período, cobradas o no.
 * - CMV: unidades que salieron del inventario × su costo promedio ponderado (CPP) del
 *   momento de la salida. Es el mismo número que "Inventario vendido" en Inventario.
 * - Otros ingresos: el resto de los ingresos registrados (venta de bien de uso, sobrantes
 *   de caja, categorías propias...), cobrados o no. NO los cobros de crédito (la venta ya
 *   contó cuando se registró; el cobro solo mueve la caja).
 * - Gastos: todos los egresos registrados, pagados o no (incluye compra de bien de uso y
 *   faltantes de caja). NO las compras de mercadería (se reconocen como CMV al vender)
 *   ni los pagos de deuda (el gasto ya contó cuando se registró).
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
const EXCLUDED_EXPENSE_SUBTYPES = ['PURCHASE_PRODUCT', 'PURCHASE', 'PAGO_DEUDA']

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

  for (const tx of txs) {
    const subType = tx.subType ?? ''
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

  // Salidas viejas sin costo guardado: se valorizan al CPP actual
  const cmv = salidas.reduce((acc, m) => acc + m.cantidad * (m.costoUnitario ?? m.producto.precioCosto ?? 0), 0)

  return { ventas, cmv, otherIncomeItems, expenseItems }
}

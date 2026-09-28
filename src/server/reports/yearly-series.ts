/**
 * yearly-series.ts
 *
 * Series mes a mes (enero → diciembre de un año) para los gráficos de los estados.
 * Usa las mismas fuentes que los cuadros, así gráfico y cuadro dicen lo mismo:
 * - Resultados: getIncomeStatementData (ventas, CMV, otros ingresos, gastos).
 * - Flujo: getCashFlowSummary (ingresos, egresos y saldo final de caja por moneda).
 * - Patrimonio: foto al cierre de cada mes (caja, mercadería, créditos a cobrar / deudas).
 * Los meses que todavía no llegaron vienen en null (el gráfico los deja vacíos).
 */

import prisma from '@/lib/prisma'
import { getCashBalancesAt, getCashFlowSummary, CASH_ACCOUNT_TYPES } from '@/server/cash/cash-flow'
import { getIncomeStatementData } from '@/server/results/income-statement'

export type ResultsPoint = { ventas: number; gananciaBruta: number; gananciaNeta: number } | null
export type CashPoint = { ingresos: number; egresos: number; saldoFinal: number } | null
export type BalancePoint = { activos: number; pasivos: number } | null

export type YearlySeries = {
  year: number
  resultados: ResultsPoint[]
  flujo: CashPoint[]
  patrimonio: BalancePoint[]
}

function monthRanges(year: number, now: Date) {
  return Array.from({ length: 12 }, (_, i) => {
    const from = new Date(year, i, 1, 0, 0, 0)
    const monthEnd = new Date(year, i + 1, 0, 23, 59, 59, 999)
    if (from > now) return null
    // El mes en curso llega hasta hoy
    return { from, to: monthEnd > now ? now : monthEnd }
  })
}

/** Activos (caja + mercadería + créditos a cobrar) y pasivos (deudas) al cierre de `asOf`, en pesos. */
async function getBalanceAt(businessId: string, asOf: Date, currency: string): Promise<{ activos: number; pasivos: number }> {
  const [cashAccounts, balances, productos, creditos] = await Promise.all([
    prisma.account.findMany({
      where: { businessId, isSystemAccount: false, type: { in: [...CASH_ACCOUNT_TYPES] }, currency },
      select: { id: true },
    }),
    getCashBalancesAt(businessId, asOf),
    prisma.producto.findMany({
      where: { businessId, activo: true },
      select: { id: true, stockActual: true, precioCosto: true },
    }),
    prisma.transaction.findMany({
      where: { businessId, esCredito: true, currency, date: { lte: asOf } },
      select: { id: true, type: true, amount: true },
    }),
  ])

  const caja = cashAccounts.reduce((s, a) => s + (balances[a.id] ?? 0), 0)

  // Stock al cierre = stock actual − lo que entró/salió después (valuado al costo actual)
  const movimientosPost = productos.length
    ? await prisma.movimientoStock.findMany({
        where: { productoId: { in: productos.map((p) => p.id) }, fecha: { gt: asOf } },
        select: { productoId: true, tipo: true, cantidad: true },
      })
    : []
  const deltaPost = new Map<string, number>()
  for (const m of movimientosPost) {
    const d = m.tipo === 'ENTRADA' ? m.cantidad : m.tipo === 'SALIDA' ? -m.cantidad : 0
    deltaPost.set(m.productoId, (deltaPost.get(m.productoId) ?? 0) + d)
  }
  const mercaderia = currency === 'ARS'
    ? productos.reduce((s, p) => s + Math.max(0, p.stockActual - (deltaPost.get(p.id) ?? 0)) * p.precioCosto, 0)
    : 0

  // Créditos abiertos al cierre = monto − lo cobrado/pagado hasta esa fecha
  const aplicados = creditos.length
    ? await prisma.transaction.groupBy({
        by: ['linkedCreditoId'],
        where: { businessId, linkedCreditoId: { in: creditos.map((c) => c.id) }, date: { lte: asOf } },
        _sum: { amount: true },
      })
    : []
  const aplicadoPor = new Map(aplicados.map((a) => [a.linkedCreditoId, a._sum.amount ?? 0]))
  let aCobrar = 0
  let aPagar = 0
  for (const c of creditos) {
    const pendiente = Math.max(0, c.amount - (aplicadoPor.get(c.id) ?? 0))
    if (c.type === 'INCOME') aCobrar += pendiente
    else aPagar += pendiente
  }

  return { activos: caja + mercaderia + aCobrar, pasivos: aPagar }
}

export async function getYearlySeriesData(businessId: string, year: number, cashCurrency: string): Promise<YearlySeries> {
  const now = new Date()
  const ranges = monthRanges(year, now)

  const [resultados, flujo, patrimonio] = await Promise.all([
    Promise.all(ranges.map(async (r): Promise<ResultsPoint> => {
      if (!r) return null
      const er = await getIncomeStatementData(businessId, r.from, r.to, 'ARS')
      const otros = er.otherIncomeItems.reduce((s, i) => s + i.amount, 0)
      const gastos = er.expenseItems.reduce((s, i) => s + i.amount, 0)
      const gananciaBruta = er.ventas - er.cmv
      return { ventas: er.ventas, gananciaBruta, gananciaNeta: gananciaBruta + otros - gastos }
    })),
    Promise.all(ranges.map(async (r): Promise<CashPoint> => {
      if (!r) return null
      const f = await getCashFlowSummary(businessId, r.from, r.to, cashCurrency)
      return { ingresos: f.ingresos, egresos: f.egresos, saldoFinal: f.saldoFinal }
    })),
    Promise.all(ranges.map((r): Promise<BalancePoint> | null => (r ? getBalanceAt(businessId, r.to, 'ARS') : null))),
  ])

  return { year, resultados, flujo, patrimonio }
}

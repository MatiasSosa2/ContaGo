/**
 * yearly-series.ts
 *
 * Series mes a mes (enero → diciembre de un año) para los gráficos de los estados.
 * Usa las mismas fuentes que los cuadros, así gráfico y cuadro dicen lo mismo:
 * - Resultados: getIncomeStatementData (ventas, CMV, otros ingresos, gastos).
 * - Flujo: getCashFlowSummary (ingresos, egresos y saldo final de caja por moneda).
 * - Patrimonio: foto al cierre de cada mes (src/server/balance/balance-sheet.ts).
 * Los meses que todavía no llegaron vienen en null (el gráfico los deja vacíos).
 */

import { getCashFlowSummary } from '@/server/cash/cash-flow'
import { getIncomeStatementData } from '@/server/results/income-statement'
import { getBalanceSheetData } from '@/server/balance/balance-sheet'

export type ResultsPoint = { ventas: number; gananciaBruta: number; gananciaNeta: number } | null
export type CashPoint = { ingresos: number; egresos: number; saldoFinal: number } | null
/** En pesos; rate = pesos por dólar a esa fecha (para verlo en dólares) */
export type BalancePoint = { activos: number; pasivos: number; rate: number | null } | null

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

export async function getYearlySeriesData(businessId: string, year: number, cashCurrency: string, accountId?: string): Promise<YearlySeries> {
  const now = new Date()
  const ranges = monthRanges(year, now)

  // Mes por mes (no los 12 en paralelo): lanzar cientos de consultas a la vez satura el
  // servidor de Next. Cada mes igual consulta sus tres estados en paralelo.
  const resultados: ResultsPoint[] = []
  const flujo: CashPoint[] = []
  const patrimonio: BalancePoint[] = []
  for (const r of ranges) {
    if (!r) { resultados.push(null); flujo.push(null); patrimonio.push(null); continue }
    const [er, f, b] = await Promise.all([
      getIncomeStatementData(businessId, r.from, r.to, 'ARS'),
      getCashFlowSummary(businessId, r.from, r.to, cashCurrency, accountId),
      getBalanceSheetData(businessId, r.to),
    ])
    const otros = er.otherIncomeItems.reduce((s, i) => s + i.amount, 0)
    const gastos = er.expenseItems.reduce((s, i) => s + i.amount, 0)
    const gananciaBruta = er.ventas - er.cmv
    resultados.push({ ventas: er.ventas, gananciaBruta, gananciaNeta: gananciaBruta + otros - gastos })
    flujo.push(accountId
      ? { ingresos: f.ingresos + f.entradasCaja, egresos: f.egresos + f.salidasCaja, saldoFinal: f.saldoFinal }
      : { ingresos: f.ingresos, egresos: f.egresos, saldoFinal: f.saldoFinal })
    patrimonio.push({ activos: b.totalActivo, pasivos: b.totalPasivo, rate: b.rate })
  }

  return { year, resultados, flujo, patrimonio }
}

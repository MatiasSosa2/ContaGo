import Link from 'next/link'
import FinancialStatementsPanel, { type ReportsPrevious, type ReportsTrends } from '@/components/FinancialStatementsPanel'
import PeriodSelector from '@/components/PeriodSelector'
import AppHeader from '@/components/AppHeader'
import { Suspense } from 'react'
import { getBalanceSheet, getCashFlowByCurrency, getIncomeStatement, getReportInsights, getYearlySeries } from '@/app/actions'
import { getReportsViewData, previousPeriodArgs, type ReportsSearchParams } from './reportsData'

export const dynamic = 'force-dynamic'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<ReportsSearchParams>
}) {
  const {
    sessionContext,
    periodo,
    params,
    selectedYear,
    selectedMonth,
    selectedDay,
    selectedWeekStart,
    periodLabel,
    queryString,
    results,
    cashFlow,
    balanceSheet,
    seriesYear,
    seriesActiveMonth,
  } = await getReportsViewData(searchParams)

  const periodArgs = [periodo, params?.from, params?.to, selectedYear, selectedMonth, selectedDay, selectedWeekStart] as const
  const prev = previousPeriodArgs(periodo, selectedYear, selectedMonth)

  const [series, insights, balance, prevER, prevFlow] = await Promise.all([
    getYearlySeries(seriesYear, 'ARS'),
    getReportInsights(...periodArgs),
    getBalanceSheet(...periodArgs),
    prev ? getIncomeStatement(prev.period, prev.from, prev.to, prev.year, prev.month, undefined, undefined, 'ARS') : null,
    prev ? getCashFlowByCurrency(prev.period, prev.from, prev.to, prev.year, prev.month) : null,
  ])

  // Tendencias reales del año (hasta el mes elegido)
  const upTo = seriesActiveMonth ?? 11
  const hasta = <T,>(arr: (T | null)[]) => arr.slice(0, upTo + 1).filter((m): m is T => m !== null)
  const trends: ReportsTrends = {
    ventas: hasta(series.resultados).map((m) => m.ventas),
    entro: hasta(series.flujo).map((m) => m.ingresos),
    activo: hasta(series.patrimonio).map((m) => m.activos),
  }

  // Comparación con el período anterior (mes o año); el activo, contra el cierre anterior
  const previous: ReportsPrevious = prev && prevER && prevFlow
    ? { ventas: prevER.ventas, entro: prevFlow.ARS.ingresos, activo: balance.previous.totalActivo, label: prev.label }
    : null

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto font-sans text-[#1F2937] dark:text-gray-100 min-h-screen bg-[#F2F2F7] dark:bg-black">
      <AppHeader
        title="Informes"
        showRoleBadge={false}
        sessionContext={sessionContext}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
          </svg>
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Suspense fallback={null}>
                <PeriodSelector
                  active={periodo}
                  customFrom={params?.from}
                  customTo={params?.to}
                  selectedYear={selectedYear}
                  selectedMonth={selectedMonth}
                  selectedDay={selectedDay}
                  selectedWeekStart={selectedWeekStart}
                />
              </Suspense>
            </div>
            {/* Exportar el informe completo: los 3 estados juntos en un PDF */}
            <Link
              href={`/reports/completo${queryString ? `?${queryString}` : ''}`}
              target="_blank"
              title="Exportar informe completo (PDF)"
              aria-label="Exportar informe completo (PDF)"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#007AFF] transition hover:bg-[#007AFF]/[0.1] dark:text-[#0A84FF] print:hidden"
            >
              <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15" />
              </svg>
            </Link>
          </div>
        }
      />

      <FinancialStatementsPanel
        periodLabel={periodLabel}
        queryString={queryString}
        results={results}
        cashFlow={cashFlow}
        balanceSheet={balanceSheet}
        trends={trends}
        previous={previous}
        insights={insights}
      />
    </div>
  )
}

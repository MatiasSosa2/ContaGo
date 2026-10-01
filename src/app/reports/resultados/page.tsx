import AppHeader from '@/components/AppHeader'
import PeriodSelector from '@/components/PeriodSelector'
import PrintButton from '@/components/PrintButton'
import ResultadosDetail, { type ResultsPrevious, type ResultsTrends } from '@/components/financial-statements/ResultadosDetail'
import { ResultadosCharts } from '@/components/financial-statements/StatementCharts'
import { StatementHeader } from '@/components/financial-statements/modern'
import { getIncomeStatement, getYearlySeries } from '@/app/actions'
import { getReportsViewData, previousPeriodArgs, type ReportsSearchParams } from '../reportsData'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default async function ResultadosPage({
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
    seriesYear,
    seriesActiveMonth,
  } = await getReportsViewData(searchParams)
  const series = await getYearlySeries(seriesYear, 'ARS')

  // Tendencia de las tarjetas: los meses del año con datos (hasta el mes elegido)
  const upTo = seriesActiveMonth ?? 11
  const meses = series.resultados.slice(0, upTo + 1).filter((m): m is NonNullable<typeof m> => m !== null)
  const trends: ResultsTrends = {
    ventas: meses.map((m) => m.ventas),
    cmv: meses.map((m) => m.ventas - m.gananciaBruta),
    bruta: meses.map((m) => m.gananciaBruta),
    neta: meses.map((m) => m.gananciaNeta),
  }

  // Comparación de las tarjetas: mes anterior (vista mensual) o año anterior (vista anual)
  let previous: ResultsPrevious = null
  const prev = previousPeriodArgs(periodo, selectedYear, selectedMonth)
  if (prev) {
    const er = await getIncomeStatement(prev.period, prev.from, prev.to, prev.year, prev.month, undefined, undefined, 'ARS')
    const suma = (items: { amount: number }[]) => items.reduce((acc, i) => acc + i.amount, 0)
    previous = { ventas: er.ventas, neta: er.ventas - er.cmv + suma(er.otherIncomeItems) - suma(er.expenseItems), label: prev.label }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto font-sans text-[#1F2937] dark:text-gray-100 min-h-screen bg-[#F2F2F7] dark:bg-black">
      <AppHeader
        title="Estado de Resultados"
        showRoleBadge={false}
        sessionContext={sessionContext}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 15l4-4 4 4 5-6" />
          </svg>
        }
        actions={
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
        }
      />

      <StatementHeader
        title="Estado de resultados"
        period={periodLabel}
        backHref={`/reports${queryString ? `?${queryString}` : ''}`}
        actions={<PrintButton />}
      />

      {/* Cuadro con números a la izquierda (60%); los dos gráficos a la derecha (40%) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="min-w-0">
          <ResultadosDetail data={results} trends={trends} previous={previous} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <ResultadosCharts series={series} results={results} activeMonth={seriesActiveMonth} />
        </div>
      </div>
    </div>
  )
}

import Link from 'next/link'
import AppHeader from '@/components/AppHeader'
import PeriodSelector from '@/components/PeriodSelector'
import PrintButton from '@/components/PrintButton'
import PatrimonioDetail, { type BalanceTrends } from '@/components/financial-statements/PatrimonioDetail'
import { PatrimonioCharts } from '@/components/financial-statements/StatementCharts'
import { SF_FONT, StatementHeader } from '@/components/financial-statements/modern'
import { getBalanceSheet, getYearlySeries } from '@/app/actions'
import { getReportsViewData, previousPeriodArgs, type ReportsSearchParams } from '../reportsData'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default async function PatrimonioPage({
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
    seriesYear,
    seriesActiveMonth,
  } = await getReportsViewData(searchParams)
  const moneda: 'ARS' | 'USD' = params?.moneda === 'USD' ? 'USD' : 'ARS'

  // Patrimonio al cierre del período y al cierre anterior (todo a la misma fecha de corte)
  const [{ current, previous }, series] = await Promise.all([
    getBalanceSheet(periodo, params?.from, params?.to, selectedYear, selectedMonth, selectedDay, selectedWeekStart),
    getYearlySeries(seriesYear, 'ARS'),
  ])

  // Tendencia de las tarjetas: los meses del año con datos (hasta el mes elegido)
  const upTo = seriesActiveMonth ?? 11
  const meses = series.patrimonio.slice(0, upTo + 1).filter((m): m is NonNullable<typeof m> => m !== null)
  const conv = (v: number, rate: number | null) => (moneda === 'USD' ? (rate ? v / rate : 0) : v)
  const trends: BalanceTrends = {
    activo: meses.map((m) => conv(m.activos, m.rate)),
    pasivo: meses.map((m) => conv(m.pasivos, m.rate)),
  }
  const prevLabel = previousPeriodArgs(periodo, selectedYear, selectedMonth)?.label ?? 'anterior'

  const monedaHref = (m: 'ARS' | 'USD') => {
    const sp = new URLSearchParams(queryString)
    if (m === 'USD') sp.set('moneda', 'USD')
    else sp.delete('moneda')
    const qs = sp.toString()
    return `/reports/patrimonio${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto font-sans text-[#1F2937] dark:text-gray-100 min-h-screen bg-[#F2F2F7] dark:bg-black">
      <AppHeader
        title="Estado Patrimonial"
        showRoleBadge={false}
        sessionContext={sessionContext}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 21V12h6v9" />
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
        title="Estado patrimonial"
        period={`Al cierre de ${periodLabel}`}
        backHref={`/reports${queryString ? `?${queryString}` : ''}`}
        actions={
          <div className="flex items-center gap-2">
            {/* Pesos | Dólares: control segmentado estilo iOS */}
            <div className="flex rounded-[9px] bg-black/[0.06] p-0.5 dark:bg-white/[0.1]" role="group" aria-label="Moneda" style={{ fontFamily: SF_FONT }}>
              {(['ARS', 'USD'] as const).map((m) => (
                <Link
                  key={m}
                  href={monedaHref(m)}
                  aria-current={moneda === m ? 'true' : undefined}
                  className={`rounded-[7px] px-3 py-1 text-[13px] font-medium transition ${
                    moneda === m
                      ? 'bg-white text-[#1C1C1E] shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-[#636366] dark:text-white'
                      : 'text-[#3C3C43] hover:opacity-70 dark:text-[#EBEBF5]/80'
                  }`}
                >
                  {m === 'ARS' ? 'Pesos' : 'Dólares'}
                </Link>
              ))}
            </div>
            <PrintButton />
          </div>
        }
      />

      {/* Cuadro con números a la izquierda (60%); los dos gráficos a la derecha (40%) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="min-w-0">
          <PatrimonioDetail data={current} previous={previous} currency={moneda} trends={trends} prevLabel={prevLabel} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <PatrimonioCharts series={series} balance={current} currency={moneda} activeMonth={seriesActiveMonth} />
        </div>
      </div>
    </div>
  )
}

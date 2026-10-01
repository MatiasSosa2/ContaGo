import Link from 'next/link'
import AppHeader from '@/components/AppHeader'
import PeriodSelector from '@/components/PeriodSelector'
import PrintButton from '@/components/PrintButton'
import FlujoDetail, { type CashTrends } from '@/components/financial-statements/FlujoDetail'
import { FlujoCharts } from '@/components/financial-statements/StatementCharts'
import { SF_FONT, StatementHeader } from '@/components/financial-statements/modern'
import { getCashStatement, getYearlySeries } from '@/app/actions'
import { getReportsViewData, type ReportsSearchParams } from '../reportsData'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default async function FlujoCajaPage({
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
    cashCurrency,
    seriesYear,
    seriesActiveMonth,
  } = await getReportsViewData(searchParams)
  // Detalle del flujo (todas las cajas de la moneda o la elegida en "Todas ▾")
  const statement = await getCashStatement(periodo, params?.from, params?.to, selectedYear, selectedMonth, selectedDay, selectedWeekStart, cashCurrency, params?.caja ?? null)
  const series = await getYearlySeries(seriesYear, cashCurrency, statement.accountId ?? undefined)

  // Tendencia de la tarjeta de saldo: los meses del año con datos (hasta el mes elegido)
  const upTo = seriesActiveMonth ?? 11
  const meses = series.flujo.slice(0, upTo + 1).filter((m): m is NonNullable<typeof m> => m !== null)
  const trends: CashTrends = { saldo: meses.map((m) => m.saldoFinal) }

  const monedaHref = (moneda: 'ARS' | 'USD') => {
    const sp = new URLSearchParams(queryString)
    if (moneda === 'USD') sp.set('moneda', 'USD')
    else sp.delete('moneda')
    sp.delete('caja')
    const qs = sp.toString()
    return `/reports/flujo-caja${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto font-sans text-[#1F2937] dark:text-gray-100 min-h-screen bg-[#F2F2F7] dark:bg-black">
      <AppHeader
        title="Estado de Flujo de Efectivo"
        showRoleBadge={false}
        sessionContext={sessionContext}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a4 4 0 00-8 0v2M5 9h14l-1 11H6L5 9z" />
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
        title="Flujo de efectivo"
        period={periodLabel}
        backHref={`/reports${queryString ? `?${queryString}` : ''}`}
        actions={
          <div className="flex items-center gap-2">
            {/* Selector de moneda: control segmentado estilo iOS */}
            <div className="flex rounded-[9px] bg-black/[0.06] p-0.5 dark:bg-white/[0.1]" role="group" aria-label="Moneda" style={{ fontFamily: SF_FONT }}>
              {(['ARS', 'USD'] as const).map((moneda) => (
                <Link
                  key={moneda}
                  href={monedaHref(moneda)}
                  aria-current={cashCurrency === moneda ? 'true' : undefined}
                  className={`rounded-[7px] px-3 py-1 text-[13px] font-medium transition ${
                    cashCurrency === moneda
                      ? 'bg-white text-[#1C1C1E] shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-[#636366] dark:text-white'
                      : 'text-[#3C3C43] hover:opacity-70 dark:text-[#EBEBF5]/80'
                  }`}
                >
                  {moneda === 'ARS' ? 'Pesos' : 'Dólares'}
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
          <FlujoDetail data={statement} trends={trends} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <FlujoCharts series={series} currency={cashCurrency} activeMonth={seriesActiveMonth} />
        </div>
      </div>
    </div>
  )
}

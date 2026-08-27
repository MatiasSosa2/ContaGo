import Link from 'next/link'
import AppHeader from '@/components/AppHeader'
import PeriodSelector from '@/components/PeriodSelector'
import PrintButton from '@/components/PrintButton'
import EvolutionChart from '@/components/financial-statements/EvolutionChart'
import { fmtAmount, fmtPct } from '@/components/financial-statements/shared'
import { getReportsViewData, type ReportsSearchParams } from '../reportsData'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default async function EvolucionPage({
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
    monthlyEvolution,
  } = await getReportsViewData(searchParams)

  const last = monthlyEvolution[monthlyEvolution.length - 1]
  const previous = monthlyEvolution[monthlyEvolution.length - 2]
  const delta = previous && previous.net !== 0
    ? ((last.net - previous.net) / Math.abs(previous.net)) * 100
    : 0

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto font-sans text-[#1F2937] dark:text-gray-100 min-h-screen bg-[#F7F9FB] dark:bg-black">
      <AppHeader
        title="Evolución mensual"
        showRoleBadge={false}
        sessionContext={sessionContext}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8M21 7v6h-6" />
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

      <section className="executive-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#E5E7EB] bg-[#FCFDFC] px-5 py-4 dark:border-white/10 dark:bg-[#141414] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <Link
              href={`/reports${queryString ? `?${queryString}` : ''}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#D1D5DB] text-[#4B5563] transition hover:border-brand-military hover:text-brand-military dark:border-white/10 dark:text-[#D1D5DB] dark:hover:border-white/30 dark:hover:text-white"
              aria-label="Volver a estados"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h2 className="text-base font-semibold text-[#1F2937] dark:text-[#E8E8E8]">Evolución mensual</h2>
              <p className="text-xs text-[#9CA3AF]">Neto mensual, últimos seis meses · período actual: {periodLabel}</p>
            </div>
          </div>
          <div className="shrink-0"><PrintButton /></div>
        </div>

        <div className="grid gap-5 bg-[#F9FAFB] px-6 py-6 dark:bg-[#0F0F0F] lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="border border-[#E5E7EB] bg-white p-5 dark:border-white/10 dark:bg-[#141414]"><EvolutionChart points={monthlyEvolution} /></div>

          <aside className="border border-[#E5E7EB] bg-white p-5 dark:border-white/10 dark:bg-[#141414]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Último cierre</p>
            <p className="mt-2 font-mono text-2xl font-bold text-[#3F5F76] num-tabular dark:text-[#9BC1DA]">{fmtAmount(last?.net || 0, 'ARS', true)}</p>
            <p className="mt-1 text-xs text-[#6B7280] dark:text-[#A3A3A3]">{last?.label || 'Sin período'}</p>
            <div className="mt-6 border-t border-[#E5E7EB] pt-4 dark:border-white/10">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Variación contra mes anterior</p>
              <p className="mt-2 flex items-center gap-2 font-mono text-lg font-semibold text-[#374151] num-tabular dark:text-[#D1D5DB]">
                {delta > 0 ? '↑' : delta < 0 ? '↓' : '→'} {fmtPct(delta)}
              </p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}

import Link from 'next/link'
import AppHeader from '@/components/AppHeader'
import PeriodSelector from '@/components/PeriodSelector'
import PrintButton from '@/components/PrintButton'
import ResultadosDetail from '@/components/financial-statements/ResultadosDetail'
import { getReportsViewData, type ReportsSearchParams } from '../reportsData'
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
  } = await getReportsViewData(searchParams)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto font-sans text-[#1F2937] dark:text-gray-100 min-h-screen bg-[#F7F9FB] dark:bg-black">
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
              <h2 className="text-base font-semibold text-[#1F2937] dark:text-[#E8E8E8]">Estado de resultados</h2>
              <p className="text-xs text-[#9CA3AF]">{periodLabel}</p>
            </div>
          </div>

          <div className="shrink-0"><PrintButton /></div>
        </div>

        <div className="bg-[#F9FAFB] px-6 py-6 dark:bg-[#0F0F0F]">
          <ResultadosDetail data={results} />
        </div>
      </section>
    </div>
  )
}

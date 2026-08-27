import FinancialStatementsPanel from '@/components/FinancialStatementsPanel'
import PrintButton from '@/components/PrintButton'
import PeriodSelector from '@/components/PeriodSelector'
import AppHeader from '@/components/AppHeader'
import { Suspense } from 'react'
import { getReportsViewData, type ReportsSearchParams } from './reportsData'

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
    monthlyEvolution,
    results,
    cashFlow,
    balanceSheet,
  } = await getReportsViewData(searchParams)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto font-sans text-[#1F2937] dark:text-gray-100 min-h-screen bg-[#F7F9FB] dark:bg-black">

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

      <FinancialStatementsPanel
        periodLabel={periodLabel}
        queryString={queryString}
        exportSlot={<PrintButton />}
        results={results}
        cashFlow={cashFlow}
        balanceSheet={balanceSheet}
        monthlyEvolution={monthlyEvolution}
      />

    </div>
  )
}


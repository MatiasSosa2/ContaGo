import AppHeader from '@/components/AppHeader'
import PeriodSelector from '@/components/PeriodSelector'
import type { PeriodKey } from '@/components/PeriodSelector'
import { requireBusinessContext } from '@/server/auth/require-business-context'
import BienesDeUsoClient from '@/components/BienesDeUsoClient'
import { getBienesDeUso } from '@/app/actions'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default async function BienesDeUsoPage({
  searchParams,
}: {
  searchParams?: Promise<{ periodo?: string; from?: string; to?: string; year?: string; month?: string; day?: string; weekStart?: string }>
}) {
  const [sessionContext, sp] = await Promise.all([
    requireBusinessContext(),
    searchParams ?? Promise.resolve({} as any),
  ])

  const periodo = (sp?.periodo ?? 'mensual') as PeriodKey
  const customFrom = sp?.from
  const customTo = sp?.to
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1
  const selectedYear = sp?.year ? Number.parseInt(sp.year, 10) : (periodo === 'mensual' || periodo === 'anual' ? currentYear : undefined)
  const selectedMonth = sp?.month ? Number.parseInt(sp.month, 10) : (periodo === 'mensual' ? currentMonth : undefined)
  const selectedDay = sp?.day
  const selectedWeekStart = sp?.weekStart

  const bienes = await getBienesDeUso(true, periodo, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto font-sans text-[#1F2937] dark:text-gray-100 min-h-screen bg-[#F7F9FB] dark:bg-black">
      <AppHeader
        title="Bienes de uso"
        sessionContext={sessionContext}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 7v14m18-14v14M5 21V7m14 14V7M5 7l7-4 7 4M9 21v-6h6v6" />
          </svg>
        }
        actions={
          <Suspense fallback={null}>
            <PeriodSelector
              active={periodo}
              customFrom={customFrom}
              customTo={customTo}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              selectedDay={selectedDay}
              selectedWeekStart={selectedWeekStart}
            />
          </Suspense>
        }
      />
      <BienesDeUsoClient initialBienes={bienes as never[]} />
    </div>
  )
}

import { getProductos } from '@/app/actions'
import AppHeader from '@/components/AppHeader'
import PeriodSelector from '@/components/PeriodSelector'
import type { PeriodKey } from '@/components/PeriodSelector'
import { requireBusinessContext } from '@/server/auth/require-business-context'
import StockClient from '@/components/StockClient'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

type StockSearchParams = { periodo?: string; from?: string; to?: string; year?: string; month?: string; day?: string; weekStart?: string }
type StockClientProductos = Parameters<typeof StockClient>[0]['initialProductos']

export default async function StockPage({
  searchParams,
}: {
  searchParams?: Promise<StockSearchParams>
}) {
  const [sessionContext, sp] = await Promise.all([
    requireBusinessContext(),
    searchParams ?? Promise.resolve<StockSearchParams>({}),
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

  const productos = await getProductos(periodo, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart)

  return (
    <div className="min-h-screen bg-[#F7F9FB] font-sans text-[#1F2937] dark:bg-black dark:text-gray-100">

      <AppHeader
        title="Inventario"
        sessionContext={sessionContext}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
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

      <StockClient initialProductos={productos as StockClientProductos} />
    </div>
  )
}

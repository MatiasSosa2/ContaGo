import { getAllTransactions, getCajasData } from '@/app/actions'
import AppHeader from '@/components/AppHeader'
import PeriodSelector from '@/components/PeriodSelector'
import type { PeriodKey } from '@/components/PeriodSelector'
import { requireBusinessContext } from '@/server/auth/require-business-context'
import CajasClient from '@/components/CajasClient'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default async function CajasPage({
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

  const [data, movements] = await Promise.all([
    getCajasData(periodo, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart),
    getAllTransactions(periodo, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart),
  ])

  // Determinar el tipo de periodo para el preview
  let chartPeriod: 'diario' | 'semanal' | 'mensual'
  if (periodo === 'diario') chartPeriod = 'diario'
  else if (periodo === 'semanal') chartPeriod = 'semanal'
  else chartPeriod = 'mensual'

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto font-sans text-[#1F2937] dark:text-gray-100 min-h-screen bg-[#F7F9FB] dark:bg-black">

      <AppHeader
        title="Cajas"
        icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
        sessionContext={sessionContext}
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

      {/* ══ CONTENIDO PRINCIPAL — Client Component ═══════════════════════════ */}
      <CajasClient
        data={data}
        movements={movements}
        period={chartPeriod}
        customFrom={customFrom}
        customTo={customTo}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        selectedDay={selectedDay}
        selectedWeekStart={selectedWeekStart}
      />
    </div>
  )
}

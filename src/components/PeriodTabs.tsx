'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition, useState, lazy, Suspense, useMemo } from 'react'

const DateRangeModal = lazy(() => import('./DateRangeModal'))

export const PERIODS = [
  { key: 'diario', label: 'Diario' },
  { key: 'ayer', label: 'Día anterior' },
  { key: 'semanal', label: 'Semanal' },
  { key: 'mensual', label: 'Mensual' },
  { key: 'trimestral', label: 'Trimestral' },
  { key: 'semestral', label: 'Semestral' },
  { key: 'anual', label: 'Anual' },
  { key: 'custom', label: 'Seleccionar período' },
] as const

export type PeriodKey = typeof PERIODS[number]['key']

type DashboardMonthOption = {
  year: number
  month: number
  label: string
  shortYear: string
  key: string
}

type DashboardPresetSummary = {
  period: Exclude<PeriodKey, 'custom'>
  periodLabel: string
  income: number
  expense: number
  gain: number
  incomeChangePct: number | null
  expenseChangePct: number | null
  gainChangePct: number | null
}

type ModalSelection = {
  period: PeriodKey
  from?: string
  to?: string
}

interface PeriodTabsProps {
  active: PeriodKey
  customFrom?: string
  customTo?: string
  selectedYear?: number
  selectedMonth?: number
}

const MONTH_WINDOW_SIZE = 6
const YEAR_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function clampWindowStart(startMonth: number) {
  return Math.min(Math.max(1, startMonth), YEAR_MONTHS.length - MONTH_WINDOW_SIZE + 1)
}

function shiftYearMonth(year: number, month: number, delta: number) {
  const shiftedDate = new Date(year, month - 1 + delta, 1)
  return {
    year: shiftedDate.getFullYear(),
    month: shiftedDate.getMonth() + 1,
  }
}

function formatCustomRange(from: string, to: string) {
  const formatDate = (value: string) => {
    const date = new Date(value + 'T12:00:00')
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
  }

  return `${formatDate(from)} – ${formatDate(to)}`
}

export default function PeriodTabs({
  active,
  customFrom,
  customTo,
  selectedYear,
  selectedMonth,
}: PeriodTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const effectiveYear = selectedYear ?? currentYear
  const effectiveMonth = selectedMonth ?? currentMonth
  const displayYear = active === 'mensual' ? effectiveYear : currentYear
  const yearMonths = useMemo<DashboardMonthOption[]>(() => (
    YEAR_MONTHS.map((label, index) => ({
      year: displayYear,
      month: index + 1,
      label,
      shortYear: String(displayYear).slice(2),
      key: `${displayYear}-${String(index + 1).padStart(2, '0')}`,
    }))
  ), [displayYear])

  const visibleStartMonth = useMemo(() => {
    const anchorMonth = active === 'mensual' && displayYear === effectiveYear ? effectiveMonth : (displayYear === currentYear ? currentMonth : 1)
    return clampWindowStart(anchorMonth - (MONTH_WINDOW_SIZE - 1))
  }, [active, currentMonth, currentYear, displayYear, effectiveMonth, effectiveYear])

  const visibleMonths = useMemo(
    () => yearMonths.slice(visibleStartMonth - 1, visibleStartMonth - 1 + MONTH_WINDOW_SIZE),
    [yearMonths, visibleStartMonth],
  )

  function replaceWithParams(mutator: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    mutator(params)
    startTransition(() => router.replace(`${pathname}?${params.toString()}`))
  }

  function changeYear(nextYear: number) {
    replaceWithParams((params) => {
      params.set('year', String(nextYear))

      if (active === 'mensual') {
        params.set('month', String(Math.min(effectiveMonth, 12)))
      }
    })
  }

  function navigateMonth(direction: 'prev' | 'next') {
    replaceWithParams((params) => {
      const next = shiftYearMonth(effectiveYear, effectiveMonth, direction === 'next' ? 1 : -1)
      params.set('periodo', 'mensual')
      params.set('year', String(next.year))
      params.set('month', String(next.month))
      params.delete('from')
      params.delete('to')
    })
  }

  function selectMonth(month: DashboardMonthOption) {
    replaceWithParams((params) => {
      params.set('periodo', 'mensual')
      params.set('year', String(month.year))
      params.set('month', String(month.month))
      params.delete('from')
      params.delete('to')
    })
  }

  function handleModalConfirm(selection: ModalSelection) {
    setModalOpen(false)

    replaceWithParams((params) => {
      params.set('periodo', selection.period)

      if (selection.period === 'custom' && selection.from && selection.to) {
        params.set('from', selection.from)
        params.set('to', selection.to)
        params.delete('year')
        params.delete('month')
        return
      }

      params.delete('from')
      params.delete('to')

      if (selection.period !== 'mensual') {
        params.delete('year')
        params.delete('month')
      } else {
        params.set('year', String(currentYear))
        params.set('month', String(currentMonth))
      }
    })
  }

  const selectorLabel = active === 'custom' && customFrom && customTo
    ? formatCustomRange(customFrom, customTo)
    : 'Seleccionar período'

  return (
    <>
      <div className="w-full rounded-2xl border border-stone-200 bg-white p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/[0.04] dark:bg-[#101113] dark:shadow-none sm:p-3">
        <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:flex-wrap xl:items-center">
            <div className="flex min-w-0 flex-wrap items-center gap-3 xl:shrink-0">
              <div className="inline-flex items-center gap-1 rounded-2xl border border-stone-200 bg-stone-50 p-0.5 dark:border-white/[0.04] dark:bg-[#17191c]">
                <button
                  type="button"
                  onClick={() => changeYear(displayYear - 1)}
                  disabled={pending}
                  className="flex h-7 w-7 items-center justify-center rounded-xl text-stone-500 transition hover:bg-white hover:text-stone-800 disabled:cursor-not-allowed disabled:opacity-40 dark:text-stone-400 dark:hover:bg-[#101113] dark:hover:text-stone-100"
                  aria-label="Año anterior"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="rounded-xl bg-white px-3 py-1 text-sm font-semibold text-stone-800 ring-1 ring-stone-200/80 dark:bg-[#0d0e10] dark:text-stone-100 dark:ring-white/[0.05]">
                  {displayYear}
                </span>
                <button
                  type="button"
                  onClick={() => changeYear(displayYear + 1)}
                  disabled={pending}
                  className="flex h-7 w-7 items-center justify-center rounded-xl text-stone-500 transition hover:bg-white hover:text-stone-800 disabled:cursor-not-allowed disabled:opacity-40 dark:text-stone-400 dark:hover:bg-[#101113] dark:hover:text-stone-100"
                  aria-label="Año siguiente"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2 xl:ml-4 xl:mr-3">
              <div className="flex min-w-0 flex-wrap items-center gap-1 rounded-2xl border border-stone-200 bg-stone-50 p-1 dark:border-white/[0.04] dark:bg-[#17191c]">
                <button
                  type="button"
                  onClick={() => navigateMonth('prev')}
                  disabled={pending}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition hover:border-stone-300 hover:text-stone-800 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.05] dark:bg-[#0d0e10] dark:text-stone-400 dark:hover:border-white/[0.10] dark:hover:text-stone-100"
                  aria-label="Mes anterior"
                  title="Mes anterior"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                {visibleMonths.map((month) => {
                  const isActive = active === 'mensual' && selectedYear === month.year && selectedMonth === month.month
                  const isCurrentCalendarMonth = month.year === currentYear && month.month === currentMonth

                  return (
                    <button
                      key={month.key}
                      type="button"
                      onClick={() => selectMonth(month)}
                      disabled={pending}
                      className={
                        isActive
                          ? 'rounded-xl border px-3 py-1.5 text-xs font-semibold capitalize transition-all duration-150 bg-[#1B4332] text-[#D8F3DC] border-[#1B4332]'
                          : isCurrentCalendarMonth
                            ? 'rounded-xl border px-3 py-1.5 text-xs font-semibold capitalize transition-all duration-150 border-[#CFE2D5] text-[#5a7e69] dark:border-[#2c4335] dark:text-[#9cc8ae]'
                            : 'rounded-xl border px-3 py-1.5 text-xs font-semibold capitalize transition-all duration-150 border-transparent text-stone-500 dark:text-stone-400'
                      }
                      aria-current={isActive ? 'date' : undefined}
                      title={isCurrentCalendarMonth && !isActive ? 'Mes actual' : month.label}
                    >
                      {month.label}
                    </button>
                  )
                })}

                <button
                  type="button"
                  onClick={() => navigateMonth('next')}
                  disabled={pending}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition hover:border-stone-300 hover:text-stone-800 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.05] dark:bg-[#0d0e10] dark:text-stone-400 dark:hover:border-white/[0.10] dark:hover:text-stone-100"
                  aria-label="Mes siguiente"
                  title="Mes siguiente"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => selectMonth({ year: currentYear, month: currentMonth, label: YEAR_MONTHS[currentMonth - 1], shortYear: String(currentYear).slice(2), key: `${currentYear}-${String(currentMonth).padStart(2, '0')}` })}
                disabled={pending || (active === 'mensual' && effectiveYear === currentYear && effectiveMonth === currentMonth)}
                className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.05] dark:bg-[#0d0e10] dark:text-stone-200 dark:hover:border-white/[0.10] dark:hover:bg-[#17191c]"
                title="Volver al mes actual"
              >
                Hoy
              </button>

              <button
                type="button"
                onClick={() => setModalOpen(true)}
                disabled={pending}
                className={
                  active === 'custom'
                    ? 'rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all duration-150 bg-[#1B4332] text-[#D8F3DC] border-[#1B4332]'
                    : 'rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all duration-150 border-stone-200 text-stone-500 dark:border-white/[0.05] dark:text-stone-300'
                }
              >
                <svg className="mr-1.5 inline-block h-3.5 w-3.5 -mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {selectorLabel}
              </button>
            </div>
        </div>
      </div>

      {modalOpen && (
        <Suspense fallback={null}>
          <DateRangeModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onConfirm={handleModalConfirm}
            initialFrom={customFrom}
            initialTo={customTo}
            initialPeriod={active === 'custom' ? 'custom' : active}
          />
        </Suspense>
      )}
    </>
  )
}
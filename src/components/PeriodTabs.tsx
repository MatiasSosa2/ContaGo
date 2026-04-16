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

export type DashboardMonthOption = {
  year: number
  month: number
  label: string
  shortYear: string
  key: string
}

type ModalSelection = {
  period: PeriodKey
  from?: string
  to?: string
}

type ModalCompatiblePeriodKey = 'ayer' | 'semanal' | 'mensual' | 'semestral' | 'anual' | 'custom'

interface PeriodTabsProps {
  active: PeriodKey
  customFrom?: string
  customTo?: string
  selectedYear?: number
  selectedMonth?: number
  availableMonths: DashboardMonthOption[]
}

const YEAR_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function makeMonthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function normalizeMonths(months: DashboardMonthOption[], currentYear: number, currentMonth: number) {
  const byKey = new Map<string, DashboardMonthOption>()

  for (const month of months) {
    byKey.set(month.key, month)
  }

  const currentKey = makeMonthKey(currentYear, currentMonth)
  if (!byKey.has(currentKey)) {
    byKey.set(currentKey, {
      year: currentYear,
      month: currentMonth,
      label: YEAR_MONTHS[currentMonth - 1],
      shortYear: String(currentYear).slice(2),
      key: currentKey,
    })
  }

  return Array.from(byKey.values()).sort((left, right) => {
    if (left.year !== right.year) {
      return left.year - right.year
    }

    return left.month - right.month
  })
}

function formatCustomRange(from: string, to: string) {
  const formatDate = (value: string) => {
    const date = new Date(value + 'T12:00:00')
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
  }

  return `${formatDate(from)} – ${formatDate(to)}`
}

function getModalInitialPeriod(active: PeriodKey): ModalCompatiblePeriodKey {
  if (active === 'ayer' || active === 'semanal' || active === 'mensual' || active === 'semestral' || active === 'anual' || active === 'custom') {
    return active
  }

  return 'mensual'
}

export default function PeriodTabs({
  active,
  customFrom,
  customTo,
  selectedYear,
  selectedMonth,
  availableMonths,
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
  const normalizedMonths = useMemo(
    () => normalizeMonths(availableMonths, currentYear, currentMonth),
    [availableMonths, currentMonth, currentYear],
  )
  const dropdownYear = active === 'mensual' ? effectiveYear : currentYear
  const dropdownMonth = active === 'mensual' ? effectiveMonth : currentMonth
  const availableYears = useMemo(
    () => Array.from(new Set(normalizedMonths.map((month) => month.year))).sort((left, right) => right - left),
    [normalizedMonths],
  )
  const availableMonthsForYear = useMemo(
    () => normalizedMonths.filter((month) => month.year === dropdownYear),
    [dropdownYear, normalizedMonths],
  )

  function replaceWithParams(mutator: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    mutator(params)
    startTransition(() => router.replace(`${pathname}?${params.toString()}`))
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

  function selectYearFromDropdown(nextYear: number) {
    const monthsForYear = normalizedMonths.filter((month) => month.year === nextYear)
    const fallbackMonth = monthsForYear.find((month) => month.month === dropdownMonth) ?? monthsForYear[monthsForYear.length - 1]

    if (!fallbackMonth) {
      return
    }

    selectMonth(fallbackMonth)
  }

  function selectMonthFromDropdown(nextMonth: number) {
    const match = normalizedMonths.find((month) => month.year === dropdownYear && month.month === nextMonth)
    if (!match) {
      return
    }

    selectMonth(match)
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

      params.delete('year')
      params.delete('month')
    })
  }

  const selectorLabel = active === 'custom' && customFrom && customTo
    ? formatCustomRange(customFrom, customTo)
    : 'Seleccionar período'

  return (
    <>
      <div className="w-full rounded-2xl border border-stone-200 bg-white p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/[0.04] dark:bg-[#101113] dark:shadow-none sm:p-3">
        <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-2 py-1.5 dark:border-white/[0.04] dark:bg-[#17191c]">
              <div className="min-w-[112px]">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Año</label>
                <select
                  value={dropdownYear}
                  onChange={(event) => selectYearFromDropdown(Number(event.target.value))}
                  disabled={pending}
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 outline-none transition focus:border-[#1B4332] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.05] dark:bg-[#0d0e10] dark:text-stone-200"
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div className="min-w-[144px]">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Mes</label>
                <select
                  value={dropdownMonth}
                  onChange={(event) => selectMonthFromDropdown(Number(event.target.value))}
                  disabled={pending || availableMonthsForYear.length === 0}
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm capitalize text-stone-700 outline-none transition focus:border-[#1B4332] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.05] dark:bg-[#0d0e10] dark:text-stone-200"
                >
                  {availableMonthsForYear.map((month) => (
                    <option key={month.key} value={month.month}>{month.label}</option>
                  ))}
                </select>
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
      </div>

      {modalOpen && (
        <Suspense fallback={null}>
          <DateRangeModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onConfirm={handleModalConfirm}
            initialFrom={customFrom}
            initialTo={customTo}
            initialPeriod={getModalInitialPeriod(active)}
          />
        </Suspense>
      )}
    </>
  )
}

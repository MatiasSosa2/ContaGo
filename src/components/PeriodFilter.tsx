'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useMemo, useTransition } from 'react'
import type { DashboardMonthOption } from './PeriodTabs'

type PeriodFilterProps = {
  availableMonths: DashboardMonthOption[]
  selectedYear?: number
  selectedMonth?: number
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

export default function PeriodFilter({ availableMonths, selectedYear, selectedMonth }: PeriodFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const effectiveYear = selectedYear ?? currentYear
  const effectiveMonth = selectedMonth ?? currentMonth

  const normalizedMonths = useMemo(
    () => normalizeMonths(availableMonths, currentYear, currentMonth),
    [availableMonths, currentMonth, currentYear],
  )

  const availableYears = useMemo(
    () => Array.from(new Set(normalizedMonths.map((month) => month.year))).sort((left, right) => right - left),
    [normalizedMonths],
  )

  const availableMonthsForYear = useMemo(
    () => normalizedMonths.filter((month) => month.year === effectiveYear),
    [effectiveYear, normalizedMonths],
  )

  function replaceWithMonth(month: DashboardMonthOption) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('year', String(month.year))
    params.set('month', String(month.month))
    params.delete('preset')
    params.delete('from')
    params.delete('to')

    startTransition(() => router.replace(`${pathname}?${params.toString()}`))
  }

  function selectYear(nextYear: number) {
    const monthsForYear = normalizedMonths.filter((month) => month.year === nextYear)
    const fallbackMonth = monthsForYear.find((month) => month.month === effectiveMonth) ?? monthsForYear[monthsForYear.length - 1]

    if (!fallbackMonth) {
      return
    }

    replaceWithMonth(fallbackMonth)
  }

  function selectMonth(nextMonth: number) {
    const match = normalizedMonths.find((month) => month.year === effectiveYear && month.month === nextMonth)
    if (!match) {
      return
    }

    replaceWithMonth(match)
  }

  return (
    <div className="print:hidden w-full rounded-2xl border border-stone-200 bg-white p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/[0.04] dark:bg-[#101113] dark:shadow-none sm:p-3">
      <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-2 py-1.5 dark:border-white/[0.04] dark:bg-[#17191c]">
            <div className="min-w-[112px]">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Año</label>
              <select
                value={effectiveYear}
                onChange={(event) => selectYear(Number(event.target.value))}
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
                value={effectiveMonth}
                onChange={(event) => selectMonth(Number(event.target.value))}
                disabled={pending || availableMonthsForYear.length === 0}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm capitalize text-stone-700 outline-none transition focus:border-[#1B4332] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.05] dark:bg-[#0d0e10] dark:text-stone-200"
              >
                {availableMonthsForYear.map((month) => (
                  <option key={month.key} value={month.month}>{month.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

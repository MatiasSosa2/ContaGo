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
  monthOffset: number
  availableMonths: DashboardMonthOption[]
  presetSummaries: DashboardPresetSummary[]
}

const MONTH_PAGE_SIZE = 4

function clampOffset(offset: number, maxLength: number) {
  const maxOffset = Math.max(0, Math.floor((Math.max(maxLength, 1) - 1) / MONTH_PAGE_SIZE) * MONTH_PAGE_SIZE)
  return Math.min(Math.max(0, offset), maxOffset)
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
  monthOffset,
  availableMonths,
  presetSummaries,
}: PeriodTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)

  const currentOffset = useMemo(
    () => clampOffset(monthOffset, availableMonths.length),
    [monthOffset, availableMonths.length],
  )

  const visibleMonths = useMemo(
    () => availableMonths.slice(currentOffset, currentOffset + MONTH_PAGE_SIZE),
    [availableMonths, currentOffset],
  )

  const hasPreviousPage = currentOffset > 0
  const hasNextPage = currentOffset + MONTH_PAGE_SIZE < availableMonths.length

  function replaceWithParams(mutator: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    mutator(params)
    startTransition(() => router.replace(`${pathname}?${params.toString()}`))
  }

  function goToOffset(nextOffset: number) {
    replaceWithParams((params) => {
      params.set('monthOffset', String(clampOffset(nextOffset, availableMonths.length)))
    })
  }

  function selectMonth(month: DashboardMonthOption) {
    replaceWithParams((params) => {
      params.set('periodo', 'mensual')
      params.set('year', String(month.year))
      params.set('month', String(month.month))
      params.set('monthOffset', String(currentOffset))
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
      }
    })
  }

  const activeSummary = presetSummaries.find((summary) => summary.period === (active === 'custom' ? 'mensual' : active))
  const selectorLabel = active === 'custom' && customFrom && customTo
    ? formatCustomRange(customFrom, customTo)
    : PERIODS.find((period) => period.key === active)?.label ?? 'Seleccionar período'

  return (
    <>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1 rounded-[26px] border border-stone-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f7faf7_100%)] px-4 py-4 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Meses registrados</p>
              <p className="text-sm text-stone-500 mt-1">Se muestran de a 4 meses reales con movimientos registrados.</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToOffset(currentOffset - MONTH_PAGE_SIZE)}
                disabled={!hasPreviousPage || pending}
                className="h-10 w-10 rounded-full border border-stone-200 bg-white text-stone-500 transition-colors hover:border-stone-300 hover:text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Ver cuatro meses más recientes"
              >
                <svg className="mx-auto h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => goToOffset(currentOffset + MONTH_PAGE_SIZE)}
                disabled={!hasNextPage || pending}
                className="h-10 w-10 rounded-full border border-stone-200 bg-white text-stone-500 transition-colors hover:border-stone-300 hover:text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Ver cuatro meses anteriores"
              >
                <svg className="mx-auto h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {visibleMonths.map((month) => {
              const isActive = active === 'mensual' && selectedYear === month.year && selectedMonth === month.month

              return (
                <button
                  key={month.key}
                  type="button"
                  onClick={() => selectMonth(month)}
                  disabled={pending}
                  className={`rounded-2xl px-4 py-4 text-left transition-all ${
                    isActive
                      ? 'bg-[#163527] text-white shadow-[0_14px_28px_rgba(22,53,39,0.18)]'
                      : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50 hover:ring-stone-300'
                  }`}
                >
                  <span className={`block text-[11px] font-semibold uppercase tracking-[0.18em] ${isActive ? 'text-emerald-200' : 'text-stone-400'}`}>
                    {month.shortYear}
                  </span>
                  <span className="mt-1 block text-lg font-semibold">{month.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={pending}
          className="xl:w-[320px] shrink-0 rounded-[26px] border border-stone-200 bg-white px-4 py-4 text-left shadow-[0_14px_40px_rgba(15,23,42,0.06)] transition-all hover:border-stone-300 hover:bg-stone-50"
        >
          <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Seleccionar período</span>
          <span className="mt-1 flex items-center gap-2 text-sm font-semibold text-stone-700">
            <svg className="h-4 w-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {selectorLabel}
          </span>
          {activeSummary && (
            <div className="mt-3 rounded-2xl bg-stone-50 px-3 py-3 ring-1 ring-stone-200">
              <p className="text-xs text-stone-500">{activeSummary.periodLabel}</p>
              <p className="mt-1 text-sm font-semibold text-stone-700">
                Resultado {activeSummary.gain.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
              </p>
            </div>
          )}
        </button>
      </div>

      {modalOpen && (
        <Suspense fallback={null}>
          <DateRangeModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onConfirm={handleModalConfirm}
            initialPeriod={active}
            initialFrom={customFrom}
            initialTo={customTo}
            presetSummaries={presetSummaries}
          />
        </Suspense>
      )}
    </>
  )
}
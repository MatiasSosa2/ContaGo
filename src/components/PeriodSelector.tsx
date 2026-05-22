'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

export const PERIOD_KEYS = ['diario', 'semanal', 'mensual', 'anual', 'custom'] as const
export type PeriodKey = typeof PERIOD_KEYS[number]

const TABS: Array<{ key: PeriodKey; label: string }> = [
  { key: 'diario', label: 'Día' },
  { key: 'semanal', label: 'Semana' },
  { key: 'mensual', label: 'Mes' },
  { key: 'anual', label: 'Año' },
  { key: 'custom', label: 'Personalizado' },
]

const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const VISIBLE_COUNT = 7
const HALF = Math.floor(VISIBLE_COUNT / 2)

interface PeriodSelectorProps {
  active: PeriodKey
  selectedDay?: string
  selectedWeekStart?: string
  selectedYear?: number
  selectedMonth?: number
  customFrom?: string
  customTo?: string
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toISO(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function getMondayOf(date: Date): Date {
  const d = startOfDay(date)
  const dow = d.getDay()
  const offset = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + offset)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta
  return { year: Math.floor(total / 12), month: (total % 12 + 12) % 12 + 1 }
}

function diffDaysInclusive(from: Date, to: Date): number {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime()
  return Math.floor(ms / 86400000) + 1
}

export default function PeriodSelector({
  active,
  selectedDay,
  selectedWeekStart,
  selectedYear,
  selectedMonth,
  customFrom,
  customTo,
}: PeriodSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const now = useMemo(() => new Date(), [])
  const todayISO = toISO(now)
  const todayWeekISO = toISO(getMondayOf(now))
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const selectedDayDate = selectedDay ? new Date(selectedDay + 'T12:00:00') : now
  const selectedWeekDate = selectedWeekStart ? new Date(selectedWeekStart + 'T12:00:00') : now
  const selectedWeekMonday = getMondayOf(selectedWeekDate)
  const effectiveYear = selectedYear ?? currentYear
  const effectiveMonth = selectedMonth ?? currentMonth

  // Window center per tab (offset relative to selected/today; nav arrows shift)
  const [dayOffset, setDayOffset] = useState(0)
  const [weekOffset, setWeekOffset] = useState(0)
  const [monthOffset, setMonthOffset] = useState(0)
  const [yearOffset, setYearOffset] = useState(0)

  const [customDraft, setCustomDraft] = useState<{ from: string; to: string }>({
    from: customFrom ?? '',
    to: customTo ?? '',
  })

  function navigate(mutator: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    mutator(params)
    startTransition(() => router.replace(`${pathname}?${params.toString()}`))
  }

  function clearAllPeriodParams(params: URLSearchParams) {
    params.delete('day')
    params.delete('weekStart')
    params.delete('year')
    params.delete('month')
    params.delete('from')
    params.delete('to')
  }

  function selectTab(next: PeriodKey) {
    if (next === active) return
    navigate((params) => {
      params.set('periodo', next)
      clearAllPeriodParams(params)
    })
    // reset window offsets when switching tabs
    setDayOffset(0); setWeekOffset(0); setMonthOffset(0); setYearOffset(0)
  }

  function selectDay(date: Date) {
    navigate((params) => {
      params.set('periodo', 'diario')
      clearAllPeriodParams(params)
      params.set('day', toISO(date))
    })
  }

  function selectWeek(monday: Date) {
    navigate((params) => {
      params.set('periodo', 'semanal')
      clearAllPeriodParams(params)
      params.set('weekStart', toISO(monday))
    })
  }

  function selectMonth(year: number, month: number) {
    navigate((params) => {
      params.set('periodo', 'mensual')
      clearAllPeriodParams(params)
      params.set('year', String(year))
      params.set('month', String(month))
    })
  }

  function selectYear(year: number) {
    navigate((params) => {
      params.set('periodo', 'anual')
      clearAllPeriodParams(params)
      params.set('year', String(year))
    })
  }

  function goToday() {
    setDayOffset(0); setWeekOffset(0); setMonthOffset(0); setYearOffset(0)
    if (active === 'diario') selectDay(now)
    else if (active === 'semanal') selectWeek(getMondayOf(now))
    else if (active === 'anual') selectYear(currentYear)
    else if (active === 'custom') {
      // Reset to current month default
      navigate((params) => {
        params.set('periodo', 'mensual')
        clearAllPeriodParams(params)
      })
      setCustomDraft({ from: '', to: '' })
    }
    else selectMonth(currentYear, currentMonth)
  }

  function applyCustomIfReady(from: string, to: string) {
    if (!from || !to) return
    if (new Date(from) > new Date(to)) return
    navigate((params) => {
      params.set('periodo', 'custom')
      clearAllPeriodParams(params)
      params.set('from', from)
      params.set('to', to)
    })
  }

  function clearCustom() {
    setCustomDraft({ from: '', to: '' })
    navigate((params) => {
      params.set('periodo', 'mensual')
      clearAllPeriodParams(params)
    })
  }

  // ── Build items for current tab ────────────────────────────────────────────
  type Item = {
    key: string
    primary: string
    secondary?: string
    isActive: boolean
    isToday: boolean
    onClick: () => void
  }

  const items: Item[] = useMemo(() => {
    const list: Item[] = []
    if (active === 'diario') {
      const center = addDays(selectedDayDate, dayOffset)
      for (let i = -HALF; i <= HALF; i++) {
        const d = addDays(center, i)
        const iso = toISO(d)
        list.push({
          key: iso,
          primary: `${pad2(d.getDate())} ${MONTH_SHORT[d.getMonth()]}`,
          secondary: DAY_SHORT[d.getDay()],
          isActive: iso === toISO(selectedDayDate),
          isToday: iso === todayISO,
          onClick: () => selectDay(d),
        })
      }
    } else if (active === 'semanal') {
      const center = addDays(selectedWeekMonday, weekOffset * 7)
      for (let i = -HALF; i <= HALF; i++) {
        const monday = addDays(center, i * 7)
        const sunday = addDays(monday, 6)
        const iso = toISO(monday)
        const sameMonth = monday.getMonth() === sunday.getMonth()
        const primary = sameMonth
          ? `${monday.getDate()} - ${sunday.getDate()} ${MONTH_SHORT[sunday.getMonth()].toLowerCase()}`
          : `${monday.getDate()} ${MONTH_SHORT[monday.getMonth()].toLowerCase()} - ${sunday.getDate()} ${MONTH_SHORT[sunday.getMonth()].toLowerCase()}`
        list.push({
          key: iso,
          primary,
          isActive: iso === toISO(selectedWeekMonday),
          isToday: iso === todayWeekISO,
          onClick: () => selectWeek(monday),
        })
      }
    } else if (active === 'mensual') {
      const center = addMonths(effectiveYear, effectiveMonth, monthOffset)
      for (let i = -HALF; i <= HALF; i++) {
        const m = addMonths(center.year, center.month, i)
        const key = `${m.year}-${pad2(m.month)}`
        list.push({
          key,
          primary: MONTH_SHORT[m.month - 1],
          secondary: String(m.year),
          isActive: m.year === effectiveYear && m.month === effectiveMonth,
          isToday: m.year === currentYear && m.month === currentMonth,
          onClick: () => selectMonth(m.year, m.month),
        })
      }
    } else if (active === 'anual') {
      const center = effectiveYear + yearOffset
      for (let i = -HALF; i <= HALF; i++) {
        const y = center + i
        list.push({
          key: String(y),
          primary: String(y),
          isActive: y === effectiveYear,
          isToday: y === currentYear,
          onClick: () => selectYear(y),
        })
      }
    }
    return list
  }, [active, dayOffset, weekOffset, monthOffset, yearOffset, selectedDayDate, selectedWeekMonday, effectiveYear, effectiveMonth, currentYear, currentMonth, todayISO, todayWeekISO])

  function shiftWindow(direction: -1 | 1) {
    if (active === 'diario') setDayOffset((v) => v + direction)
    else if (active === 'semanal') setWeekOffset((v) => v + direction)
    else if (active === 'mensual') setMonthOffset((v) => v + direction)
    else if (active === 'anual') setYearOffset((v) => v + direction)
  }

  // ── Custom range summary ───────────────────────────────────────────────────
  const customSummary = (() => {
    const f = customDraft.from || customFrom
    const t = customDraft.to || customTo
    if (!f || !t) return null
    const fromDate = new Date(f + 'T12:00:00')
    const toDate = new Date(t + 'T12:00:00')
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return null
    if (fromDate > toDate) return null
    const fmt = (d: Date) => d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
    return {
      label: `${fmt(fromDate)} - ${fmt(toDate)}`,
      days: diffDaysInclusive(fromDate, toDate),
    }
  })()

  const tabBaseClass = 'rounded-lg px-2.5 py-1 text-[11px] font-semibold leading-none transition-colors'
  const navBtnClass = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 transition hover:border-[#1B4332]/40 hover:text-[#1B4332] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.06] dark:bg-[#0d0e10] dark:text-stone-300 dark:hover:text-emerald-300'

  return (
    <div className="w-full print:hidden">
      {/* Linea única: tabs + navegación + Hoy */}
      {active !== 'custom' ? (
        <div className="flex flex-wrap items-center gap-1.5 lg:flex-nowrap lg:gap-2">
          <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-stone-200 bg-stone-50/80 p-1 dark:border-white/[0.05] dark:bg-[#17191c]">
            {TABS.map((tab) => {
              const isActive = tab.key === active
              return (
                <button
                  key={tab.key}
                  type="button"
                  disabled={pending}
                  onClick={() => selectTab(tab.key)}
                  className={
                    isActive
                      ? `${tabBaseClass} bg-[#1B4332] text-[#D8F3DC] shadow-sm`
                      : `${tabBaseClass} text-stone-600 hover:bg-white hover:text-stone-900 dark:text-stone-300 dark:hover:bg-[#0d0e10]`
                  }
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-1 rounded-xl border border-stone-200 bg-white px-1 py-1 dark:border-white/[0.05] dark:bg-[#0d0e10]">
            <button
              type="button"
              onClick={() => shiftWindow(-1)}
              disabled={pending}
              aria-label="Anterior"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-[#1B4332] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/[0.05] dark:hover:text-emerald-300"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex min-w-0 flex-1 items-stretch justify-between gap-0.5">
              {items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  disabled={pending}
                  onClick={item.onClick}
                  className={
                    item.isActive
                      ? 'relative flex flex-1 min-w-0 flex-col items-center justify-center rounded-lg bg-[#FCE7C8] px-1.5 py-1 text-stone-900 ring-1 ring-[#E0B97D]/70 transition dark:bg-[#FCE7C8]/95'
                      : 'relative flex flex-1 min-w-0 flex-col items-center justify-center rounded-lg px-1.5 py-1 text-stone-600 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/[0.05]'
                  }
                >
                  <span className={`truncate text-[11px] font-semibold capitalize leading-tight ${item.isToday && !item.isActive ? 'text-[#1B4332] dark:text-emerald-300' : ''}`}>
                    {item.primary}
                  </span>
                  {item.secondary && (
                    <span className="text-[9px] font-medium leading-tight text-stone-500 dark:text-stone-400">{item.secondary}</span>
                  )}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => shiftWindow(1)}
              disabled={pending}
              aria-label="Siguiente"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-[#1B4332] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/[0.05] dark:hover:text-emerald-300"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            onClick={goToday}
            disabled={pending}
            aria-label="Hoy"
            title="Ir a hoy"
            className={navBtnClass}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex flex-wrap items-center gap-0.5 rounded-xl border border-stone-200 bg-stone-50/80 p-1 dark:border-white/[0.05] dark:bg-[#17191c]">
              {TABS.map((tab) => {
                const isActive = tab.key === active
                return (
                  <button
                    key={tab.key}
                    type="button"
                    disabled={pending}
                    onClick={() => selectTab(tab.key)}
                    className={
                      isActive
                        ? `${tabBaseClass} bg-[#1B4332] text-[#D8F3DC] shadow-sm`
                        : `${tabBaseClass} text-stone-600 hover:bg-white hover:text-stone-900 dark:text-stone-300 dark:hover:bg-[#0d0e10]`
                    }
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={clearCustom}
              disabled={pending}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-600 transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.06] dark:bg-[#0d0e10] dark:text-stone-200"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a8 8 0 0114-3m2 9a8 8 0 01-14 3" />
              </svg>
              Limpiar
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex min-w-[160px] flex-col">
            <label className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Desde</label>
            <input
              type="date"
              value={customDraft.from}
              onChange={(e) => {
                const next = e.target.value
                setCustomDraft((prev) => {
                  const updated = { ...prev, from: next }
                  applyCustomIfReady(updated.from, updated.to)
                  return updated
                })
              }}
              disabled={pending}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 outline-none transition focus:border-[#1B4332] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.05] dark:bg-[#0d0e10] dark:text-stone-200"
            />
          </div>

          <span className="mb-2 text-stone-400">→</span>

          <div className="flex min-w-[160px] flex-col">
            <label className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Hasta</label>
            <input
              type="date"
              value={customDraft.to}
              onChange={(e) => {
                const next = e.target.value
                setCustomDraft((prev) => {
                  const updated = { ...prev, to: next }
                  applyCustomIfReady(updated.from, updated.to)
                  return updated
                })
              }}
              disabled={pending}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 outline-none transition focus:border-[#1B4332] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.05] dark:bg-[#0d0e10] dark:text-stone-200"
            />
          </div>

          <div className="ml-auto flex min-w-[200px] flex-col rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 dark:border-white/[0.04] dark:bg-[#17191c]">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Rango seleccionado</span>
            {customSummary ? (
              <>
                <span className="mt-0.5 text-sm font-semibold text-stone-800 dark:text-stone-100">{customSummary.label}</span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400">{customSummary.days} días</span>
              </>
            ) : (
              <span className="mt-0.5 text-sm font-medium text-stone-400">Seleccioná Desde y Hasta</span>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  )
}

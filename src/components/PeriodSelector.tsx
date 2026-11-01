'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useHydrated } from '@/lib/useStoredValue'
import { CalendarPopover, RangeCalendar } from './ui/IosCalendar'

export const PERIOD_KEYS = ['diario', 'semanal', 'mensual', 'anual', 'custom'] as const
export type PeriodKey = typeof PERIOD_KEYS[number]

const PERIOD_QUERY_KEYS = ['periodo', 'day', 'weekStart', 'year', 'month', 'from', 'to'] as const
const PERIOD_STORAGE_KEY = 'contago:period'
const CUSTOM_RETURN_PERIOD_KEY = 'contago:period-before-custom'

const PERIOD_TYPES: Array<{ key: 'diario' | 'semanal' | 'mensual'; label: string }> = [
  { key: 'diario', label: 'Día' },
  { key: 'semanal', label: 'Semana' },
  { key: 'mensual', label: 'Mes' },
]

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

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

function getWeeksOfYear(year: number): Date[] {
  const first = getMondayOf(new Date(year, 0, 1))
  const last = getMondayOf(new Date(year, 11, 31))
  const weeks: Date[] = []
  for (let monday = first; monday <= last; monday = addDays(monday, 7)) {
    weeks.push(monday)
  }
  return weeks
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
  const latestParamsRef = useRef(searchParams.toString())

  useEffect(() => {
    if (!pending) latestParamsRef.current = searchParams.toString()
  }, [pending, searchParams])

  // Diferimos el uso de `new Date()` hasta después de montar en cliente para
  // evitar mismatches de hidratación entre la zona horaria/fecha del servidor
  // y la del navegador. Durante SSR y el primer render de cliente, `mounted`
  // es false y el componente devuelve null (el <Suspense fallback={null}> ya
  // reserva el espacio, así que la UX no cambia).
  const mounted = useHydrated()

  const now = useMemo(() => new Date(), [])
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const selectedDayDate = selectedDay ? new Date(selectedDay + 'T12:00:00') : now
  const selectedWeekDate = selectedWeekStart ? new Date(selectedWeekStart + 'T12:00:00') : now
  const selectedWeekMonday = getMondayOf(selectedWeekDate)
  const effectiveYear = selectedYear
    ?? (active === 'diario' ? selectedDayDate.getFullYear()
      : active === 'semanal' ? selectedWeekDate.getFullYear()
      : currentYear)
  const effectiveMonth = selectedMonth ?? currentMonth

  const [customDraft, setCustomDraft] = useState<{ from: string; to: string }>({
    from: customFrom ?? '',
    to: customTo ?? '',
  })

  function navigate(mutator: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(latestParamsRef.current)
    mutator(params)
    const query = params.toString()
    latestParamsRef.current = query
    try {
      const saved: Record<string, string> = {}
      for (const key of PERIOD_QUERY_KEYS) {
        const value = params.get(key)
        if (value) saved[key] = value
      }
      if (Object.keys(saved).length > 0) {
        sessionStorage.setItem(PERIOD_STORAGE_KEY, JSON.stringify(saved))
      } else {
        sessionStorage.removeItem(PERIOD_STORAGE_KEY)
      }
    } catch {
      // sessionStorage unavailable (SSR, privacy mode) — ignore
    }
    startTransition(() => router.replace(`${pathname}?${query}`))
  }

  // Restore period selection from sessionStorage when URL has no period params.
  // Runs once per pathname change so navegando entre secciones mantiene el período.
  useEffect(() => {
    try {
      const currentParams = new URLSearchParams(searchParams.toString())
      const hasAnyPeriodParam = PERIOD_QUERY_KEYS.some((key) => currentParams.has(key))
      if (hasAnyPeriodParam) return

      const raw = sessionStorage.getItem(PERIOD_STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as Record<string, string>
      if (!saved || typeof saved !== 'object') return

      let touched = false
      for (const key of PERIOD_QUERY_KEYS) {
        const value = saved[key]
        if (typeof value === 'string' && value.length > 0) {
          currentParams.set(key, value)
          touched = true
        }
      }
      if (!touched) return

      startTransition(() => router.replace(`${pathname}?${currentParams.toString()}`))
    } catch {
      // sessionStorage unavailable or corrupted — ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  function clearAllPeriodParams(params: URLSearchParams) {
    params.delete('day')
    params.delete('weekStart')
    params.delete('year')
    params.delete('month')
    params.delete('from')
    params.delete('to')
  }

  function forgetCustomReturnPeriod() {
    try { sessionStorage.removeItem(CUSTOM_RETURN_PERIOD_KEY) } catch { /* sessionStorage unavailable */ }
    setCustomDraft({ from: '', to: '' })
  }

  function isCustomPeriod() {
    return active === 'custom' || new URLSearchParams(latestParamsRef.current).get('periodo') === 'custom'
  }

  function selectCoreType(next: 'diario' | 'semanal' | 'mensual') {
    if (next === coreActive && active !== 'anual' && !isCustomPeriod()) return
    const selectedDate = coreActive === 'diario'
      ? selectedDayDate
      : coreActive === 'semanal'
        ? selectedWeekMonday
        : new Date(effectiveYear, effectiveMonth - 1, Math.min(now.getDate(), new Date(effectiveYear, effectiveMonth, 0).getDate()))

    if (next === 'diario') {
      selectDay(new Date(effectiveYear, selectedDate.getMonth(), Math.min(selectedDate.getDate(), new Date(effectiveYear, selectedDate.getMonth() + 1, 0).getDate())))
    } else if (next === 'semanal') {
      selectWeek(getMondayOf(new Date(effectiveYear, selectedDate.getMonth(), selectedDate.getDate())), effectiveYear)
    } else {
      selectMonth(effectiveYear, selectedDate.getMonth() + 1)
    }
  }

  function selectDay(date: Date) {
    if (isCustomPeriod()) forgetCustomReturnPeriod()
    navigate((params) => {
      params.set('periodo', 'diario')
      clearAllPeriodParams(params)
      params.set('day', toISO(date))
      params.set('year', String(date.getFullYear()))
    })
  }

  function selectWeek(monday: Date, year = monday.getFullYear()) {
    if (isCustomPeriod()) forgetCustomReturnPeriod()
    navigate((params) => {
      params.set('periodo', 'semanal')
      clearAllPeriodParams(params)
      params.set('weekStart', toISO(monday))
      params.set('year', String(year))
    })
  }

  function selectMonth(year: number, month: number) {
    if (isCustomPeriod()) forgetCustomReturnPeriod()
    navigate((params) => {
      params.set('periodo', 'mensual')
      clearAllPeriodParams(params)
      params.set('year', String(year))
      params.set('month', String(month))
    })
  }

  function applyCustomIfReady(from: string, to: string) {
    if (!from || !to) return
    if (new Date(from) > new Date(to)) return
    const source = new URLSearchParams(latestParamsRef.current)
    const previousMode = source.get('periodo') ?? active
    if (previousMode !== 'custom') {
      const previous = new URLSearchParams()
      previous.set('periodo', previousMode)
      if (previousMode === 'anual') {
        previous.set('year', source.get('year') ?? String(effectiveYear))
      } else if (previousMode === 'diario') {
        previous.set('day', source.get('day') ?? toISO(selectedDayDate))
        previous.set('year', source.get('year') ?? String(selectedDayDate.getFullYear()))
      } else if (previousMode === 'semanal') {
        previous.set('weekStart', source.get('weekStart') ?? toISO(selectedWeekMonday))
        previous.set('year', source.get('year') ?? String(effectiveYear))
      } else {
        previous.set('year', source.get('year') ?? String(effectiveYear))
        previous.set('month', source.get('month') ?? String(effectiveMonth))
      }
      try { sessionStorage.setItem(CUSTOM_RETURN_PERIOD_KEY, previous.toString()) } catch { /* sessionStorage unavailable */ }
    }
    navigate((params) => {
      params.set('periodo', 'custom')
      clearAllPeriodParams(params)
      params.set('from', from)
      params.set('to', to)
    })
  }

  function clearCustom() {
    let previous = ''
    try {
      previous = sessionStorage.getItem(CUSTOM_RETURN_PERIOD_KEY) ?? ''
      sessionStorage.removeItem(CUSTOM_RETURN_PERIOD_KEY)
    } catch { /* sessionStorage unavailable */ }
    setCustomDraft({ from: '', to: '' })
    setRangoOpen(false)
    navigate((params) => {
      clearAllPeriodParams(params)
      if (previous) {
        new URLSearchParams(previous).forEach((value, key) => params.set(key, value))
      } else {
        params.set('periodo', 'mensual')
        params.set('year', String(currentYear))
        params.set('month', String(currentMonth))
      }
    })
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

  const selectClass = 'min-h-10 min-w-0 rounded-lg border border-gray-200 bg-white px-1.5 text-xs font-medium text-gray-800 outline-none transition focus:border-[#1E4B1C] focus:ring-2 focus:ring-[#1E4B1C]/15 disabled:opacity-50 sm:px-3 sm:text-sm dark:border-white/[0.08] dark:bg-black dark:text-gray-100'
  const yearOptions = Array.from({ length: 56 }, (_, index) => currentYear - 50 + index)
  if (Number.isInteger(effectiveYear) && !yearOptions.includes(effectiveYear)) {
    yearOptions.push(effectiveYear)
    yearOptions.sort((a, b) => a - b)
  }
  const coreActive: 'diario' | 'semanal' | 'mensual' =
    active === 'diario' || active === 'semanal' || active === 'mensual'
      ? active
      : selectedDay ? 'diario' : selectedWeekStart ? 'semanal' : 'mensual'
  const daysInYear = new Date(effectiveYear, 1, 29).getMonth() === 1 ? 366 : 365
  const dayOptions = Array.from({ length: daysInYear }, (_, index) => {
    const date = new Date(effectiveYear, 0, index + 1)
    return { value: toISO(date), label: date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) }
  })
  const weekOptions = getWeeksOfYear(effectiveYear)
  const dateValue = coreActive === 'diario'
    ? toISO(selectedDayDate)
    : active === 'semanal'
      ? toISO(selectedWeekMonday)
      : ''
  const monthValue = String(effectiveMonth)

  function changeSelectedYear(year: number) {
    if (active === 'anual') {
      navigate((params) => {
        params.set('year', String(year))
        if (coreActive === 'diario') {
          const day = Math.min(selectedDayDate.getDate(), new Date(year, selectedDayDate.getMonth() + 1, 0).getDate())
          params.set('day', toISO(new Date(year, selectedDayDate.getMonth(), day)))
        } else if (coreActive === 'semanal') {
          const oldWeeks = getWeeksOfYear(effectiveYear)
          const oldIndex = Math.max(0, oldWeeks.findIndex((monday) => toISO(monday) === toISO(selectedWeekMonday)))
          const nextWeeks = getWeeksOfYear(year)
          params.set('weekStart', toISO(nextWeeks[Math.min(oldIndex, nextWeeks.length - 1)]))
        }
      })
    } else if (coreActive === 'diario') {
      const day = Math.min(selectedDayDate.getDate(), new Date(year, selectedDayDate.getMonth() + 1, 0).getDate())
      selectDay(new Date(year, selectedDayDate.getMonth(), day))
    } else if (coreActive === 'semanal') {
      const oldWeeks = getWeeksOfYear(effectiveYear)
      const oldIndex = Math.max(0, oldWeeks.findIndex((monday) => toISO(monday) === toISO(selectedWeekMonday)))
      const nextWeeks = getWeeksOfYear(year)
      selectWeek(nextWeeks[Math.min(oldIndex, nextWeeks.length - 1)], year)
    } else {
      selectMonth(year, effectiveMonth)
    }
  }

  function changeSelectedPeriod(value: string) {
    if (coreActive === 'diario') {
      const day = dayOptions.find((option) => option.value === value)
      if (day) selectDay(new Date(`${day.value}T12:00:00`))
    } else if (coreActive === 'semanal') {
      const monday = weekOptions.find((option) => toISO(option) === value)
      if (monday) selectWeek(monday, effectiveYear)
    } else {
      const month = Number(value)
      if (month >= 1 && month <= 12) selectMonth(effectiveYear, month)
    }
  }

  const rangoRef = useRef<HTMLButtonElement>(null)
  const [rangoOpen, setRangoOpen] = useState(false)
  const rangoActual = (() => {
    const f = customDraft.from || customFrom
    const t = customDraft.to || customTo
    return f ? { from: new Date(f + 'T12:00:00'), to: t ? new Date(t + 'T12:00:00') : undefined } : undefined
  })()

  // Evita mismatch de hidratación por dependencia de `new Date()`.
  if (!mounted) return null

  return (
    <div className="w-full min-w-0 print:hidden">
      <div className="grid w-full min-w-0 grid-cols-[minmax(0,0.85fr)_minmax(0,1.2fr)_minmax(0,0.65fr)_minmax(0,1.3fr)] gap-1">
          <label className="block min-w-0">
            <span className="sr-only">Tipo de período</span>
            <select
              aria-label="Tipo de período"
              value={coreActive}
              onChange={(event) => {
                const next = PERIOD_TYPES.find((type) => type.key === event.target.value)
                if (next) selectCoreType(next.key)
              }}
              className={`${selectClass} w-full`}
            >
              {PERIOD_TYPES.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}
            </select>
          </label>

          <label className="block min-w-0">
            <span className="sr-only">
              {coreActive === 'diario' ? 'Día' : coreActive === 'semanal' ? 'Semana' : 'Mes'}
            </span>
            <select
              aria-label={coreActive === 'diario' ? 'Día' : coreActive === 'semanal' ? 'Semana' : 'Mes'}
              value={coreActive === 'diario' ? dateValue : coreActive === 'semanal' ? toISO(selectedWeekMonday) : monthValue}
              onChange={(event) => changeSelectedPeriod(event.target.value)}
              className={`${selectClass} w-full`}
            >
              {coreActive === 'diario' && dayOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
              {coreActive === 'semanal' && weekOptions.map((monday, index) => (
                <option key={toISO(monday)} value={toISO(monday)}>
                  Semana {index + 1} · {monday.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                </option>
              ))}
              {coreActive === 'mensual' && MONTH_NAMES.map((month, index) => (
                <option key={month} value={index + 1}>{month}</option>
              ))}
            </select>
          </label>

          <label className="block min-w-0">
            <span className="sr-only">Año</span>
            <select
              aria-label="Año del período"
              value={effectiveYear}
              onChange={(event) => changeSelectedYear(Number(event.target.value))}
              className={`${selectClass} w-full`}
            >
              {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>

          <div className="relative min-w-0">
            <button
              ref={rangoRef}
              type="button"
              onClick={() => setRangoOpen((v) => !v)}
              aria-expanded={rangoOpen}
              aria-label={customSummary ? `Personalizado: ${customSummary.label}, ${customSummary.days} días` : 'Elegir período personalizado'}
              aria-pressed={active === 'custom'}
              className={`flex min-h-10 w-full min-w-0 items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-left text-[10px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-700)] sm:gap-2 sm:px-2.5 sm:text-xs ${active === 'custom' ? 'border-[var(--brand-700)] bg-[var(--brand-700)] text-white dark:border-[#A8C89C] dark:bg-black dark:text-[#A8C89C]' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/[0.08] dark:bg-[#0d0e10] dark:text-gray-200 dark:hover:bg-white/[0.05]'}`}
            >
              <svg className="hidden h-4 w-4 shrink-0 sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <span className="min-w-0 flex-1 truncate">Personalizado{customSummary ? <span className="ml-1 font-normal opacity-75">· {customSummary.label}</span> : null}</span>
              <svg className={`hidden h-3.5 w-3.5 shrink-0 transition-transform sm:block ${rangoOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <CalendarPopover anchorRef={rangoRef} open={rangoOpen} onClose={() => setRangoOpen(false)}>
              <RangeCalendar
                value={rangoActual}
                onClear={active === 'custom' ? clearCustom : undefined}
                onChange={({ from, to }) => {
                  const next = { from: toISO(from), to: toISO(to) }
                  setCustomDraft(next)
                  applyCustomIfReady(next.from, next.to)
                  setRangoOpen(false)
                }}
              />
            </CalendarPopover>
          </div>
      </div>
    </div>
  )
}

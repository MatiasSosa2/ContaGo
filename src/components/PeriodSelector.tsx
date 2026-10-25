'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useHydrated } from '@/lib/useStoredValue'
import { CalendarPopover, RangeCalendar, SingleCalendar } from './ui/IosCalendar'

export const PERIOD_KEYS = ['diario', 'semanal', 'mensual', 'anual', 'custom'] as const
export type PeriodKey = typeof PERIOD_KEYS[number]

const PERIOD_QUERY_KEYS = ['periodo', 'day', 'weekStart', 'year', 'month', 'from', 'to'] as const
const PERIOD_STORAGE_KEY = 'contago:period'

const TABS: Array<{ key: PeriodKey; label: string }> = [
  { key: 'diario', label: 'Día' },
  { key: 'semanal', label: 'Semana' },
  { key: 'mensual', label: 'Mes' },
  { key: 'anual', label: 'Año' },
  { key: 'custom', label: 'Personalizado' },
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
  const effectiveYear = selectedYear ?? currentYear
  const effectiveMonth = selectedMonth ?? currentMonth

  const [customDraft, setCustomDraft] = useState<{ from: string; to: string }>({
    from: customFrom ?? '',
    to: customTo ?? '',
  })

  function navigate(mutator: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    mutator(params)
    const query = params.toString()
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

  function selectTab(next: PeriodKey) {
    if (next === active) return
    navigate((params) => {
      params.set('periodo', next)
      clearAllPeriodParams(params)
    })
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

  // Pantalla angosta: las flechas pasan directo al período anterior / siguiente
  function stepSelected(direction: -1 | 1) {
    if (active === 'diario') selectDay(addDays(selectedDayDate, direction))
    else if (active === 'semanal') selectWeek(addDays(selectedWeekMonday, 7 * direction))
    else if (active === 'anual') selectYear(effectiveYear + direction)
    else if (active === 'mensual') {
      const m = addMonths(effectiveYear, effectiveMonth, direction)
      selectMonth(m.year, m.month)
    }
  }

  function goToday() {
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

  // Flechas para avanzar o retroceder un período.
  const arrowBtnClass = 'h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-[#1B4332] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/[0.05] dark:hover:text-ds-green-300'

  const selectClass = 'min-h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 outline-none transition focus:border-[#1B4332] focus:ring-2 focus:ring-[#1B4332]/15 disabled:opacity-50 dark:border-white/[0.08] dark:bg-[#0d0e10] dark:text-gray-100'
  const yearOptions = Array.from({ length: 56 }, (_, index) => currentYear - 50 + index)
  if (Number.isInteger(effectiveYear) && !yearOptions.includes(effectiveYear)) {
    yearOptions.push(effectiveYear)
    yearOptions.sort((a, b) => a - b)
  }
  const periodDropdown = (
    <label className="flex shrink-0 items-center gap-2">
      <span className="sr-only">Período</span>
      <select
        aria-label="Período"
        value={active}
        disabled={pending}
        onChange={(event) => {
          const next = PERIOD_KEYS.find((key) => key === event.target.value)
          if (next) selectTab(next)
        }}
        className={`${selectClass} max-w-[min(11rem,42vw)]`}
      >
        {TABS.map((tab) => <option key={tab.key} value={tab.key}>{tab.label}</option>)}
      </select>
    </label>
  )

  // El selector del período abre un calendario o un panel de mes/año, según el tipo elegido.
  const calRef = useRef<HTMLButtonElement>(null)
  const rangoRef = useRef<HTMLButtonElement>(null)
  const [calOpen, setCalOpen] = useState(false)
  const [rangoOpen, setRangoOpen] = useState(false)
  const [datePickerDraft, setDatePickerDraft] = useState({ year: effectiveYear, month: effectiveMonth })

  function toggleDatePicker() {
    if (calOpen) {
      setCalOpen(false)
      return
    }
    setDatePickerDraft({ year: effectiveYear, month: effectiveMonth })
    setCalOpen(true)
  }

  function irAFecha(d: Date) {
    if (active === 'diario') selectDay(d)
    else if (active === 'semanal') selectWeek(getMondayOf(d))
    else if (active === 'anual') selectYear(d.getFullYear())
    else selectMonth(d.getFullYear(), d.getMonth() + 1)
    setCalOpen(false)
  }
  const fechaElegida =
    active === 'diario' ? selectedDayDate
      : active === 'semanal' ? selectedWeekMonday
      : active === 'anual' ? new Date(effectiveYear, 0, 1)
      : new Date(effectiveYear, effectiveMonth - 1, 1)
  const selectedPeriodLabel = active === 'diario'
    ? selectedDayDate.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : active === 'semanal'
      ? `${selectedWeekMonday.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} - ${addDays(selectedWeekMonday, 6).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : active === 'anual'
        ? String(effectiveYear)
        : new Date(effectiveYear, effectiveMonth - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const rangoActual = (() => {
    const f = customDraft.from || customFrom
    const t = customDraft.to || customTo
    return f ? { from: new Date(f + 'T12:00:00'), to: t ? new Date(t + 'T12:00:00') : undefined } : undefined
  })()

  // Evita mismatch de hidratación por dependencia de `new Date()`.
  if (!mounted) return null

  return (
    <div className="w-full print:hidden">
      {/* Período y fecha seleccionables en todos los tamaños */}
      {active !== 'custom' ? (
        <div className="flex flex-wrap items-center gap-1.5 lg:flex-nowrap lg:gap-2">
          {periodDropdown}

          <div className="flex min-w-0 flex-1 items-center gap-1 rounded-xl border border-gray-200 bg-white px-1 py-1 dark:border-white/[0.05] dark:bg-[#0d0e10]">
            <button
              type="button"
              onClick={() => stepSelected(-1)}
              disabled={pending}
              aria-label="Período anterior"
              className={`flex ${arrowBtnClass}`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              ref={calRef}
              type="button"
              onClick={toggleDatePicker}
              disabled={pending}
              aria-label={`Seleccionar período: ${selectedPeriodLabel}`}
              aria-expanded={calOpen}
              className="flex min-h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold capitalize text-gray-800 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B4332]/20 disabled:opacity-50 dark:text-gray-100 dark:hover:bg-white/[0.05]"
            >
              <span className="truncate">{selectedPeriodLabel}</span>
              <svg className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${calOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => stepSelected(1)}
              disabled={pending}
              aria-label="Período siguiente"
              className={`flex ${arrowBtnClass}`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <CalendarPopover anchorRef={calRef} open={calOpen} onClose={() => setCalOpen(false)} align="right">
            {active === 'mensual' || active === 'anual' ? (
              <div className="w-[min(20rem,calc(100vw-2rem))] p-4">
                <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
                  {active === 'mensual' ? 'Elegir mes' : 'Elegir año'}
                </h2>
                <div className={`grid gap-3 ${active === 'mensual' ? 'grid-cols-[minmax(0,1fr)_7rem]' : 'grid-cols-1'}`}>
                  {active === 'mensual' && (
                    <label className="min-w-0">
                      <span className="mb-1 block text-xs text-gray-500">Mes</span>
                      <select
                        aria-label="Mes"
                        value={datePickerDraft.month}
                        onChange={(event) => setDatePickerDraft((draft) => ({ ...draft, month: Number(event.target.value) }))}
                        className={`${selectClass} w-full`}
                      >
                        {MONTH_NAMES.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
                      </select>
                    </label>
                  )}
                  <label className="min-w-0">
                    <span className="mb-1 block text-xs text-gray-500">Año</span>
                    <select
                      aria-label="Año"
                      value={datePickerDraft.year}
                      onChange={(event) => setDatePickerDraft((draft) => ({ ...draft, year: Number(event.target.value) }))}
                      className={`${selectClass} w-full`}
                    >
                      {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </label>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDatePickerDraft({ year: currentYear, month: currentMonth })
                      if (active === 'mensual') selectMonth(currentYear, currentMonth)
                      else selectYear(currentYear)
                      setCalOpen(false)
                    }}
                    className="min-h-10 rounded-lg px-2 text-sm font-medium text-[#1B4332] hover:bg-gray-100 dark:text-ds-green-300 dark:hover:bg-white/[0.05]"
                  >
                    {active === 'mensual' ? 'Este mes' : 'Este año'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (active === 'mensual') selectMonth(datePickerDraft.year, datePickerDraft.month)
                      else selectYear(datePickerDraft.year)
                      setCalOpen(false)
                    }}
                    className="min-h-10 rounded-lg bg-[#1B4332] px-4 text-sm font-semibold text-white transition hover:bg-[#163a2b]"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            ) : (
              <SingleCalendar
                selected={fechaElegida}
                onSelect={irAFecha}
                footer={
                  <button
                    type="button"
                    onClick={() => { goToday(); setCalOpen(false) }}
                    className="mt-2 w-full border-t border-black/[0.06] pt-2 text-center text-[14px] font-medium text-[var(--ds-blue)] dark:border-white/10 dark:text-[var(--ds-blue-dark)]"
                  >
                    Hoy
                  </button>
                }
              />
            )}
          </CalendarPopover>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            {periodDropdown}
            <button
              type="button"
              onClick={clearCustom}
              disabled={pending}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.06] dark:bg-[#0d0e10] dark:text-gray-200"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a8 8 0 0114-3m2 9a8 8 0 01-14 3" />
              </svg>
              Limpiar
            </button>
          </div>
          <div className="mt-3">
            <button
              ref={rangoRef}
              type="button"
              onClick={() => setRangoOpen((v) => !v)}
              disabled={pending}
              aria-expanded={rangoOpen}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[14px] text-[var(--ds-gray-900)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition active:scale-[0.99] disabled:opacity-40 dark:bg-[var(--ds-gray-900)] dark:text-white"
            >
              <svg className="h-4 w-4 text-[var(--reg-accent,#2D6A4F)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              {customSummary ? (
                <span>{customSummary.label} <span className="text-[var(--ds-gray-500)]">· {customSummary.days} días</span></span>
              ) : (
                <span className="text-[var(--ds-gray-500)]">Elegir desde – hasta</span>
              )}
            </button>
            <CalendarPopover anchorRef={rangoRef} open={rangoOpen} onClose={() => setRangoOpen(false)}>
              <RangeCalendar
                value={rangoActual}
                onChange={({ from, to }) => {
                  const next = { from: toISO(from), to: toISO(to) }
                  setCustomDraft(next)
                  applyCustomIfReady(next.from, next.to)
                  setRangoOpen(false)
                }}
              />
            </CalendarPopover>
          </div>
        </>
      )}
    </div>
  )
}

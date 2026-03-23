'use client'

import { useMemo, useState } from 'react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { es } from 'date-fns/locale'

type ModalPeriodKey = 'diario' | 'ayer' | 'semanal' | 'mensual' | 'trimestral' | 'semestral' | 'anual' | 'custom'

type PeriodSelection = {
  period: ModalPeriodKey
  from?: string
  to?: string
}

type DashboardPresetSummary = {
  period: Exclude<ModalPeriodKey, 'custom'>
  periodLabel: string
  income: number
  expense: number
  gain: number
  incomeChangePct: number | null
  expenseChangePct: number | null
  gainChangePct: number | null
}

interface DateRangeModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (selection: PeriodSelection) => void
  initialPeriod?: ModalPeriodKey
  initialFrom?: string
  initialTo?: string
  presetSummaries: DashboardPresetSummary[]
}

const PRESET_LABELS: Record<ModalPeriodKey, string> = {
  diario: 'Día actual',
  ayer: 'Día anterior',
  semanal: 'Semanal',
  mensual: 'Mensual',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
  custom: 'Rango manual',
}

function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatCurrency(value: number) {
  return `$${Math.abs(value).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`
}

function formatDelta(value: number | null) {
  if (value === null) {
    return 's/d'
  }

  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}%`
}

function getDeltaColor(value: number | null) {
  if (value === null) {
    return 'text-stone-400'
  }

  return value >= 0 ? 'text-emerald-600' : 'text-red-500'
}

export default function DateRangeModal({
  open,
  onClose,
  onConfirm,
  initialPeriod,
  initialFrom,
  initialTo,
  presetSummaries,
}: DateRangeModalProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<ModalPeriodKey>(() => {
    if (initialPeriod) return initialPeriod
    return initialFrom && initialTo ? 'custom' : 'mensual'
  })

  const [range, setRange] = useState<DateRange | undefined>(() => {
    if (initialFrom && initialTo) {
      return { from: new Date(initialFrom + 'T12:00:00'), to: new Date(initialTo + 'T12:00:00') }
    }

    return undefined
  })

  const summary = useMemo(() => {
    if (selectedPeriod === 'custom') {
      if (!range?.from) {
        return 'Seleccioná un rango manual para recalcular el dashboard.'
      }

      const from = range.from.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
      const to = range.to
        ? range.to.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
        : '...'

      return `${from} → ${to}`
    }

    const preset = presetSummaries.find((item) => item.period === selectedPeriod)
    return preset?.periodLabel ?? PRESET_LABELS[selectedPeriod]
  }, [presetSummaries, range, selectedPeriod])

  function handleConfirm() {
    if (selectedPeriod === 'custom') {
      if (range?.from && range?.to) {
        onConfirm({ period: 'custom', from: toISO(range.from), to: toISO(range.to) })
      }
      return
    }

    onConfirm({ period: selectedPeriod })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-6xl overflow-hidden rounded-[30px] border border-stone-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <div className="flex items-start justify-between border-b border-stone-100 bg-[linear-gradient(135deg,_#fafaf9_0%,_#f5f5f4_100%)] px-6 py-5">
          <div>
            <h3 className="text-sm font-semibold text-stone-700">Seleccionar período</h3>
            <p className="mt-1 text-xs text-stone-500">Cada módulo muestra un resumen real del período y su variación frente al período anterior.</p>
          </div>

          <button onClick={onClose} className="text-stone-400 transition-colors hover:text-stone-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid lg:grid-cols-[1.2fr_1fr]">
          <div className="border-b border-stone-100 bg-[linear-gradient(180deg,_#ffffff_0%,_#fcfcfb_100%)] p-6 lg:border-b-0 lg:border-r contago-calendar">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Rango manual</p>
                <p className="mt-1 text-sm text-stone-500">Elegí el intervalo exacto si necesitás un corte distinto a los presets.</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPeriod('custom')}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                  selectedPeriod === 'custom'
                    ? 'bg-[#163527] text-[#bbf7d0]'
                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                }`}
              >
                Usar calendario
              </button>
            </div>

            <div className="flex justify-center">
              <DayPicker
                mode="range"
                selected={range}
                onSelect={(nextRange) => {
                  setSelectedPeriod('custom')
                  setRange(nextRange)
                }}
                locale={es}
                numberOfMonths={2}
                showOutsideDays
                fixedWeeks
                classNames={{
                  root: 'text-sm',
                  months: 'flex flex-col gap-6 md:flex-row',
                  month: 'space-y-3',
                  month_caption: 'flex justify-center items-center h-8 mb-1',
                  caption_label: 'text-sm font-semibold text-stone-700 capitalize',
                  nav: 'flex items-center justify-between absolute top-4 left-3 right-3',
                  button_previous: 'w-7 h-7 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-500',
                  button_next: 'w-7 h-7 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-500',
                  weekdays: 'flex',
                  weekday: 'w-9 h-8 flex items-center justify-center text-[11px] font-medium text-stone-400 uppercase',
                  week: 'flex',
                  day: 'w-9 h-9 flex items-center justify-center text-xs rounded-lg transition-colors',
                  day_button: 'w-full h-full flex items-center justify-center rounded-lg cursor-pointer hover:bg-emerald-50',
                  selected: 'bg-[#1B4332] text-white font-semibold hover:bg-[#1B4332]',
                  range_start: 'bg-[#1B4332] text-white rounded-l-lg rounded-r-none',
                  range_end: 'bg-[#1B4332] text-white rounded-r-lg rounded-l-none',
                  range_middle: 'bg-emerald-50 text-emerald-900 rounded-none',
                  today: 'font-bold text-[#2D6A4F]',
                  outside: 'text-stone-300',
                  disabled: 'text-stone-200 cursor-not-allowed',
                }}
              />
            </div>
          </div>

          <div className="bg-[linear-gradient(180deg,_#fafaf9_0%,_#ffffff_100%)] p-6">
            <div className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Módulos rápidos</p>
              <p className="mt-1 text-sm text-stone-500">Cada período muestra resumen y porcentajes reales contra el período anterior.</p>
            </div>

            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {presetSummaries.map((preset) => {
                const isActive = selectedPeriod === preset.period

                return (
                  <button
                    key={preset.period}
                    type="button"
                    onClick={() => setSelectedPeriod(preset.period)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition-all ${
                      isActive
                        ? 'border-[#163527] bg-[#163527] text-white shadow-[0_16px_30px_rgba(22,53,39,0.18)]'
                        : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-stone-700'}`}>{PRESET_LABELS[preset.period]}</p>
                        <p className={`mt-1 text-xs ${isActive ? 'text-emerald-200/90' : 'text-stone-500'}`}>{preset.periodLabel}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${isActive ? 'bg-white/10 text-emerald-200' : 'bg-stone-100 text-stone-500'}`}>
                        {formatCurrency(preset.gain)}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                      <div className={`rounded-xl px-2.5 py-2 ${isActive ? 'bg-white/8' : 'bg-stone-50'}`}>
                        <p className={`${isActive ? 'text-emerald-100/80' : 'text-stone-400'}`}>Ingresos</p>
                        <p className={`mt-1 font-semibold ${isActive ? 'text-white' : 'text-stone-700'}`}>{formatCurrency(preset.income)}</p>
                        <p className={`mt-1 font-semibold ${isActive ? 'text-emerald-200' : getDeltaColor(preset.incomeChangePct)}`}>{formatDelta(preset.incomeChangePct)}</p>
                      </div>
                      <div className={`rounded-xl px-2.5 py-2 ${isActive ? 'bg-white/8' : 'bg-stone-50'}`}>
                        <p className={`${isActive ? 'text-emerald-100/80' : 'text-stone-400'}`}>Egresos</p>
                        <p className={`mt-1 font-semibold ${isActive ? 'text-white' : 'text-stone-700'}`}>{formatCurrency(preset.expense)}</p>
                        <p className={`mt-1 font-semibold ${isActive ? 'text-emerald-200' : getDeltaColor(preset.expenseChangePct)}`}>{formatDelta(preset.expenseChangePct)}</p>
                      </div>
                      <div className={`rounded-xl px-2.5 py-2 ${isActive ? 'bg-white/8' : 'bg-stone-50'}`}>
                        <p className={`${isActive ? 'text-emerald-100/80' : 'text-stone-400'}`}>Resultado</p>
                        <p className={`mt-1 font-semibold ${isActive ? 'text-white' : 'text-stone-700'}`}>{formatCurrency(preset.gain)}</p>
                        <p className={`mt-1 font-semibold ${isActive ? 'text-emerald-200' : getDeltaColor(preset.gainChangePct)}`}>{formatDelta(preset.gainChangePct)}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Selección activa</p>
              <p className="mt-2 text-sm text-stone-700">{summary}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-stone-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-700"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedPeriod === 'custom' && (!range?.from || !range?.to)}
            className="rounded-lg px-4 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: selectedPeriod !== 'custom' || (range?.from && range?.to) ? '#1B4332' : '#d1d5db',
              color: selectedPeriod !== 'custom' || (range?.from && range?.to) ? '#6EE7B7' : '#9ca3af',
            }}
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  )
}
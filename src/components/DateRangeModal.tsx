'use client'

import { useEffect, useState } from 'react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { es } from 'date-fns/locale'

type ModalPeriodKey = 'ayer' | 'semanal' | 'mensual' | 'semestral' | 'anual' | 'custom'

type PeriodSelection = {
  period: ModalPeriodKey
  from?: string
  to?: string
}

interface DateRangeModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (selection: PeriodSelection) => void
  initialFrom?: string
  initialTo?: string
  initialPeriod?: ModalPeriodKey
}

const QUICK_PRESETS: Array<{
  key: Exclude<ModalPeriodKey, 'custom'>
  label: string
}> = [
  { key: 'ayer', label: 'Ayer' },
  { key: 'semanal', label: 'Semanal' },
  { key: 'mensual', label: 'Mensual' },
  { key: 'semestral', label: 'Semestral' },
  { key: 'anual', label: 'Anual' },
]

function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function DateRangeModal({
  open,
  onClose,
  onConfirm,
  initialFrom,
  initialTo,
  initialPeriod = 'custom',
}: DateRangeModalProps) {
  const [range, setRange] = useState<DateRange | undefined>()
  const [selectedPreset, setSelectedPreset] = useState<ModalPeriodKey>(initialFrom && initialTo ? 'custom' : initialPeriod)

  useEffect(() => {
    if (!open) return

    if (initialFrom && initialTo) {
      setRange({ from: new Date(initialFrom + 'T12:00:00'), to: new Date(initialTo + 'T12:00:00') })
      setSelectedPreset('custom')
      return
    }

    setRange(undefined)
    setSelectedPreset(initialPeriod)
  }, [initialFrom, initialPeriod, initialTo, open])

  function handleConfirm() {
    if (selectedPreset !== 'custom') {
      onConfirm({ period: selectedPreset })
      return
    }

    if (range?.from && range?.to) {
      onConfirm({ period: 'custom', from: toISO(range.from), to: toISO(range.to) })
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 sm:p-6">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />

      <div className="relative my-4 flex max-h-[calc(100vh-56px)] w-full max-w-[760px] flex-col overflow-hidden rounded-[22px] border border-stone-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)] sm:max-h-[calc(100vh-72px)]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-xl border border-stone-200 bg-white/95 text-stone-500 shadow-sm transition-colors hover:text-stone-700"
          aria-label="Cerrar modal"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="border-b border-stone-100 px-4 py-3 pr-14 sm:px-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Periodo</p>
          <h3 className="mt-0.5 text-base font-semibold text-stone-900">Seleccionar período</h3>
          <p className="mt-0.5 text-sm text-stone-500">Elegí un rango manual o aplicá un atajo rápido.</p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row">
          <div className="min-w-0 flex-1 border-b border-stone-100 bg-stone-50/55 lg:border-b-0 lg:border-r lg:border-stone-100">
            <div className="p-2.5 sm:p-3 lg:p-3.5">
              <div className="rounded-[18px] border border-stone-200 bg-white p-2 shadow-[0_8px_30px_rgba(15,23,42,0.05)] contago-calendar">
                <div className="mb-2 flex items-start justify-between gap-2 border-b border-stone-100 pb-2 pr-10">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Calendario</p>
                    <p className="mt-0.5 text-sm text-stone-500">Definí fecha desde y hasta.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPreset('custom')}
                    className="rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition-colors"
                    style={
                      selectedPreset === 'custom'
                        ? { background: '#1B4332', color: '#D8F3DC', borderColor: '#1B4332' }
                        : { background: '#FFFFFF', color: '#57534E', borderColor: '#E7E5E4' }
                    }
                  >
                    Rango personalizado
                  </button>
                </div>

                <div className="flex justify-center pt-0.5">
                  <DayPicker
                    mode="range"
                    selected={range}
                    onSelect={(nextRange) => {
                      setRange(nextRange)
                      setSelectedPreset('custom')
                    }}
                    locale={es}
                    numberOfMonths={1}
                    showOutsideDays
                    fixedWeeks
                    classNames={{
                      root: 'relative text-sm',
                      months: 'flex flex-col',
                      month: 'space-y-2',
                      month_caption: 'relative flex items-center justify-center h-9 px-10',
                      caption_label: 'text-[13px] font-semibold text-stone-800 capitalize',
                      nav: 'absolute inset-x-0 top-1 flex items-center justify-between px-1',
                      button_previous: 'flex h-7 w-7 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 transition hover:border-stone-300 hover:text-stone-800',
                      button_next: 'flex h-7 w-7 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 transition hover:border-stone-300 hover:text-stone-800',
                      weekdays: 'mt-1.5 flex',
                      weekday: 'flex h-7 w-9 items-center justify-center text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400',
                      week: 'mt-0.5 flex',
                      day: 'h-9 w-9 text-xs rounded-lg transition-colors',
                      day_button: 'flex h-9 w-9 items-center justify-center rounded-lg text-[13px] transition-colors hover:bg-emerald-50',
                      selected: 'bg-[#1B4332] text-white font-semibold hover:bg-[#1B4332]',
                      range_start: 'bg-[#1B4332] text-white rounded-l-xl rounded-r-none',
                      range_end: 'bg-[#1B4332] text-white rounded-r-xl rounded-l-none',
                      range_middle: 'bg-emerald-50 text-emerald-900 rounded-none',
                      today: 'font-semibold text-[#2D6A4F]',
                      outside: 'text-stone-300',
                      disabled: 'text-stone-200 cursor-not-allowed',
                    }}
                  />
                </div>

                <div className="mt-2 rounded-2xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-sm text-stone-600">
                  {range?.from ? (
                    <>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Rango elegido</p>
                      <p className="mt-1 font-medium text-stone-800">
                        {range.from.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {range.to ? ` → ${range.to.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}` : ' → ...'}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Rango elegido</p>
                      <p className="mt-1 text-stone-500">Seleccioná un inicio y un fin para aplicar un período personalizado.</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <aside className="w-full bg-white lg:w-[228px] lg:shrink-0">
            <div className="flex h-full flex-col p-2.5 sm:p-3 lg:p-3.5">
              <div className="mb-2 pr-10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Accesos rápidos</p>
                <p className="mt-0.5 text-sm text-stone-500">Elegí un período listo para aplicar.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                {QUICK_PRESETS.map((preset) => {
                  const isActive = selectedPreset === preset.key

                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => setSelectedPreset(preset.key)}
                      className="rounded-xl border px-3 py-1.5 text-left transition-all"
                      style={
                        isActive
                          ? { background: '#1B4332', color: '#D8F3DC', borderColor: '#1B4332', boxShadow: '0 10px 24px rgba(27,67,50,0.16)' }
                          : { background: '#FFFFFF', color: '#292524', borderColor: '#E7E5E4' }
                      }
                    >
                      <span className="block text-[13px] font-semibold">{preset.label}</span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-2.5 rounded-xl border border-dashed border-stone-200 bg-stone-50 px-3 py-2 text-[11px] leading-4 text-stone-500">
                El período seleccionado se comparará con los datos del período anterior.
              </div>

              <div className="mt-auto flex items-center justify-end gap-2 border-t border-stone-100 pt-3">
                <button
                  onClick={onClose}
                  className="rounded-xl px-3.5 py-2 text-xs font-semibold text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={selectedPreset === 'custom' && (!range?.from || !range?.to)}
                  className="rounded-xl px-3.5 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    background: '#1B4332',
                    color: '#D8F3DC',
                  }}
                >
                  Aplicar
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
'use client'

import { useState, useEffect, useCallback } from 'react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { es } from 'date-fns/locale'

interface DateRangeModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (from: string, to: string) => void
  initialFrom?: string
  initialTo?: string
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DateRangeModal({ open, onClose, onConfirm, initialFrom, initialTo }: DateRangeModalProps) {
  const [range, setRange] = useState<DateRange | undefined>(() => {
    if (initialFrom && initialTo) {
      return { from: new Date(initialFrom + 'T12:00:00'), to: new Date(initialTo + 'T12:00:00') }
    }
    return undefined
  })

  useEffect(() => {
    if (open && initialFrom && initialTo) {
      setRange({ from: new Date(initialFrom + 'T12:00:00'), to: new Date(initialTo + 'T12:00:00') })
    }
  }, [open, initialFrom, initialTo])

  const handleConfirm = useCallback(() => {
    if (range?.from && range?.to) {
      onConfirm(toISO(range.from), toISO(range.to))
    }
  }, [range, onConfirm])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-sm w-full overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Seleccionar período</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Calendar */}
        <div className="p-4 flex justify-center contago-calendar">
          <DayPicker
            mode="range"
            selected={range}
            onSelect={setRange}
            locale={es}
            numberOfMonths={1}
            showOutsideDays
            fixedWeeks
            classNames={{
              root: 'text-sm',
              months: 'flex flex-col',
              month_caption: 'flex justify-center items-center h-8 mb-1',
              caption_label: 'text-sm font-semibold text-gray-700 capitalize',
              nav: 'flex items-center justify-between absolute top-4 left-3 right-3',
              button_previous: 'w-7 h-7 flex items-center justify-center rounded-lg hover:bg-stone-100 text-gray-500',
              button_next: 'w-7 h-7 flex items-center justify-center rounded-lg hover:bg-stone-100 text-gray-500',
              weekdays: 'flex',
              weekday: 'w-9 h-8 flex items-center justify-center text-[11px] font-medium text-gray-400 uppercase',
              week: 'flex',
              day: 'w-9 h-9 flex items-center justify-center text-xs rounded-lg transition-colors',
              day_button: 'w-full h-full flex items-center justify-center rounded-lg cursor-pointer hover:bg-emerald-50',
              selected: 'bg-[#1B4332] text-white font-semibold hover:bg-[#1B4332]',
              range_start: 'bg-[#1B4332] text-white rounded-l-lg rounded-r-none',
              range_end: 'bg-[#1B4332] text-white rounded-r-lg rounded-l-none',
              range_middle: 'bg-emerald-50 text-emerald-900 rounded-none',
              today: 'font-bold text-[#2D6A4F]',
              outside: 'text-gray-300',
              disabled: 'text-gray-200 cursor-not-allowed',
            }}
          />
        </div>

        {/* Selected range summary */}
        {range?.from && (
          <div className="px-5 pb-2 text-center">
            <p className="text-xs text-gray-400">
              {range.from.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
              {range.to ? ` → ${range.to.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}` : ' → ...'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="px-5 py-3.5 border-t border-stone-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!range?.from || !range?.to}
            className="px-4 py-2 text-xs font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: range?.from && range?.to ? '#1B4332' : '#d1d5db',
              color: range?.from && range?.to ? '#6EE7B7' : '#9ca3af',
            }}
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  )
}

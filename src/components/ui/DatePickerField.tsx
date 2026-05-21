'use client'

import { useEffect, useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { es } from 'date-fns/locale'
import 'react-day-picker/dist/style.css'

type Props = {
  value: string // ISO yyyy-mm-dd
  onChange: (iso: string) => void
  disabled?: boolean
  className?: string
  placeholder?: string
}

function toIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fromIso(s: string): Date | undefined {
  if (!s) return undefined
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

function formatLabel(d: Date | undefined): string {
  if (!d) return ''
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

export default function DatePickerField({ value, onChange, disabled, className, placeholder }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = fromIso(value)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-black/[0.08] bg-white py-2.5 px-3 text-sm font-medium text-gray-700 outline-none transition-all hover:border-gray-300 focus:border-brand-military disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-zinc-900 dark:text-gray-200"
      >
        <span className={selected ? '' : 'text-gray-400'}>
          {selected ? formatLabel(selected) : (placeholder ?? 'Seleccionar fecha')}
        </span>
        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 rounded-2xl border border-black/[0.08] bg-white p-3 shadow-2xl dark:border-white/10 dark:bg-zinc-900">
          <DayPicker
            mode="single"
            locale={es}
            selected={selected}
            onSelect={(d) => {
              if (d) {
                onChange(toIso(d))
                setOpen(false)
              }
            }}
            showOutsideDays
            className="contago-daypicker text-sm"
            classNames={{
              caption_label: 'text-sm font-semibold text-gray-700 capitalize',
              nav_button: 'rounded-lg p-1 hover:bg-gray-100 transition-colors',
              head_cell: 'text-[10px] font-bold uppercase tracking-wider text-gray-400 pb-1',
              day: 'h-8 w-8 rounded-lg text-sm font-medium hover:bg-brand-military/10 transition-colors',
              day_selected: 'bg-brand-military text-white hover:bg-brand-military-dark hover:text-white',
              day_today: 'font-bold text-brand-military',
              day_outside: 'text-gray-300',
            }}
          />
          <button
            type="button"
            onClick={() => { onChange(toIso(new Date())); setOpen(false) }}
            className="mt-2 w-full rounded-lg border border-black/[0.08] bg-gray-50 py-2 text-xs font-bold uppercase tracking-wider text-gray-600 transition-colors hover:bg-gray-100"
          >
            Hoy
          </button>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker, type DateRange } from 'react-day-picker'
import { es } from 'react-day-picker/locale'

/**
 * Calendario estilo iOS (react-day-picker) para elegir un día o un rango, en una ventanita
 * flotante. El color sale de --reg-accent (verde por defecto).
 */

export const IOS_CALENDAR_CLASSES = {
  root: 'text-[13px] text-[#1C1C1E] dark:text-white',
  months: 'relative',
  month_caption: 'flex h-8 items-center px-1 text-[15px] font-semibold capitalize',
  nav: 'absolute right-0 top-0 flex h-8 items-center gap-1',
  button_previous: 'flex h-7 w-7 items-center justify-center rounded-full text-[var(--reg-accent,#34C759)] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:fill-current',
  button_next: 'flex h-7 w-7 items-center justify-center rounded-full text-[var(--reg-accent,#34C759)] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:fill-current',
  weekdays: 'flex',
  weekday: 'w-9 pb-1 text-center text-[11px] font-medium uppercase text-[#8E8E93]',
  week: 'flex',
  day: 'h-9 w-9 p-0 text-center',
  day_button: 'h-9 w-9 rounded-full text-[14px] tabular-nums transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.08]',
  selected: '[&>button]:bg-[var(--reg-accent,#34C759)] [&>button]:font-semibold [&>button]:text-white [&>button]:hover:bg-[var(--reg-accent,#34C759)]',
  // Rango: extremos en círculo de color y el medio en una franja suave
  range_start: 'rounded-l-full bg-[var(--reg-accent,#34C759)]/15',
  range_end: 'rounded-r-full bg-[var(--reg-accent,#34C759)]/15',
  range_middle: 'bg-[var(--reg-accent,#34C759)]/15 [&>button]:!bg-transparent [&>button]:!font-normal [&>button]:!text-[#1C1C1E] dark:[&>button]:!text-white',
  today: 'font-semibold text-[var(--reg-accent,#34C759)]',
  outside: 'text-[#C7C7CC] dark:text-[#48484A]',
  disabled: 'opacity-30',
}

/** Ventanita flotante anclada a un botón; se cierra al tocar afuera o con Esc */
export function CalendarPopover({ anchorRef, open, onClose, children, align = 'left' }: {
  anchorRef: RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
  children: ReactNode
  align?: 'left' | 'right'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<CSSProperties | null>(null)

  useEffect(() => {
    if (!open) return
    const r = anchorRef.current?.getBoundingClientRect()
    if (!r) return
    const ancho = 300
    const abajo = window.innerHeight - r.bottom
    const left = align === 'right'
      ? Math.max(8, Math.min(r.right - ancho, window.innerWidth - ancho - 8))
      : Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8))
    const accent = getComputedStyle(anchorRef.current!).getPropertyValue('--reg-accent').trim()
    const color = accent ? ({ '--reg-accent': accent } as CSSProperties) : {}
    setPos(abajo >= 380 || abajo >= r.top
      ? { ...color, top: r.bottom + 6, left }
      : { ...color, bottom: window.innerHeight - r.top + 6, left })
  }, [open, anchorRef, align])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!ref.current?.contains(t) && !anchorRef.current?.contains(t)) onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', onClose)
    }
  }, [open, onClose, anchorRef])

  if (!open || !pos) return null
  return createPortal(
    <div
      ref={ref}
      style={pos}
      className="fixed z-[80] w-[300px] rounded-2xl bg-[#fff]/95 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.22)] ring-1 ring-black/[0.06] backdrop-blur-xl animate-[reg-pop-in_160ms_ease-out] dark:bg-[#2C2C2E]/95 dark:ring-white/10"
    >
      {children}
    </div>,
    document.body,
  )
}

/** Un día */
export function SingleCalendar({ selected, onSelect, footer }: {
  selected?: Date
  onSelect: (d: Date) => void
  footer?: ReactNode
}) {
  return (
    <>
      <DayPicker
        mode="single"
        locale={es}
        selected={selected}
        defaultMonth={selected}
        onSelect={(d) => d && onSelect(d)}
        showOutsideDays
        weekStartsOn={1}
        classNames={IOS_CALENDAR_CLASSES}
      />
      {footer}
    </>
  )
}

/**
 * Rango desde–hasta en un solo calendario: el primer toque marca "desde", el segundo "hasta"
 * (si es anterior, se invierten) y recién ahí avisa con onChange.
 */
export function RangeCalendar({ value, onChange, onClear }: {
  value: DateRange | undefined
  onChange: (r: { from: Date; to: Date }) => void
  /** Si está, muestra "Limpiar" (ej. volver a todas las fechas) */
  onClear?: () => void
}) {
  const [draft, setDraft] = useState<DateRange | undefined>(value)
  const elegir = (d: Date) => {
    if (!draft?.from || draft.to) { setDraft({ from: d, to: undefined }); return }
    const [from, to] = d < draft.from ? [d, draft.from] : [draft.from, d]
    setDraft({ from, to })
    onChange({ from, to })
  }
  return (
    <>
      <DayPicker
        mode="range"
        locale={es}
        selected={draft}
        defaultMonth={draft?.from}
        onSelect={(_, d) => elegir(d)}
        showOutsideDays
        weekStartsOn={1}
        classNames={IOS_CALENDAR_CLASSES}
      />
      <div className="mt-2 flex items-center justify-between border-t border-black/[0.06] pt-2 text-[13px] dark:border-white/10">
        <span className="text-[#8E8E93]">{rangeLabel(draft) ?? 'Tocá el primer y el último día'}</span>
        {onClear && (
          <button type="button" onClick={() => { setDraft(undefined); onClear() }} className="font-medium text-[#007AFF] dark:text-[#0A84FF]">
            Limpiar
          </button>
        )}
      </div>
    </>
  )
}

const fmtCorto = (d: Date) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '')

/** "3 sep – 14 sep · 12 días" */
export function rangeLabel(r: DateRange | undefined) {
  if (!r?.from) return null
  if (!r.to) return `${fmtCorto(r.from)} – …`
  const dias = Math.round((r.to.getTime() - r.from.getTime()) / 86_400_000) + 1
  return `${fmtCorto(r.from)} – ${fmtCorto(r.to)} · ${dias} ${dias === 1 ? 'día' : 'días'}`
}

export type { DateRange }

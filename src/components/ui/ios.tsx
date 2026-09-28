'use client'

/**
 * Piezas visuales estilo iOS para la pestaña de registración:
 * listas agrupadas con esquinas redondeadas, filas de 44 px, separadores finos,
 * números con la tipografía del sistema (tabulares) y controles segmentados.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker } from 'react-day-picker'
import { es } from 'date-fns/locale'

export const IOS_FONT = 'font-[-apple-system,BlinkMacSystemFont,"SF_Pro_Text","Segoe_UI",Inter,system-ui,sans-serif] tabular-nums'

/** Título chico sobre un grupo ("Productos", "Pago") */
export function Caption({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-1.5 mt-5 flex items-baseline justify-between px-4 first:mt-0">
      <p className="text-[13px] text-[#8E8E93]">{children}</p>
      {right}
    </div>
  )
}

/** Tarjeta blanca redondeada que agrupa filas */
export function Group({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    // Sin overflow-hidden para que los menús flotantes de adentro no se corten
    <div className={`rounded-xl bg-[#fff] dark:bg-[#1C1C1E] [&>*:first-child]:rounded-t-xl [&>*:last-child]:rounded-b-xl [&>*+*]:border-t [&>*+*]:border-black/[0.08] dark:[&>*+*]:border-white/[0.08] ${className}`}>
      {children}
    </div>
  )
}

/** Fila de 44 px: etiqueta a la izquierda, valor a la derecha */
export function Row({ label, sub, value, onClick, chevron, className = '', children }: {
  label?: ReactNode
  sub?: ReactNode
  value?: ReactNode
  onClick?: () => void
  chevron?: boolean
  className?: string
  children?: ReactNode
}) {
  const content = children ?? (
    <>
      <div className="min-w-0">
        <div className="truncate text-[15px] text-[#1C1C1E] dark:text-white">{label}</div>
        {sub && <div className="truncate text-[12px] text-[#8E8E93]">{sub}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 text-[15px] text-[#8E8E93]">
        {value}
        {chevron && <Chevron />}
      </div>
    </>
  )
  const cls = `flex min-h-[44px] w-full items-center justify-between gap-3 px-4 py-2 text-left ${className}`
  return onClick
    ? <button type="button" onClick={onClick} className={`${cls} transition-colors active:bg-black/[0.04] dark:active:bg-white/[0.06]`}>{content}</button>
    : <div className={cls}>{content}</div>
}

export function Chevron({ open }: { open?: boolean }) {
  return (
    <svg className={`h-3.5 w-3.5 text-[#C7C7CC] transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

/** Control segmentado (Efectivo | Virtual | Crédito) */
export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-[9px] bg-[#767680]/[0.12] p-0.5 dark:bg-[#767680]/[0.24]" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-[7px] py-1.5 text-[13px] transition-all ${
            value === o.value
              ? 'bg-[#fff] font-medium text-[#1C1C1E] shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-[#636366] dark:text-white'
              : 'text-[#1C1C1E] dark:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Campo numérico sin bordes, alineado a la derecha (para filas) */
export const INLINE_INPUT_CLS =
  'ios-bare w-28 bg-transparent text-right text-[15px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] dark:text-white tabular-nums'

/** Select nativo sin bordes, alineado a la derecha (para filas) */
export const INLINE_SELECT_CLS =
  'ios-bare max-w-[200px] appearance-none bg-transparent text-right text-[15px] text-[#8E8E93] outline-none'

/**
 * Botón principal grande y redondeado. Con `slot` se dibuja en una tarjeta flotante
 * aparte, debajo de la pestaña (más minimalista); sin slot, al pie del formulario.
 */
export function PrimaryButton({ children, onClick, disabled, color = 'green', slot }: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  color?: 'green' | 'red' | 'gray'
  slot?: HTMLElement | null
}) {
  const bg = color === 'green' ? 'bg-brand-military hover:bg-brand-military-dark' : color === 'red' ? 'bg-brand-oxide hover:bg-[#8B4A3F]' : 'bg-zinc-700 hover:bg-zinc-800'
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-xl py-3.5 text-[16px] font-medium text-white transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${IOS_FONT} ${bg}`}
    >
      {children}
    </button>
  )
  if (slot) {
    // Flotante: el botón solo, con sombra, sin marco alrededor
    return createPortal(
      <div className="rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.25)] animate-in fade-in duration-200">{button}</div>,
      slot,
    )
  }
  return <div className="mt-6">{button}</div>
}

/** Texto-botón discreto en el color de acento */
export function LinkButton({ children, onClick, tone = 'accent' }: { children: ReactNode; onClick: () => void; tone?: 'accent' | 'muted' | 'danger' }) {
  const color = tone === 'accent' ? 'text-brand-military dark:text-[#9AC7A8]' : tone === 'danger' ? 'text-[#FF3B30]' : 'text-[#8E8E93]'
  return (
    <button type="button" onClick={onClick} className={`text-[15px] ${color} transition-opacity active:opacity-60`}>
      {children}
    </button>
  )
}

/** Cierra un menú flotante al tocar afuera o con Esc */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close() } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, close])
  return ref
}

const POPOVER_CLS =
  'absolute top-full z-40 mt-1 overflow-hidden rounded-xl bg-[#fff]/95 shadow-[0_12px_40px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.06] backdrop-blur-xl dark:bg-[#2C2C2E]/95 dark:ring-white/10'

/** Menú desplegable estilo iOS (reemplaza al <select> nativo) */
export function MenuSelect<T extends string>({ value, options, onChange, align = 'right', tone = 'muted', label, size = 'md' }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  align?: 'left' | 'right'
  /** muted: valor gris (a la derecha de una fila); strong: texto principal */
  tone?: 'muted' | 'strong'
  label: string
  /** sm: 13 px (tarjetitas de Más datos) */
  size?: 'sm' | 'md'
}) {
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  const current = options.find((o) => o.value === value)
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className={`flex max-w-full items-center gap-1 ${size === 'sm' ? 'text-[13px]' : 'text-[15px]'} transition-opacity active:opacity-60 ${tone === 'strong' ? 'font-medium text-[#1C1C1E] dark:text-white' : 'text-[#8E8E93]'}`}
      >
        <span className="max-w-[180px] truncate">{current?.label ?? '—'}</span>
      </button>
      {open && (
        <div role="listbox" className={`${POPOVER_CLS} min-w-[180px] py-1 ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => { onChange(o.value); setOpen(false) }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] text-[#1C1C1E] transition-colors hover:bg-black/[0.05] dark:text-white dark:hover:bg-white/[0.08]"
            >
              <span className="w-4 text-brand-military dark:text-[#9AC7A8]">{o.value === value ? '✓' : ''}</span>
              <span className="truncate">{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function isoToDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function dateToIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Fecha como texto ("27 oct 2026") que abre un calendario compacto flotante */
export function DateChip({ value, onChange, label, align = 'left' }: {
  value: string
  onChange: (iso: string) => void
  label: string
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  const selected = value ? isoToDate(value) : undefined
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        className="border-b border-transparent text-[13px] text-[#8E8E93] transition-colors hover:border-black/10 dark:hover:border-white/15"
      >
        {selected ? selected.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '') : 'Elegir fecha'}
      </button>
      {open && (
        <div className={`${POPOVER_CLS} p-3 ${align === 'right' ? 'right-0' : 'left-0'}`}>
          <DayPicker
            mode="single"
            locale={es}
            selected={selected}
            defaultMonth={selected}
            onSelect={(d) => { if (d) { onChange(dateToIso(d)); setOpen(false) } }}
            showOutsideDays
            classNames={{
              root: 'text-[13px] text-[#1C1C1E] dark:text-white',
              months: 'relative',
              month_caption: 'flex h-8 items-center px-1 text-[14px] font-semibold capitalize',
              nav: 'absolute right-0 top-0 flex h-8 items-center gap-1',
              button_previous: 'flex h-7 w-7 items-center justify-center rounded-full text-brand-military hover:bg-black/[0.05] dark:text-[#9AC7A8] dark:hover:bg-white/[0.08] [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:fill-current',
              button_next: 'flex h-7 w-7 items-center justify-center rounded-full text-brand-military hover:bg-black/[0.05] dark:text-[#9AC7A8] dark:hover:bg-white/[0.08] [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:fill-current',
              weekdays: 'flex',
              weekday: 'w-8 pb-1 text-center text-[11px] font-medium uppercase text-[#8E8E93]',
              week: 'flex',
              day: 'h-8 w-8 p-0 text-center',
              day_button: 'h-8 w-8 rounded-full text-[13px] transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.08]',
              selected: '[&>button]:bg-brand-military [&>button]:font-semibold [&>button]:text-white [&>button]:hover:bg-brand-military',
              today: 'font-semibold text-brand-military dark:text-[#9AC7A8]',
              outside: 'text-[#C7C7CC] dark:text-[#48484A]',
            }}
          />
        </div>
      )}
    </div>
  )
}


/** Tarjetita flotante chica (ej. Cliente / Empleado en Más datos): etiqueta arriba y valor abajo */
export function MiniCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-[#fff] px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:bg-[#1C1C1E]">
      <p className="text-[11px] text-[#8E8E93]">{label}</p>
      <div className="mt-0.5 min-w-0">{children}</div>
    </div>
  )
}

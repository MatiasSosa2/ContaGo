'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type BienDeUsoItem = {
  id: string
  nombre: string
  categoria: string | null
  marca: string | null
  valorAdquisicion: number
  depreciacionAcumulada: number
}

type Props = {
  bienes: BienDeUsoItem[]
  value: string
  onChange: (id: string) => void
  onAddNew?: () => void
}

export default function BienDeUsoCombobox({ bienes, value, onChange, onAddNew }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selected = useMemo(() => bienes.find((b) => b.id === value), [bienes, value])
  const filtered = useMemo(() => {
    if (!q.trim()) return bienes.slice(0, 5)
    const ql = q.toLowerCase()
    return bienes.filter((b) => b.nombre.toLowerCase().includes(ql) || (b.marca ?? '').toLowerCase().includes(ql)).slice(0, 5)
  }, [bienes, q])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(true); setQ('') }}
        className="flex w-full items-center justify-between rounded-xl border border-black/[0.08] bg-white py-2.5 px-3 text-sm font-medium text-gray-700 outline-none transition-all hover:border-gray-300 focus:border-brand-military dark:border-white/10 dark:bg-zinc-900 dark:text-gray-200"
      >
        <span className={selected ? '' : 'text-gray-400'}>
          {selected ? selected.nombre : 'Seleccionar bien de uso'}
        </span>
        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-xl dark:border-white/10 dark:bg-zinc-900">
          <input
            autoFocus
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar bien de uso..."
            className="w-full border-b border-black/[0.06] bg-gray-50 px-3 py-2.5 text-sm outline-none placeholder:text-gray-400 dark:border-white/10 dark:bg-zinc-800"
          />
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-gray-400">Sin bienes de uso</div>
          ) : filtered.map((b) => {
            const valorNeto = Math.max(0, b.valorAdquisicion - b.depreciacionAcumulada)
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => { onChange(b.id); setOpen(false) }}
                className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors hover:bg-brand-military/5 ${
                  value === b.id ? 'bg-brand-military/10 text-brand-military-dark font-semibold' : 'text-gray-700 dark:text-gray-200'
                }`}
              >
                <span>{b.nombre}</span>
                <span className="text-[11px] font-normal text-gray-400">
                  {[b.categoria, b.marca].filter(Boolean).join(' · ')}
                  {' · valor neto $'}{valorNeto.toLocaleString('es-AR')}
                </span>
              </button>
            )
          })}
          {onAddNew && (
            <button
              type="button"
              onClick={() => { setOpen(false); onAddNew() }}
              className="flex w-full items-center gap-2 border-t border-black/[0.06] bg-gray-50/50 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-brand-military hover:bg-brand-military/5"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Cargar nuevo bien de uso
            </button>
          )}
        </div>
      )}
    </div>
  )
}

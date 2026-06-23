'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

export type ProductoItem = {
  id: string
  nombre: string
  categoria: string | null
  marca: string | null
  precioVenta: number
  precioCosto: number
  stockActual: number
  tipo?: string // 'MERCADERIA' | 'SERVICIO'
}

type Props = {
  productos: ProductoItem[]
  filterTipo?: 'MERCADERIA' | 'SERVICIO' // si está seteado, filtra
  value: string
  onChange: (id: string) => void
  placeholder?: string
}

function score(p: ProductoItem, q: string): number {
  if (!q) return 0
  const ql = q.toLowerCase()
  const nombre = p.nombre.toLowerCase()
  const marca = (p.marca ?? '').toLowerCase()
  const cat = (p.categoria ?? '').toLowerCase()
  if (nombre.startsWith(ql)) return 100
  if (nombre.includes(ql)) return 80
  if (marca.includes(ql)) return 50
  if (cat.includes(ql)) return 40
  return 0
}

export default function ProductoServicioCombobox({ productos, filterTipo, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const pool = useMemo(() => {
    if (!filterTipo) return productos
    return productos.filter((p) => (p.tipo ?? 'MERCADERIA') === filterTipo)
  }, [productos, filterTipo])

  const selected = useMemo(() => productos.find((p) => p.id === value), [productos, value])

  const top = useMemo(() => {
    if (!query.trim()) return pool.slice(0, 3)
    return pool
      .map((p) => ({ p, s: score(p, query) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 3)
      .map((x) => x.p)
  }, [pool, query])

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
        onClick={() => { setOpen(true); setQuery('') }}
        className="flex w-full items-center justify-between rounded-xl border border-black/[0.08] bg-white py-2.5 px-3 text-sm font-medium text-gray-700 outline-none transition-all hover:border-gray-300 focus:border-brand-military dark:border-white/10 dark:bg-zinc-900 dark:text-gray-200"
      >
        <span className={selected ? '' : 'text-gray-400'}>
          {selected ? `${selected.nombre}${(selected.tipo ?? 'MERCADERIA') === 'MERCADERIA' ? ` · stock ${selected.stockActual}` : ''}` : (placeholder ?? 'Buscar producto o servicio')}
        </span>
        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-xl dark:border-white/10 dark:bg-zinc-900">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Escribí para buscar..."
            className="w-full border-b border-black/[0.06] bg-gray-50 px-3 py-2.5 text-sm outline-none placeholder:text-gray-400 dark:border-white/10 dark:bg-zinc-800"
          />
          {top.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-gray-400">
              {query.trim() ? `Sin coincidencias para "${query}"` : 'No hay productos cargados'}
            </div>
          ) : (
            top.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onChange(p.id); setOpen(false); setQuery('') }}
                className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors hover:bg-brand-military/5 ${
                  value === p.id ? 'bg-brand-military/10 text-brand-military-dark font-semibold' : 'text-gray-700 dark:text-gray-200'
                }`}
              >
                <span>{p.nombre}</span>
                <span className="text-[11px] font-normal text-gray-400">
                  {[p.categoria, p.marca].filter(Boolean).join(' · ')}
                  {(p.tipo ?? 'MERCADERIA') === 'MERCADERIA' ? ` · stock ${p.stockActual}` : ' · servicio'}
                </span>
              </button>
            ))
          )}
          {pool.length === 0 && (
            <Link
              href="/stock"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 border-t border-black/[0.06] bg-gray-50/50 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-brand-military hover:bg-brand-military/5 dark:border-white/10 dark:bg-zinc-800/50"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Crear en Inventario
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

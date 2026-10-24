'use client'

import { useState } from 'react'
import { getBienesDeUso } from '@/app/actions'

export interface BienItem {
  id: string
  nombre: string
  categoria: string | null
  valorAdquisicion: number
  depreciacionAcumulada: number
}

function fmt(v: number) {
  return `$${Math.round(v).toLocaleString('es-AR')}`
}

interface CategoryGroup {
  nombre: string
  items: Array<{ nombre: string; count: number; total: number }>
  total: number
}

function buildGroups(bienes: BienItem[]): CategoryGroup[] {
  // Agrupar por categoría
  const catMap = new Map<string, BienItem[]>()
  for (const b of bienes) {
    const cat = b.categoria?.trim() || 'Sin categoría'
    if (!catMap.has(cat)) catMap.set(cat, [])
    catMap.get(cat)!.push(b)
  }

  return Array.from(catMap.entries())
    .map(([catNombre, items]) => {
      // Agrupar por nombre dentro de la categoría
      const nombreMap = new Map<string, { count: number; total: number }>()
      for (const b of items) {
        const key = b.nombre.trim()
        const existing = nombreMap.get(key) ?? { count: 0, total: 0 }
        nombreMap.set(key, {
          count: existing.count + 1,
          total: existing.total + b.valorAdquisicion,
        })
      }
      const catTotal = items.reduce((s, b) => s + b.valorAdquisicion, 0)
      return {
        nombre: catNombre,
        items: Array.from(nombreMap.entries())
          .map(([nombre, { count, total }]) => ({ nombre, count, total }))
          .sort((a, b) => b.total - a.total),
        total: catTotal,
      }
    })
    .sort((a, b) => b.total - a.total)
}

export default function BienesDeUsoModal({
  bienesTotal,
}: {
  bienesTotal: number
}) {
  const [open, setOpen] = useState(false)
  const [bienes, setBienes] = useState<BienItem[]>([])
  const [loading, setLoading] = useState(false)

  // Abre el modal y, la primera vez, carga los bienes
  const abrir = () => {
    setOpen(true)
    if (bienes.length > 0 || loading) return
    setLoading(true)
    getBienesDeUso(true)
      .then(data => setBienes(data as BienItem[]))
      .finally(() => setLoading(false))
  }

  const groups = buildGroups(bienes)
  const grandTotal = groups.reduce((s, g) => s + g.total, 0)

  return (
    <>
      {/* Card — idéntica al Link original pero como botón */}
      <button
        type="button"
        onClick={abrir}
        className="group flex flex-col rounded-2xl border-2 border-[#B42318]/20 bg-[var(--ds-white)] p-7 min-h-[180px] shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition duration-200 hover:-translate-y-1 hover:border-[#B42318]/50 hover:shadow-[0_10px_24px_rgba(15,23,42,0.10)] dark:border-[var(--ds-amber)]/40 dark:hover:border-[var(--ds-amber)]/80 dark:bg-[var(--ds-ink)] dark:shadow-none w-full text-left"
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FEF3F2] text-[var(--ds-clay)] dark:bg-[#1F1514] dark:text-[var(--ds-amber)]">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Bienes de Uso</span>
        </div>
        {/* Monto centrado en el espacio que queda debajo del título */}
        <div className="flex flex-1 flex-col justify-center">
          <p className="font-mono text-[2.025rem] font-bold leading-tight num-tabular text-[var(--ds-neutral-800)] dark:text-[var(--ds-line)]">
            {fmt(bienesTotal)}
          </p>
        </div>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl dark:bg-[#1a1a1a] dark:border dark:border-white/10 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-white/10">
              <div>
                <h2 className="text-sm font-bold tracking-tight text-[var(--ds-neutral-800)] dark:text-[var(--ds-line)]">
                  Bienes de Uso
                </h2>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  {bienes.length} activo{bienes.length !== 1 ? 's' : ''} · {groups.length} categoría{groups.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-gray-200 transition"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Cuerpo */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--ds-amber)] border-t-transparent" />
                </div>
              ) : groups.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">Sin bienes registrados</p>
              ) : (
                groups.map(group => {
                  const pct = grandTotal > 0 ? ((group.total / grandTotal) * 100).toFixed(1) : '0'
                  return (
                    <div key={group.nombre}>
                      {/* Encabezado de categoría */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ds-clay)] dark:text-[var(--ds-amber)]">
                            {group.nombre}
                          </span>
                          <span className="rounded-full bg-[#FEF3F2] px-2 py-0.5 text-[10px] font-bold text-[var(--ds-clay)] dark:bg-[#1F1514] dark:text-[var(--ds-amber)]">
                            {pct}%
                          </span>
                        </div>
                        <span className="font-mono text-[13px] font-bold text-[var(--ds-neutral-800)] dark:text-[var(--ds-line)]">
                          {fmt(group.total)}
                        </span>
                      </div>

                      {/* Items de la categoría */}
                      <div className="rounded-xl border border-gray-100 dark:border-white/8 overflow-hidden">
                        {group.items.map((item, idx) => (
                          <div
                            key={item.nombre}
                            className={`flex items-baseline justify-between gap-3 px-4 py-2.5 ${
                              idx < group.items.length - 1
                                ? 'border-b border-gray-100 dark:border-white/8'
                                : ''
                            }`}
                          >
                            <span className="text-[12px] text-[var(--ds-neutral-700)] dark:text-[var(--ds-neutral-300)]">
                              <span className="font-bold text-[var(--ds-clay)] dark:text-[var(--ds-amber)] tabular-nums">
                                {item.count}
                              </span>
                              {' '}
                              {item.nombre}
                            </span>
                            <span className="shrink-0 font-mono text-[12px] font-semibold text-[var(--ds-neutral-800)] dark:text-[var(--ds-line)]">
                              {fmt(item.total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer — total general */}
            <div className="border-t border-gray-100 px-6 py-4 dark:border-white/10 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                Total valorizado
              </span>
              <span className="font-mono text-[18px] font-bold text-[var(--ds-clay)] dark:text-[var(--ds-amber)]">
                {fmt(grandTotal)}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export type SubtotalCategoria = {
  categoria: string
  productos: number
  unidades: number
  valorizado: number
  ingresos: number
  ganancia: number
}

const fmt$ = (v: number) => `$${Math.round(v).toLocaleString('es-AR')}`
const fmtU = (v: number) => v.toLocaleString('es-AR', { maximumFractionDigits: 2 })
const pct = (v: number) => v.toLocaleString('es-AR', { maximumFractionDigits: 0 })

/**
 * Subtotales por categoría (desde el menú "···" de Inventario): cuánto stock tiene cada una,
 * cuánto pesa en el total y cuánto valdría vendida. Tocar una categoría la filtra en la tabla.
 */
export default function SubtotalesSheet({ grupos, onClose, onElegir }: {
  grupos: SubtotalCategoria[]
  onClose: () => void
  onElegir: (categoria: string) => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const ordenados = [...grupos].sort((a, b) => b.valorizado - a.valorizado)
  const total = grupos.reduce(
    (t, g) => ({ unidades: t.unidades + g.unidades, valorizado: t.valorizado + g.valorizado, ingresos: t.ingresos + g.ingresos, ganancia: t.ganancia + g.ganancia }),
    { unidades: 0, valorizado: 0, ingresos: 0, ganancia: 0 },
  )
  const margen = (gan: number, ing: number) => (ing > 0 ? (gan / ing) * 100 : 0)

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label="Subtotales por categoría">
      <div className="reg-backdrop absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="reg-sheet relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-[#F2F2F7] shadow-2xl dark:bg-black md:rounded-3xl">
        <div className="flex justify-center pt-2 md:hidden" aria-hidden>
          <span className="h-[5px] w-9 rounded-full bg-black/15 dark:bg-white/20" />
        </div>
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h3 className="text-[17px] font-semibold text-[#1C1C1E] dark:text-white">Subtotales por categoría</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.06] text-[#8E8E93] transition active:scale-90 dark:bg-white/10"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="overflow-y-auto px-4 pb-5">
          <div className="divide-y divide-black/[0.06] overflow-hidden rounded-xl bg-white dark:divide-white/[0.08] dark:bg-[#1C1C1E]">
            {ordenados.map((g) => {
              const peso = total.valorizado > 0 ? (g.valorizado / total.valorizado) * 100 : 0
              return (
                <button
                  key={g.categoria}
                  type="button"
                  onClick={() => onElegir(g.categoria)}
                  title={`Ver ${g.categoria} en la tabla`}
                  className="block w-full px-4 py-3 text-left transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.04]"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[15px] text-[#1C1C1E] dark:text-white">
                      {g.categoria} <span className="text-[12px] text-[#AEAEB2]">· {fmtU(g.unidades)} u.</span>
                    </span>
                    <span className="shrink-0 text-[15px] font-semibold tabular-nums text-[#1C1C1E] dark:text-white">{fmt$(g.valorizado)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                      <span className="block h-full rounded-full bg-[#5E6C84]" style={{ width: `${Math.max(2, peso)}%` }} />
                    </span>
                    <span className="w-9 shrink-0 text-right text-[12px] tabular-nums text-[#8E8E93]">{pct(peso)}%</span>
                  </div>
                  <p className="mt-1 text-[12px] tabular-nums text-[#AEAEB2] dark:text-[#636366]">
                    Si vendés todo: {fmt$(g.ingresos)} · gana {fmt$(g.ganancia)} ({pct(margen(g.ganancia, g.ingresos))}%)
                  </p>
                </button>
              )
            })}
          </div>

          {/* Total */}
          <div className="mt-3 rounded-xl bg-white px-4 py-3 dark:bg-[#1C1C1E]">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-semibold text-[#1C1C1E] dark:text-white">Total <span className="text-[12px] font-normal text-[#AEAEB2]">· {fmtU(total.unidades)} u.</span></span>
              <span className="text-[15px] font-semibold tabular-nums text-[#1C1C1E] dark:text-white">{fmt$(total.valorizado)}</span>
            </div>
            <p className="mt-1 text-[12px] tabular-nums text-[#AEAEB2] dark:text-[#636366]">
              Si vendés todo: {fmt$(total.ingresos)} · gana {fmt$(total.ganancia)} ({pct(margen(total.ganancia, total.ingresos))}%)
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

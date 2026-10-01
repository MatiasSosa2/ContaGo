'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { SF_FONT, fmtFull } from './modern'

export type SheetMov = { id: string; date: Date | string; description: string; amount: number; account: string | null }

/** Ventanita estilo iOS con los movimientos de un renglón; cada uno lleva a Cajas */
export default function MovementsSheet({ title, subtitle, movs, currency, sign, onClose }: {
  title: string
  subtitle?: string
  movs: SheetMov[]
  currency: string
  /** + para ingresos, − para egresos */
  sign: 1 | -1
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const total = movs.reduce((s, m) => s + m.amount, 0)

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" style={{ fontFamily: SF_FONT }}>
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/30 backdrop-blur-[3px]" onClick={onClose} />
      <div role="dialog" aria-label={title} className="relative z-10 flex max-h-[85vh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-[20px] bg-[#F2F2F7] shadow-[0_24px_80px_rgba(0,0,0,0.25)] sm:rounded-[20px] dark:bg-[#1C1C1E]">
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
          <div className="min-w-0">
            {subtitle && <p className="text-[13px] text-[#8E8E93]">{subtitle}</p>}
            <h3 className="truncate text-[20px] font-semibold tracking-tight text-[#1C1C1E] dark:text-white">{title}</h3>
            <p className={`mt-0.5 text-[15px] font-semibold tabular-nums ${sign > 0 ? 'text-[#248A3D] dark:text-[#30D158]' : 'text-[#1C1C1E] dark:text-white'}`}>
              {fmtFull(sign * total, currency, true)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-[#8E8E93] transition hover:bg-black/10 dark:bg-white/10">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-6">
          <p className="mb-1 px-1 text-[12px] font-medium uppercase tracking-wide text-[#8E8E93]">{movs.length} movimiento{movs.length !== 1 ? 's' : ''}</p>
          <div className="rounded-xl bg-white dark:bg-[#2C2C2E]">
            {movs.map((m, i) => (
              <Link
                key={`${m.id}-${i}`}
                href={`/cajas?mov=${m.id}`}
                className="flex items-center gap-3 border-b border-black/[0.06] px-3 py-2.5 transition last:border-b-0 hover:bg-black/[0.03] dark:border-white/[0.08] dark:hover:bg-white/[0.05]"
              >
                <span className="w-12 shrink-0 text-[12px] tabular-nums text-[#8E8E93]">
                  {new Date(m.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-[#1C1C1E] dark:text-white">{m.description}</span>
                  {m.account && <span className="block truncate text-[12px] text-[#8E8E93]">{m.account}</span>}
                </span>
                <span className="text-[14px] tabular-nums text-[#3C3C43] dark:text-[#EBEBF5]/80">{fmtFull(m.amount, currency)}</span>
                <svg className="h-3 w-3 shrink-0 text-[#C7C7CC]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

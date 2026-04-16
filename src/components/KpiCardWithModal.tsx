'use client'

import { useState, type ReactNode } from 'react'

interface CategoryItem {
  name: string
  value: number
  color: string
}

interface KpiCardWithModalProps {
  children: ReactNode
  title: string
  categories: CategoryItem[]
  total: number
}

export default function KpiCardWithModal({ children, title, categories, total }: KpiCardWithModalProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="h-full cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]" onClick={() => setOpen(true)}>
        {children}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          <div
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#141414] dark:shadow-[0_24px_80px_rgba(0,0,0,0.42)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#ECE7E1] bg-[#FAFBFC] px-6 py-4 dark:border-white/10 dark:bg-[#171717]">
              <h3 className="text-sm font-semibold text-[#1F2937] dark:text-[#E8E8E8]">{title}</h3>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-400 transition-colors hover:text-stone-700 dark:border-white/10 dark:bg-[#1B1B1B] dark:text-stone-300"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {categories.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-stone-400 dark:text-stone-500">Sin datos categorizados en este período</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {categories.map((cat) => {
                    const pct = total > 0 ? (cat.value / total) * 100 : 0
                    return (
                      <div key={cat.name} className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cat.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="truncate text-sm font-medium text-[#1F2937] dark:text-[#E8E8E8]">{cat.name}</span>
                            <span className="shrink-0 text-sm font-mono font-normal text-[#1F2937] num-tabular dark:text-[#E8E8E8]">
                              ${cat.value.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-white/5">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, background: cat.color }}
                            />
                          </div>
                          <p className="mt-0.5 text-[10px] text-stone-400 dark:text-stone-500">{pct.toFixed(1)}% del total</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[#ECE7E1] bg-[#FAFBFC] px-6 py-3 dark:border-white/10 dark:bg-[#171717]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#5A7A57] dark:text-[#9AC7A8]">Total</p>
              <p className="text-base font-mono font-normal text-[#1B4332] num-tabular dark:text-[#9AC7A8]">
                ${total.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

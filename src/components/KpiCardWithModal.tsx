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
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Modal */}
          <div
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#D8E2D6] bg-[#F0F4EF] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {categories.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400">Sin datos categorizados en este período</p>
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
                            <span className="text-sm font-medium text-gray-700 truncate">{cat.name}</span>
                            <span className="text-sm font-mono font-normal num-tabular text-gray-800 shrink-0">
                              ${cat.value.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, background: cat.color }}
                            />
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5">{pct.toFixed(1)}% del total</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer total */}
            <div className="px-6 py-3 bg-[#F0F4EF] border-t border-[#D8E2D6] flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4A6741]">Total</p>
              <p className="text-base font-mono font-normal num-tabular text-[#1B4332]">
                ${total.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

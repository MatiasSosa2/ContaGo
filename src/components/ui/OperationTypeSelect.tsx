'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type OperationOption = {
  value: string
  label: string
  description?: string
  group: string
}

type Props = {
  value: string
  onChange: (value: string) => void
  type: 'INCOME' | 'EXPENSE'
  operatingModel: 'PRODUCTS' | 'SERVICES' | 'BOTH'
  customCategories?: { id: string; name: string }[]
  onAddCustom?: () => void
  onDeleteCustom?: (id: string) => void
}

// Opciones jerárquicas para INCOME (Ventas)
const INCOME_OPTIONS: OperationOption[] = [
  { value: 'SALE_PRODUCT', label: 'Venta de productos', description: 'Mercadería que descuenta stock', group: 'Ventas' },
  { value: 'SALE_SERVICE', label: 'Venta de servicios', description: 'Sin impacto en stock', group: 'Ventas' },
  { value: 'SALE_BIEN_USO', label: 'Venta de bien de uso', description: 'Maquinaria, vehículo, equipo', group: 'Ventas' },
  { value: 'COBRO_CREDITO', label: 'Cobro de crédito', description: 'Cobro de venta a crédito ya registrada', group: 'Cobros' },
]

const EXPENSE_OPTIONS: OperationOption[] = [
  { value: 'PURCHASE_PRODUCT', label: 'Compra de productos', description: 'Mercadería que aumenta stock', group: 'Compras' },
  { value: 'PURCHASE_BIEN_USO', label: 'Compra de bien de uso', description: 'Maquinaria, vehículo, equipo', group: 'Compras' },
  { value: 'PAGO_DEUDA', label: 'Pago de deuda', description: 'Pago de compra a crédito ya registrada', group: 'Pagos' },
]

export default function OperationTypeSelect({ value, onChange, type, operatingModel, customCategories, onAddCustom, onDeleteCustom }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filteredOptions = useMemo(() => {
    const base = type === 'INCOME' ? INCOME_OPTIONS : EXPENSE_OPTIONS
    return base.filter((opt) => {
      if (operatingModel === 'PRODUCTS') {
        if (opt.value === 'SALE_SERVICE') return false
      }
      if (operatingModel === 'SERVICES') {
        if (opt.value === 'SALE_PRODUCT' || opt.value === 'PURCHASE_PRODUCT') return false
      }
      return true
    })
  }, [type, operatingModel])

  const selected = useMemo(() => {
    return filteredOptions.find((o) => o.value === value)
      || customCategories?.find((c) => c.id === value)
  }, [filteredOptions, customCategories, value])

  const grouped = useMemo(() => {
    const map = new Map<string, OperationOption[]>()
    for (const opt of filteredOptions) {
      const list = map.get(opt.group) ?? []
      list.push(opt)
      map.set(opt.group, list)
    }
    return [...map.entries()]
  }, [filteredOptions])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const labelText = (() => {
    if (!selected) return 'Seleccionar tipo de operación'
    if ('label' in selected) return selected.label
    return selected.name
  })()

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-black/[0.08] bg-white py-2.5 px-3 text-sm font-medium text-gray-700 outline-none transition-all hover:border-gray-300 focus:border-brand-military dark:border-white/10 dark:bg-zinc-900 dark:text-gray-200"
      >
        <span className={selected ? '' : 'text-gray-400'}>{labelText}</span>
        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-black/[0.08] bg-white shadow-xl dark:border-white/10 dark:bg-zinc-900">
          {grouped.map(([group, opts]) => (
            <div key={group}>
              <div className="bg-gray-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:bg-zinc-800 dark:text-gray-400">
                {group}
              </div>
              {opts.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false) }}
                  className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors hover:bg-brand-military/5 ${
                    value === opt.value ? 'bg-brand-military/10 text-brand-military-dark font-semibold' : 'text-gray-700 dark:text-gray-200'
                  }`}
                >
                  <span>{opt.label}</span>
                  {opt.description && <span className="text-[11px] font-normal text-gray-400">{opt.description}</span>}
                </button>
              ))}
            </div>
          ))}

          {/* Grupo "Otros" siempre visible: lista categorías personalizadas + botón agregar */}
          <div>
            <div className="bg-gray-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:bg-zinc-800 dark:text-gray-400">
              Otros
            </div>
            {customCategories && customCategories.length > 0 ? (
              customCategories.map((c) => (
                <div
                  key={c.id}
                  className={`group flex items-center transition-colors hover:bg-brand-military/5 ${
                    value === c.id ? 'bg-brand-military/10' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => { onChange(c.id); setOpen(false) }}
                    className={`flex-1 px-3 py-2 text-left text-sm ${
                      value === c.id ? 'text-brand-military-dark font-semibold' : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {c.name}
                  </button>
                  {onDeleteCustom && (
                    <button
                      type="button"
                      title="Eliminar categoría"
                      onClick={(e) => { e.stopPropagation(); onDeleteCustom(c.id) }}
                      className="mr-2 flex h-6 w-6 items-center justify-center rounded-md text-gray-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="px-3 py-2 text-[11px] italic text-gray-400">Sin categorías aún</p>
            )}

            {onAddCustom && (
              <button
                type="button"
                onClick={() => { setOpen(false); onAddCustom() }}
                className="flex w-full items-center gap-2 border-t border-black/[0.06] bg-gray-50/50 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-brand-military hover:bg-brand-military/5 dark:border-white/10 dark:bg-zinc-800/50"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Agregar categoría
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

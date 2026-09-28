'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type OperationOption = {
  value: string
  label: string
}

export type CustomCategory = {
  id: string
  name: string
  subcategories: { id: string; name: string }[]
}

type Props = {
  /** Subtipo fijo o id de categoría propia */
  value: string
  /** Subcategoría elegida (solo para categorías propias) */
  subcategoryId?: string
  onChange: (value: string) => void
  onSelectSubcategory?: (categoryId: string, subcategoryId: string) => void
  type: 'INCOME' | 'EXPENSE'
  customCategories?: CustomCategory[]
  /** Crea una categoría del tipo actual. Devuelve un mensaje de error o null si salió bien. */
  onAddCustom?: (name: string) => Promise<string | null>
  onDeleteCustom?: (id: string) => void
  onAddSubcategory?: (categoryId: string, name: string) => Promise<string | null>
  onDeleteSubcategory?: (id: string) => void
  /** 'ios': fila blanca redondeada sin borde (pestaña de registración nueva) */
  variant?: 'default' | 'ios'
}

const INCOME_OPTIONS: OperationOption[] = [
  { value: 'SALE_PRODUCT', label: 'Venta de productos' },
  { value: 'COBRO_CREDITO', label: 'Cobro de créditos' },
  { value: 'SALE_BIEN_USO', label: 'Venta de bienes de uso' },
]

const EXPENSE_OPTIONS: OperationOption[] = [
  { value: 'PURCHASE_PRODUCT', label: 'Compra de productos' },
  { value: 'PAGO_DEUDA', label: 'Pago de deudas' },
  { value: 'PURCHASE_BIEN_USO', label: 'Compra de bienes de uso' },
]

const ROW_CLS = 'flex w-full items-center px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-gray-50 dark:hover:bg-white/5'
const ICON_BTN_CLS = 'flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-300 transition-all'

function XIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

/** Fila "+ Agregar …" que se convierte en un campo de texto inline. */
function InlineAdd({ label, placeholder, indent, onAdd }: {
  label: string
  placeholder: string
  indent?: boolean
  onAdd: (name: string) => Promise<string | null>
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed || saving) return
    setSaving(true)
    const err = await onAdd(trimmed)
    setSaving(false)
    if (err) { setError(err); return }
    setAdding(false)
    setName('')
  }

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className={`flex w-full items-center gap-1 py-1 pr-3 text-left text-[11px] text-[#AEAEB2] transition-colors hover:text-gray-500 dark:hover:text-gray-300 ${indent ? 'pl-7' : 'pl-3'}`}
      >
        <PlusIcon />
        {label}
      </button>
    )
  }

  return (
    <div className={`py-1 pr-3 ${indent ? 'pl-7' : 'pl-3'}`}>
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="text"
          value={name}
          maxLength={100}
          onChange={(e) => { setName(e.target.value); setError(null) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); submit() }
            if (e.key === 'Escape') { e.stopPropagation(); setAdding(false); setName('') }
          }}
          placeholder={placeholder}
          className="h-7 min-w-0 flex-1 rounded-md border border-black/[0.08] bg-transparent px-2 text-[13px] text-gray-700 outline-none placeholder:text-gray-400 focus:border-gray-300 dark:border-white/10 dark:text-gray-200"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim() || saving}
          className="text-[11px] font-semibold text-gray-500 transition-colors hover:text-gray-800 disabled:opacity-40 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {saving ? '…' : 'Agregar'}
        </button>
      </div>
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  )
}

export default function OperationTypeSelect({
  value, subcategoryId, onChange, onSelectSubcategory, type, customCategories = [],
  onAddCustom, onDeleteCustom, onAddSubcategory, onDeleteSubcategory, variant = 'default',
}: Props) {
  const [open, setOpen] = useState(false)
  // Categoría propia desplegada para ver/agregar subcategorías
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const options = type === 'INCOME' ? INCOME_OPTIONS : EXPENSE_OPTIONS

  const labelText = useMemo(() => {
    const fixed = options.find((o) => o.value === value)
    if (fixed) return fixed.label
    const cat = customCategories.find((c) => c.id === value)
    if (!cat) return null
    const sub = cat.subcategories.find((s) => s.id === subcategoryId)
    return sub ? `${cat.name} › ${sub.name}` : cat.name
  }, [options, customCategories, value, subcategoryId])

  const close = () => {
    setOpen(false)
    setExpandedId(null)
  }

  const openList = () => {
    setOpen(true)
    // Si hay una subcategoría elegida, abrir su categoría desplegada
    setExpandedId(subcategoryId ? value : null)
  }

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const select = (v: string) => {
    onChange(v)
    close()
  }

  const toggleExpand = (id: string) => setExpandedId((cur) => (cur === id ? null : id))

  const selectedCls = type === 'INCOME' ? 'font-semibold text-brand-military-dark dark:text-brand-military-light' : 'font-semibold text-brand-oxide'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : openList())}
        className={variant === 'ios'
          ? 'flex min-h-[44px] w-full items-center justify-between rounded-xl bg-white px-4 text-[15px] text-[#1C1C1E] outline-none active:bg-black/[0.04] dark:bg-[#1C1C1E] dark:text-white'
          : 'flex w-full items-center justify-between rounded-xl border border-black/[0.08] bg-white py-2.5 px-3 text-sm font-medium text-gray-700 outline-none transition-all hover:border-gray-300 focus:border-brand-military dark:border-white/10 dark:bg-zinc-900 dark:text-gray-200'}
      >
        <span className={`truncate ${labelText ? '' : 'text-gray-400'}`}>{labelText ?? 'Seleccionar categoría'}</span>
        <svg className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-80 overflow-y-auto rounded-lg border border-black/[0.08] bg-white py-1 shadow-lg dark:border-white/10 dark:bg-zinc-900">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => select(opt.value)}
              className={`${ROW_CLS} ${value === opt.value ? selectedCls : 'text-gray-700 dark:text-gray-200'}`}
            >
              {opt.label}
            </button>
          ))}

          {customCategories.map((c) => {
            const hasSubs = c.subcategories.length > 0
            const expanded = expandedId === c.id
            const isSelected = value === c.id
            return (
              <div key={c.id}>
                <div className="group flex items-center pr-2 hover:bg-gray-50 dark:hover:bg-white/5">
                  <button
                    type="button"
                    // Con subcategorías hay que elegir una: el nombre solo despliega
                    onClick={() => (hasSubs ? toggleExpand(c.id) : select(c.id))}
                    className={`${ROW_CLS} flex-1 hover:bg-transparent dark:hover:bg-transparent ${isSelected ? selectedCls : 'text-gray-700 dark:text-gray-200'}`}
                  >
                    {c.name}
                  </button>
                  {onDeleteCustom && (
                    <button
                      type="button"
                      title="Eliminar categoría"
                      aria-label={`Eliminar ${c.name}`}
                      onClick={(e) => { e.stopPropagation(); onDeleteCustom(c.id) }}
                      className={`${ICON_BTN_CLS} hover:text-red-500 md:opacity-0 md:group-hover:opacity-100`}
                    >
                      <XIcon />
                    </button>
                  )}
                  {(hasSubs || onAddSubcategory) && (
                    <button
                      type="button"
                      title={expanded ? 'Ocultar subcategorías' : 'Ver subcategorías'}
                      aria-label={`Subcategorías de ${c.name}`}
                      aria-expanded={expanded}
                      onClick={(e) => { e.stopPropagation(); toggleExpand(c.id) }}
                      className={`${ICON_BTN_CLS} ml-0.5 hover:text-gray-500 ${hasSubs ? 'text-gray-400' : ''}`}
                    >
                      <svg className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                </div>

                {expanded && (
                  <div className="pb-1">
                    {c.subcategories.map((s) => (
                      <div key={s.id} className="group flex items-center pr-2 hover:bg-gray-50 dark:hover:bg-white/5">
                        <button
                          type="button"
                          onClick={() => { onSelectSubcategory?.(c.id, s.id); close() }}
                          className={`${ROW_CLS} flex-1 pl-7 hover:bg-transparent dark:hover:bg-transparent ${subcategoryId === s.id ? selectedCls : 'text-gray-600 dark:text-gray-300'}`}
                        >
                          {s.name}
                        </button>
                        {onDeleteSubcategory && (
                          <button
                            type="button"
                            title="Eliminar subcategoría"
                            aria-label={`Eliminar ${s.name}`}
                            onClick={(e) => { e.stopPropagation(); onDeleteSubcategory(s.id) }}
                            className={`${ICON_BTN_CLS} mr-5.5 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100`}
                          >
                            <XIcon />
                          </button>
                        )}
                      </div>
                    ))}
                    {onAddSubcategory && (
                      <InlineAdd
                        indent
                        label="Agregar subcategoría"
                        placeholder={`Nueva subcategoría de ${c.name}`}
                        onAdd={async (name) => {
                          const err = await onAddSubcategory(c.id, name)
                          if (!err) close()
                          return err
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {onAddCustom && (
            <div className="mt-1 border-t border-black/[0.05] pt-1 dark:border-white/5">
              <InlineAdd
                label="Agregar categoría"
                placeholder={type === 'INCOME' ? 'Nueva categoría de ingreso' : 'Nueva categoría de egreso'}
                onAdd={async (name) => {
                  const err = await onAddCustom(name)
                  if (!err) close()
                  return err
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

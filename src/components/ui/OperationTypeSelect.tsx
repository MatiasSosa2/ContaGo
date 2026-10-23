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
  /** Renombrar (devuelven error o null) */
  onRenameCustom?: (id: string, name: string) => Promise<string | null>
  onRenameSubcategory?: (id: string, name: string) => Promise<string | null>
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

// Fila de la lista: fina, 13 px, separador apenas visible
const ROW = 'flex w-full min-h-[36px] items-center gap-2 px-3 text-left text-[13px] transition-colors'
const HOVER = 'hover:bg-black/[0.035] dark:hover:bg-white/[0.06]'
const TICK = <span className="ml-auto shrink-0 text-[13px] text-[var(--reg-accent,#4F8A6B)]" aria-hidden>✓</span>

/** Campo de texto chico para nombre nuevo o renombrar (Enter guarda, Esc cancela) */
function NameInput({ initial = '', placeholder, onSave, onCancel, indent = false }: {
  initial?: string
  placeholder: string
  onSave: (name: string) => Promise<string | null>
  onCancel: () => void
  indent?: boolean
}) {
  const [name, setName] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const guardar = async () => {
    const t = name.trim()
    if (!t || saving) return
    if (t === initial.trim()) { onCancel(); return }
    setSaving(true)
    const err = await onSave(t)
    setSaving(false)
    if (err) setError(err)
  }
  return (
    <div className={`py-1.5 pr-3 ${indent ? 'pl-7' : 'pl-3'}`}>
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={name}
          maxLength={100}
          onChange={(e) => { setName(e.target.value); setError(null) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); void guardar() }
            if (e.key === 'Escape') { e.stopPropagation(); onCancel() }
          }}
          placeholder={placeholder}
          className="ios-bare h-7 min-w-0 flex-1 rounded-md bg-black/[0.05] px-2 text-[13px] text-[#1C1C1E] outline-none placeholder:text-[#AEAEB2] dark:bg-white/[0.08] dark:text-white"
        />
        <button type="button" onClick={() => void guardar()} disabled={!name.trim() || saving} className="text-[12px] font-medium text-[#007AFF] disabled:opacity-40 dark:text-[#0A84FF]">
          {saving ? '…' : 'OK'}
        </button>
      </div>
      {error && <p className="mt-1 text-[11px] text-[#B8664F]">{error}</p>}
    </div>
  )
}

/** Botón "−" rojo de iOS: el primer toque muestra "Eliminar", el segundo borra */
function Quitar({ armed, onArm, onConfirm, label }: { armed: boolean; onArm: () => void; onConfirm: () => void; label: string }) {
  return armed ? (
    <button type="button" onClick={onConfirm} className="shrink-0 rounded-md bg-[#FF3B30] px-2 py-0.5 text-[11px] font-medium text-white">
      Eliminar
    </button>
  ) : (
    <button type="button" onClick={onArm} aria-label={`Eliminar ${label}`} className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#FF3B30] text-white">
      <span className="block h-[2px] w-2 rounded bg-white" />
    </button>
  )
}

/**
 * Selector de categoría del registro: las operaciones fijas y las categorías propias en una sola
 * lista. Las que tienen subcategorías se despliegan debajo ("General" elige la categoría sola).
 * "Editar" permite agregar, renombrar y borrar categorías y subcategorías.
 */
export default function OperationTypeSelect({
  value, subcategoryId, onChange, onSelectSubcategory, type, customCategories = [],
  onAddCustom, onDeleteCustom, onAddSubcategory, onDeleteSubcategory, onRenameCustom, onRenameSubcategory, variant = 'default',
}: Props) {
  const [open, setOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  // Qué se está renombrando / agregando / por eliminar
  const [renombrando, setRenombrando] = useState<string | null>(null)
  const [agregando, setAgregando] = useState<string | null>(null) // 'categoria' o id de la categoría
  const [porEliminar, setPorEliminar] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const options = type === 'INCOME' ? INCOME_OPTIONS : EXPENSE_OPTIONS
  const puedeEditar = !!(onAddCustom || onDeleteCustom || onAddSubcategory || onDeleteSubcategory || onRenameCustom || onRenameSubcategory)

  const labelText = useMemo(() => {
    const fixed = options.find((o) => o.value === value)
    if (fixed) return fixed.label
    const cat = customCategories.find((c) => c.id === value)
    if (!cat) return null
    const sub = cat.subcategories.find((s) => s.id === subcategoryId)
    return sub ? `${cat.name} › ${sub.name}` : cat.name
  }, [options, customCategories, value, subcategoryId])

  const limpiarEdicion = () => { setRenombrando(null); setAgregando(null); setPorEliminar(null) }
  const close = () => { setOpen(false); setExpandedId(null); setEditando(false); limpiarEdicion() }
  const openList = () => { setOpen(true); setExpandedId(subcategoryId ? value : null) }

  useEffect(() => {
    if (!open) return
    // Tocar afuera cierra la lista (y sale de Editar)
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setExpandedId(null); setEditando(false); setRenombrando(null); setAgregando(null); setPorEliminar(null)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const select = (v: string) => { onChange(v); close() }
  const toggleExpand = (id: string) => setExpandedId((cur) => (cur === id ? null : id))
  const accent = 'font-medium text-[var(--reg-accent,#1C1C1E)]'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : openList())}
        className={variant === 'ios'
          ? 'flex min-h-[44px] w-full items-center justify-between rounded-xl bg-white px-4 text-[15px] text-[#1C1C1E] outline-none active:bg-black/[0.04] dark:bg-[#1C1C1E] dark:text-white'
          : 'flex w-full items-center justify-between rounded-xl border border-black/[0.08] bg-white py-2.5 px-3 text-sm font-medium text-gray-700 outline-none transition-all hover:border-gray-300 dark:border-white/10 dark:bg-zinc-900 dark:text-gray-200'}
      >
        <span className={`truncate ${labelText ? (variant === 'ios' ? accent : '') : 'text-gray-400'}`}>{labelText ?? 'Seleccionar categoría'}</span>
        <svg className={`h-3.5 w-3.5 shrink-0 text-[#C7C7CC] transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-[22rem] overflow-y-auto rounded-xl bg-white/95 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.16)] ring-1 ring-black/[0.06] backdrop-blur-xl dark:bg-[#2C2C2E]/95 dark:ring-white/10">
          {/* Editar / Listo, arriba a la derecha */}
          {puedeEditar && (
            <div className="flex justify-end px-3 pb-0.5 pt-1">
              <button
                type="button"
                onClick={() => { setEditando((v) => !v); limpiarEdicion() }}
                className="text-[12px] font-medium text-[#007AFF] dark:text-[#0A84FF]"
              >
                {editando ? 'Listo' : 'Editar'}
              </button>
            </div>
          )}

          {/* Operaciones del sistema (fijas) */}
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={editando}
              onClick={() => select(opt.value)}
              className={`${ROW} ${HOVER} disabled:cursor-default disabled:opacity-40 ${value === opt.value ? accent : 'text-[#1C1C1E] dark:text-white'}`}
            >
              <span className="truncate">{opt.label}</span>
              {value === opt.value && !editando && TICK}
            </button>
          ))}

          {customCategories.length > 0 && <div className="mx-3 my-1 h-px bg-black/[0.06] dark:bg-white/[0.08]" aria-hidden />}

          {/* Categorías propias */}
          {customCategories.map((c) => {
            const n = c.subcategories.length
            const expanded = expandedId === c.id || (editando && agregando === c.id)
            const elegida = value === c.id
            const conSubs = n > 0
            return (
              <div key={c.id}>
                {renombrando === c.id && onRenameCustom ? (
                  <NameInput
                    initial={c.name}
                    placeholder="Nombre de la categoría"
                    onCancel={() => setRenombrando(null)}
                    onSave={async (name) => { const err = await onRenameCustom(c.id, name); if (!err) setRenombrando(null); return err }}
                  />
                ) : (
                  <div className={`${ROW} ${HOVER}`}>
                    {editando && onDeleteCustom && (
                      <Quitar
                        label={c.name}
                        armed={porEliminar === c.id}
                        onArm={() => setPorEliminar(c.id)}
                        onConfirm={() => { setPorEliminar(null); onDeleteCustom(c.id) }}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (editando) { if (onRenameCustom) setRenombrando(c.id); return }
                        // Con subcategorías: desplegar; sin: elegir
                        if (conSubs) toggleExpand(c.id)
                        else select(c.id)
                      }}
                      className={`min-w-0 flex-1 truncate text-left ${elegida && !editando ? accent : 'text-[#1C1C1E] dark:text-white'}`}
                    >
                      {c.name}
                    </button>
                    {/* Cantidad de subcategorías y flechita (o "+ sub" al editar) */}
                    {editando ? (
                      onAddSubcategory && (
                        <button type="button" onClick={() => { setExpandedId(c.id); setAgregando(c.id) }} className="shrink-0 text-[11px] text-[#007AFF] dark:text-[#0A84FF]">
                          + Sub
                        </button>
                      )
                    ) : (
                      <>
                        {elegida && !subcategoryId && !conSubs && TICK}
                        {conSubs && (
                          <span className="ml-auto flex shrink-0 items-center gap-1 text-[11px] text-[#AEAEB2]">
                            {n}
                            <svg className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Subcategorías desplegadas debajo */}
                {(expanded || (editando && conSubs)) && (
                  <div className="pb-1">
                    {!editando && conSubs && (
                      <button type="button" onClick={() => select(c.id)} className={`${ROW} ${HOVER} min-h-[32px] pl-7 text-[12px] ${elegida && !subcategoryId ? accent : 'text-[#8E8E93]'}`}>
                        <span>General</span>
                        {elegida && !subcategoryId && TICK}
                      </button>
                    )}
                    {c.subcategories.map((s) => (
                      renombrando === s.id && onRenameSubcategory ? (
                        <NameInput
                          key={s.id}
                          indent
                          initial={s.name}
                          placeholder="Nombre de la subcategoría"
                          onCancel={() => setRenombrando(null)}
                          onSave={async (name) => { const err = await onRenameSubcategory(s.id, name); if (!err) setRenombrando(null); return err }}
                        />
                      ) : (
                        <div key={s.id} className={`${ROW} ${HOVER} min-h-[32px] pl-7 text-[12px]`}>
                          {editando && onDeleteSubcategory && (
                            <Quitar
                              label={s.name}
                              armed={porEliminar === s.id}
                              onArm={() => setPorEliminar(s.id)}
                              onConfirm={() => { setPorEliminar(null); onDeleteSubcategory(s.id) }}
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (editando) { if (onRenameSubcategory) setRenombrando(s.id); return }
                              onSelectSubcategory?.(c.id, s.id); close()
                            }}
                            className={`min-w-0 flex-1 truncate text-left ${subcategoryId === s.id && !editando ? accent : 'text-[#3C3C43] dark:text-[#EBEBF5]/80'}`}
                          >
                            {s.name}
                          </button>
                          {subcategoryId === s.id && !editando && TICK}
                        </div>
                      )
                    ))}
                    {editando && agregando === c.id && onAddSubcategory && (
                      <NameInput
                        indent
                        placeholder={`Nueva subcategoría de ${c.name}`}
                        onCancel={() => setAgregando(null)}
                        onSave={async (name) => { const err = await onAddSubcategory(c.id, name); if (!err) setAgregando(null); return err }}
                      />
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Nueva categoría (al editar) */}
          {editando && onAddCustom && (
            <div className="mt-1 border-t border-black/[0.06] pt-1 dark:border-white/[0.08]">
              {agregando === 'categoria' ? (
                <NameInput
                  placeholder={type === 'INCOME' ? 'Nueva categoría de ingreso' : 'Nueva categoría de egreso'}
                  onCancel={() => setAgregando(null)}
                  onSave={async (name) => { const err = await onAddCustom(name); if (!err) setAgregando(null); return err }}
                />
              ) : (
                <button type="button" onClick={() => setAgregando('categoria')} className={`${ROW} ${HOVER} text-[#007AFF] dark:text-[#0A84FF]`}>
                  <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#34C759] text-[14px] leading-none text-white" aria-hidden>+</span>
                  Nueva categoría
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

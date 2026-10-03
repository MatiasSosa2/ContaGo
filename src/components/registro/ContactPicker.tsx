'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { createContact } from '@/app/actions'
import type { Contact } from '../TransactionForm'

/** Para comparar sin importar mayúsculas, acentos ni espacios de más */
const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Cliente / proveedor del registro: lista con buscador y, si el nombre no existe,
 * "+ Agregar «…»" para crearlo y elegirlo en un toque (solo el nombre).
 */
export default function ContactPicker({ type, contacts, value, onChange, onCreated, invalid = false }: {
  type: 'CLIENT' | 'SUPPLIER'
  contacts: Contact[]
  value: string
  onChange: (id: string) => void
  /** Avisa el contacto nuevo para sumarlo a la lista de quien la muestra */
  onCreated: (contact: Contact) => void
  /** Marca el campo cuando falta (ej. venta a crédito sin cliente) */
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // La lista flota sobre todo (portal): así no la recorta el borde de la ventana del registro
  const [pos, setPos] = useState<CSSProperties>({})
  // Modo "nuevo": el buscador pasa a pedir el nombre del cliente/proveedor a agregar
  const [nuevo, setNuevo] = useState(false)
  const botonRef = useRef<HTMLDivElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const cerrar = useCallback(() => { setOpen(false); setQuery(''); setError(null); setNuevo(false) }, [])

  const abrir = (modoNuevo = false) => {
    setNuevo(modoNuevo)
    const r = botonRef.current?.getBoundingClientRect()
    if (r) {
      // Abre hacia abajo si entra; si no, hacia arriba
      const abajo = window.innerHeight - r.bottom
      const left = Math.max(8, Math.min(r.left, window.innerWidth - 296))
      // El color del tipo (verde ingreso / rojo egreso) no llega solo al portal: se copia
      const accent = getComputedStyle(botonRef.current!).getPropertyValue('--reg-accent').trim()
      const color = accent ? ({ '--reg-accent': accent } as CSSProperties) : {}
      setPos(abajo >= 320 || abajo >= r.top ? { ...color, top: r.bottom + 6, left } : { ...color, bottom: window.innerHeight - r.top + 6, left })
    }
    setOpen(true)
  }

  // Cerrar al tocar afuera o con Esc (sin cerrar el registro)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!botonRef.current?.contains(t) && !listaRef.current?.contains(t)) cerrar()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); cerrar() } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', cerrar)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', cerrar)
    }
  }, [open, cerrar])

  const esCliente = type === 'CLIENT'
  const sinContacto = esCliente ? 'Consumidor final' : 'Sin proveedor'
  const actual = contacts.find((c) => c.id === value)

  const q = normalizar(query)
  const ordenados = [...contacts].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const filtrados = q ? ordenados.filter((c) => normalizar(c.name).includes(q)) : ordenados
  const exacto = q ? contacts.find((c) => normalizar(c.name) === q) : undefined
  // Con coincidencia exacta no se ofrece agregar (no se duplican); se muestra el existente primero
  const lista = exacto ? [exacto, ...filtrados.filter((c) => c.id !== exacto.id)] : filtrados

  const elegir = (id: string) => { onChange(id); cerrar() }

  const agregar = async () => {
    const name = query.replace(/\s+/g, ' ').trim()
    if (!name || creando) return
    setCreando(true)
    setError(null)
    const fd = new FormData()
    fd.set('name', name)
    fd.set('type', type)
    const res = await createContact(fd)
    setCreando(false)
    if (!res.success || !res.data) { setError((!res.success && res.error) || 'No se pudo agregar'); return }
    onCreated(res.data)
    elegir(res.data.id)
  }

  return (
    <div ref={botonRef} className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => (open ? cerrar() : abrir())}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={esCliente ? 'Cliente' : 'Proveedor'}
        className={`flex max-w-full items-center gap-1 text-[13px] font-medium transition-opacity active:opacity-60 ${invalid ? 'text-[#FF3B30] dark:text-[#FF453A]' : actual ? 'text-[#1C1C1E] dark:text-white' : 'text-[#8E8E93]'}`}
      >
        <span className="max-w-[180px] truncate">{actual?.name ?? (invalid ? `Elegí ${esCliente ? 'el cliente' : 'el proveedor'}` : sinContacto)}</span>
      </button>
      {/* Atajo visible para dar de alta uno nuevo */}
      <button
        type="button"
        onClick={() => (open && nuevo ? cerrar() : abrir(true))}
        aria-label={esCliente ? 'Nuevo cliente' : 'Nuevo proveedor'}
        title={esCliente ? 'Nuevo cliente' : 'Nuevo proveedor'}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#007AFF]/10 text-[#007AFF] transition active:scale-90 dark:bg-[#0A84FF]/20 dark:text-[#0A84FF]"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={listaRef}
          role="listbox"
          style={pos}
          className="fixed z-[80] w-[min(18rem,calc(100vw-1rem))] overflow-hidden rounded-xl bg-[#fff]/95 shadow-[0_12px_40px_rgba(0,0,0,0.22)] ring-1 ring-black/[0.06] backdrop-blur-xl animate-[reg-pop-in_160ms_ease-out] dark:bg-[#2C2C2E]/95 dark:ring-white/10"
        >
          {/* Buscador: escribir filtra; Enter elige el primero o agrega el nombre nuevo */}
          <div className="border-b border-black/[0.06] px-3 py-2 dark:border-white/10">
            <div className="flex items-center gap-2 rounded-lg bg-black/[0.05] px-2.5 py-1.5 dark:bg-white/[0.08]">
              <svg className="h-3.5 w-3.5 shrink-0 text-[#8E8E93]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
              </svg>
              <input
                autoFocus
                value={query}
                onChange={(e) => { setQuery(e.target.value); setError(null) }}
                ref={inputRef}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  if (exacto) elegir(exacto.id)
                  else if (q) void agregar()
                  else if (!nuevo && lista[0]) elegir(lista[0].id)
                }}
                placeholder={nuevo
                  ? `Nombre del ${esCliente ? 'cliente' : 'proveedor'} nuevo`
                  : esCliente ? 'Buscar o agregar cliente' : 'Buscar o agregar proveedor'}
                maxLength={100}
                aria-label="Buscar"
                className="ios-bare w-full bg-transparent text-[14px] text-[#1C1C1E] outline-none placeholder:text-[#8E8E93] dark:text-white"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {q && !exacto && (
              <button
                type="button"
                onClick={agregar}
                disabled={creando}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] font-medium text-[#007AFF] transition-colors hover:bg-black/[0.05] disabled:opacity-50 dark:text-[#0A84FF] dark:hover:bg-white/[0.08]"
              >
                <span className="flex h-4 w-4 items-center justify-center text-[16px] leading-none" aria-hidden>+</span>
                <span className="truncate">{creando ? 'Agregando…' : `Agregar «${query.trim()}»`}</span>
              </button>
            )}
            {error && <p className="px-3 py-1.5 text-[12px] text-[#FF3B30]">{error}</p>}

            {/* Siempre a la vista: "+ Nuevo cliente" pasa el buscador a modo alta */}
            {!q && !nuevo && (
              <button
                type="button"
                onClick={() => { setNuevo(true); inputRef.current?.focus() }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] font-medium text-[#007AFF] transition-colors hover:bg-black/[0.05] dark:text-[#0A84FF] dark:hover:bg-white/[0.08]"
              >
                <span className="flex h-4 w-4 items-center justify-center text-[16px] leading-none" aria-hidden>+</span>
                <span>{esCliente ? 'Nuevo cliente' : 'Nuevo proveedor'}</span>
              </button>
            )}
            {!q && nuevo && (
              <p className="px-3 py-2 text-[13px] text-[#8E8E93]">Escribí el nombre y tocá Enter</p>
            )}

            {!q && !nuevo && (
              <Opcion selected={value === ''} onClick={() => elegir('')} muted>{sinContacto}</Opcion>
            )}
            {(!nuevo || q) && lista.map((c) => (
              <Opcion key={c.id} selected={c.id === value} onClick={() => elegir(c.id)}>{c.name}</Opcion>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

function Opcion({ selected, onClick, muted = false, children }: { selected: boolean; onClick: () => void; muted?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.08] ${muted ? 'text-[#8E8E93]' : 'text-[#1C1C1E] dark:text-white'}`}
    >
      <span className="w-4 shrink-0 text-[var(--reg-accent,#34C759)]">{selected ? '✓' : ''}</span>
      <span className="truncate">{children}</span>
    </button>
  )
}

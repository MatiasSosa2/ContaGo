'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { guardarArticulo } from '@/app/actions'
import {
  claveVariante, combinaciones, etiquetaVariante, normalizarAtributos, ordenarValores, type AtributoDef,
} from '@/lib/variantes'
import Foto, { achicarFoto } from './Foto'

/** Lo que se edita: un artículo con sus variantes (o un producto suelto, que pasa a ser artículo) */
export type ArticuloEditable = {
  articuloId: string | null
  /** Producto suelto que todavía no tiene artículo */
  productoId: string | null
  nombre: string
  tipo: 'MERCADERIA' | 'SERVICIO'
  categoria: string | null
  subcategoria: string | null
  marca: string | null
  unidad: string
  precioVenta: number
  atributos: AtributoDef[]
  variantes: { clave: string; etiqueta: string; precioPropio: boolean; precioVenta: number; stock: number; costo: number }[]
  fotoSrc: string | null
}

const UNIDADES = ['unidad', 'kg', 'gr', 'lt', 'ml', 'm', 'm²', 'm³', 'cm', 'caja', 'pack', 'bolsa', 'bulto', 'rollo', 'docena', 'balde', 'barra']
const ATRIBUTOS_SUGERIDOS = ['Talle', 'Color', 'Tamaño', 'Modelo', 'Puffs', 'Sabor', 'Capacidad', 'Fragancia']

/** "14240.5" → "14.240,5" (miles con punto y un decimal) */
function formatearMonto(raw: string) {
  const limpio = raw.replace(/[^\d,]/g, '')
  const [entero = '', ...resto] = limpio.split(',')
  const miles = entero.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return resto.length > 0 ? `${miles},${resto.join('').slice(0, 1)}` : miles
}
/** "14.240,5" → 14240.5 */
const aNumero = (txt: string) => Number(txt.replace(/\./g, '').replace(',', '.')) || 0
const montoInicial = (v: number) => (v > 0 ? formatearMonto(String(Math.round(v * 10) / 10).replace('.', ',')) : '')
const fmt$ = (v: number) => `$${v.toLocaleString('es-AR', { maximumFractionDigits: 1 })}`
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Selector con buscador y "+ Usar «…»" (categoría, subcategoría y unidad) */
function Selector({ label, value, opciones, onChange, placeholder, vacio }: {
  label: string
  value: string
  opciones: string[]
  onChange: (v: string) => void
  placeholder: string
  /** Texto cuando no hay nada elegido */
  vacio: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [pos, setPos] = useState<CSSProperties>({})
  const botonRef = useRef<HTMLButtonElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const cerrar = useCallback(() => { setOpen(false); setQ('') }, [])

  const abrir = () => {
    const r = botonRef.current?.getBoundingClientRect()
    if (r) {
      const abajo = window.innerHeight - r.bottom
      const left = Math.max(8, Math.min(r.right - 256, window.innerWidth - 264))
      setPos(abajo >= 300 || abajo >= r.top ? { top: r.bottom + 6, left } : { bottom: window.innerHeight - r.top + 6, left })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!botonRef.current?.contains(t) && !listaRef.current?.contains(t)) cerrar()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); cerrar() } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey, true) }
  }, [open, cerrar])

  const filtradas = opciones.filter((o) => norm(o).includes(norm(q)))
  const exacta = opciones.find((o) => norm(o) === norm(q))
  const elegir = (v: string) => { onChange(v); cerrar() }

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        onClick={() => (open ? cerrar() : abrir())}
        aria-label={label}
        className={`flex max-w-[60%] items-center gap-1 truncate text-[15px] transition-opacity active:opacity-60 ${value ? 'text-[#1C1C1E] dark:text-white' : 'text-[#C7C7CC]'}`}
      >
        <span className="truncate">{value || vacio}</span>
        <svg className="h-3 w-3 shrink-0 text-[#C7C7CC]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
      </button>
      {open && createPortal(
        <div ref={listaRef} style={pos} className="fixed z-[90] w-64 overflow-hidden rounded-xl bg-white/95 shadow-[0_12px_40px_rgba(0,0,0,0.22)] ring-1 ring-black/[0.06] backdrop-blur-xl dark:bg-[#2C2C2E]/95 dark:ring-white/10">
          <div className="border-b border-black/[0.06] px-3 py-2 dark:border-white/10">
            <input
              autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (exacta) elegir(exacta); else if (q.trim()) elegir(q.trim()) } }}
              placeholder={placeholder} aria-label={`Buscar ${label.toLowerCase()}`}
              className="w-full rounded-lg bg-black/[0.05] px-2.5 py-1.5 text-[14px] text-[#1C1C1E] outline-none placeholder:text-[#8E8E93] dark:bg-white/[0.08] dark:text-white"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {value && (
              <button type="button" onClick={() => elegir('')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] text-[#8E8E93] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]">
                <span className="w-4" />{vacio}
              </button>
            )}
            {q.trim() && !exacta && (
              <button type="button" onClick={() => elegir(q.trim())} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] font-medium text-[#007AFF] hover:bg-black/[0.05] dark:text-[#0A84FF] dark:hover:bg-white/[0.08]">
                + Usar «{q.trim()}»
              </button>
            )}
            {filtradas.map((o) => (
              <button key={o} type="button" onClick={() => elegir(o)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] text-[#1C1C1E] hover:bg-black/[0.05] dark:text-white dark:hover:bg-white/[0.08]">
                <span className="w-4 text-[#007AFF]">{o === value ? '✓' : ''}</span>{o}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

function Fila({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[46px] items-center justify-between gap-3 px-4 py-2">
      <span className="shrink-0 text-[15px] text-[#1C1C1E] dark:text-white">{label}</span>
      {children}
    </div>
  )
}

const INPUT = 'w-full min-w-0 bg-transparent text-right text-[15px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] dark:text-white'
const SECCION = 'mt-5 mb-1.5 px-4 text-[12px] uppercase tracking-wide text-[#8E8E93]'

/** Separa valores con coma o punto y coma, pero no la coma decimal ("1,2 L" queda junto) */
const SEPARADOR = /;|\n|,(?=\s|[^\d\s])/

/** Ejemplo de valores según el atributo */
function ejemploDe(nombre: string) {
  const n = norm(nombre)
  if (n.startsWith('talle')) return 'S, M, L'
  if (n.startsWith('color')) return 'Negra, Blanca'
  if (n.startsWith('puff')) return '10.000, 30.000'
  if (n.startsWith('tama') || n.startsWith('capac')) return '890 ml, 1,2 L'
  if (n.startsWith('sabor')) return 'Uva, Menta'
  return 'A, B, C'
}

/** Un atributo (Talle, Color…): nombre y sus valores como chips; Enter o coma agrega */
function AtributoEditor({ def, sugeridos, nombresUsados, onChange, onQuitar }: {
  def: AtributoDef
  /** Valores que ya se usaron antes para este atributo (autocompletar) */
  sugeridos: string[]
  nombresUsados: string[]
  onChange: (d: AtributoDef) => void
  onQuitar: () => void
}) {
  const [texto, setTexto] = useState('')
  const agregar = (raw: string) => {
    const nuevos = raw.split(SEPARADOR).map((v) => v.trim()).filter(Boolean)
    if (nuevos.length === 0) return
    const existentes = new Set(def.valores.map(norm))
    const valores = [...def.valores, ...nuevos.filter((v) => !existentes.has(norm(v)))]
    onChange({ ...def, valores: ordenarValores(valores) })
    setTexto('')
  }
  const quitar = (v: string) => onChange({ ...def, valores: def.valores.filter((x) => x !== v) })
  const libres = sugeridos.filter((s) => !def.valores.some((v) => norm(v) === norm(s)))
  const nombres = ATRIBUTOS_SUGERIDOS.filter((n) => !nombresUsados.some((u) => norm(u) === norm(n)))

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2">
        <input
          value={def.nombre}
          onChange={(e) => onChange({ ...def, nombre: e.target.value.slice(0, 30) })}
          placeholder="Atributo (talle, color…)"
          aria-label="Nombre del atributo"
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[#1C1C1E] outline-none placeholder:font-normal placeholder:text-[#C7C7CC] dark:text-white"
        />
        <button type="button" onClick={onQuitar} aria-label={`Quitar ${def.nombre || 'atributo'}`} className="text-[13px] text-[#FF3B30] transition-opacity active:opacity-60 dark:text-[#FF453A]">Quitar</button>
      </div>
      {/* Sin nombre todavía: atajos */}
      {!def.nombre.trim() && nombres.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {nombres.slice(0, 6).map((n) => (
            <button key={n} type="button" onClick={() => onChange({ ...def, nombre: n })} className="rounded-full bg-black/[0.04] px-2.5 py-0.5 text-[12px] text-[#3C3C43] transition active:scale-95 dark:bg-white/[0.08] dark:text-[#EBEBF5]">{n}</button>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {def.valores.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-[#007AFF]/10 py-0.5 pl-2.5 pr-1 text-[13px] text-[#007AFF] dark:bg-[#0A84FF]/20 dark:text-[#64D2FF]">
            {v}
            <button type="button" onClick={() => quitar(v)} aria-label={`Quitar ${v}`} className="flex h-4 w-4 items-center justify-center rounded-full text-[#007AFF]/70 hover:bg-[#007AFF]/15 dark:text-[#64D2FF]/80">
              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </span>
        ))}
        <input
          value={texto}
          onChange={(e) => { const v = e.target.value; if (SEPARADOR.test(v)) agregar(v); else setTexto(v) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); agregar(texto) }
            else if (e.key === 'Backspace' && !texto && def.valores.length > 0) quitar(def.valores[def.valores.length - 1])
          }}
          onBlur={() => agregar(texto)}
          placeholder={def.valores.length === 0 ? `Escribí y tocá Enter (ej: ${ejemploDe(def.nombre)})` : 'Agregar…'}
          aria-label={`Agregar valor de ${def.nombre || 'atributo'}`}
          className="min-w-[120px] flex-1 bg-transparent py-0.5 text-[13px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] dark:text-white"
        />
      </div>
      {/* Autocompletar: lo que ya usaste en otros artículos */}
      {libres.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-[#AEAEB2]">Usados:</span>
          {libres.slice(0, 12).map((s) => (
            <button key={s} type="button" onClick={() => agregar(s)} className="rounded-full px-2 py-0.5 text-[12px] text-[#8E8E93] ring-1 ring-black/[0.08] transition hover:text-[#1C1C1E] active:scale-95 dark:ring-white/10 dark:hover:text-white">+ {s}</button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Nuevo / Editar artículo (hoja iOS): datos, foto, precio base y variantes. Las variantes salen
 * de combinar los atributos (Talle S, M × Color Negra, Blanca = 4); cada una puede tener precio
 * propio (si no, usa el del artículo). El costo y el stock salen de las compras.
 */
export default function ProductoForm({ articulo, categorias, subcategorias, marcas, valoresUsados, onClose, onSaved }: {
  articulo: ArticuloEditable | null
  categorias: string[]
  /** Subcategorías ya usadas, por categoría */
  subcategorias: Record<string, string[]>
  marcas: string[]
  /** Valores ya usados por atributo (en minúscula): { talle: ['S','M'], color: [...] } */
  valoresUsados: Record<string, string[]>
  onClose: () => void
  onSaved: (articuloId: string) => void
}) {
  const [nombre, setNombre] = useState(articulo?.nombre ?? '')
  const [tipo, setTipo] = useState<'MERCADERIA' | 'SERVICIO'>(articulo?.tipo ?? 'MERCADERIA')
  const [categoria, setCategoria] = useState(articulo?.categoria?.trim() ?? '')
  const [subcategoria, setSubcategoria] = useState(articulo?.subcategoria?.trim() ?? '')
  const [marca, setMarca] = useState(articulo?.marca ?? '')
  const [unidad, setUnidad] = useState(articulo?.unidad?.trim() || 'unidad')
  const [precio, setPrecio] = useState(montoInicial(articulo?.precioVenta ?? 0))
  const [atributos, setAtributos] = useState<AtributoDef[]>(articulo?.atributos ?? [])
  // Precio propio por variante (texto del input), por clave
  const [precios, setPrecios] = useState<Record<string, string>>(() =>
    Object.fromEntries((articulo?.variantes ?? []).filter((v) => v.precioPropio).map((v) => [v.clave, montoInicial(v.precioVenta)])),
  )
  const [foto, setFoto] = useState<string | null | undefined>(undefined)
  const [fotoError, setFotoError] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const precioNum = aNumero(precio)
  // Los servicios no tienen variantes
  const defs = useMemo(() => (tipo === 'MERCADERIA' ? normalizarAtributos(atributos) : []), [atributos, tipo])
  const combos = useMemo(() => combinaciones(defs), [defs])
  const existentes = new Map((articulo?.variantes ?? []).map((v) => [v.clave, v]))
  const unica = articulo?.variantes.length === 1 ? articulo.variantes[0] : null
  const costo = combos.length === 0 ? unica?.costo ?? 0 : 0
  const margen = precioNum - costo
  const margenPct = precioNum > 0 ? (margen / precioNum) * 100 : 0
  const unidades = Array.from(new Set([...UNIDADES, unidad].filter(Boolean)))
  const fotoVista = foto === undefined ? articulo?.fotoSrc ?? null : foto
  // Un producto sin variantes con stock: ese stock queda en la primera variante nueva
  const stockSinVariante = unica && !unica.clave && unica.stock > 0 && combos.length > 0 && !existentes.has(claveVariante(combos[0])) ? unica.stock : 0

  const elegirFoto = async (file: File | undefined) => {
    if (!file) return
    setFotoError(null)
    try { setFoto(await achicarFoto(file)) } catch (e) { setFotoError((e as Error).message) }
  }

  const guardar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) return
    setError('')
    startTransition(async () => {
      const res = await guardarArticulo({
        articuloId: articulo?.articuloId ?? null,
        productoId: articulo?.articuloId ? null : articulo?.productoId ?? null,
        nombre, tipo, categoria, subcategoria, marca, unidad,
        precioVenta: precioNum,
        atributos: defs,
        precios: Object.fromEntries(combos.map((c) => {
          const k = claveVariante(c)
          const t = precios[k]?.trim()
          return [k, t ? aNumero(t) : null]
        })),
        ...(foto !== undefined ? { foto } : {}),
      })
      if (!res.success) { setError(res.error); return }
      onSaved(res.data!.articuloId)
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={articulo ? 'Editar producto' : 'Nuevo producto'}>
      <div className="reg-backdrop absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={guardar} className="reg-sheet relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-[#F2F2F7] shadow-2xl dark:bg-black md:rounded-3xl">
        <div className="flex justify-center pt-2 md:hidden" aria-hidden>
          <span className="h-[5px] w-9 rounded-full bg-black/15 dark:bg-white/20" />
        </div>
        {/* Encabezado tipo iOS: Cancelar · título · Guardar */}
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <button type="button" onClick={onClose} className="text-[15px] text-[#007AFF] dark:text-[#0A84FF]">Cancelar</button>
          <h3 className="text-[16px] font-semibold text-[#1C1C1E] dark:text-white">{articulo ? 'Editar producto' : 'Nuevo producto'}</h3>
          <button type="submit" disabled={pending || !nombre.trim()} className="text-[15px] font-semibold text-[#007AFF] disabled:opacity-40 dark:text-[#0A84FF]">
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>

        <div className="overflow-y-auto px-4 pb-6">
          {/* Producto / Servicio */}
          <div className="mt-2 flex rounded-lg bg-black/[0.06] p-0.5 dark:bg-white/[0.1]" role="tablist" aria-label="Tipo">
            {([['MERCADERIA', 'Producto'], ['SERVICIO', 'Servicio']] as const).map(([v, l]) => (
              <button key={v} type="button" role="tab" aria-selected={tipo === v} onClick={() => setTipo(v)}
                className={`flex-1 rounded-md py-1.5 text-[13px] transition ${tipo === v ? 'bg-white font-medium text-[#1C1C1E] shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-[#636366] dark:text-white' : 'text-[#3C3C43] dark:text-[#EBEBF5]/70'}`}>
                {l}
              </button>
            ))}
          </div>

          {/* Foto + nombre */}
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-white p-3 dark:bg-[#1C1C1E]">
            <button type="button" onClick={() => fileRef.current?.click()} aria-label={fotoVista ? 'Cambiar foto' : 'Agregar foto'} className="relative shrink-0 transition active:scale-95">
              <Foto src={fotoVista} alt={nombre || 'Foto'} className="h-16 w-16 rounded-xl" icono="h-6 w-6" />
              {!fotoVista && <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#007AFF] text-[13px] leading-none text-white ring-2 ring-white dark:bg-[#0A84FF] dark:ring-[#1C1C1E]">+</span>}
            </button>
            <div className="min-w-0 flex-1">
              <input
                required autoFocus={!articulo} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100}
                placeholder="Nombre (ej: Termo Quencher)" aria-label="Nombre"
                className="w-full bg-transparent text-[16px] font-medium text-[#1C1C1E] outline-none placeholder:font-normal placeholder:text-[#C7C7CC] dark:text-white"
              />
              <div className="mt-0.5 flex gap-3 text-[13px]">
                <button type="button" onClick={() => fileRef.current?.click()} className="text-[#007AFF] dark:text-[#0A84FF]">{fotoVista ? 'Cambiar foto' : 'Agregar foto'}</button>
                {fotoVista && <button type="button" onClick={() => setFoto(null)} className="text-[#8E8E93]">Quitar</button>}
              </div>
              {fotoError && <p className="text-[12px] text-[#FF3B30]">{fotoError}</p>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void elegirFoto(e.target.files?.[0]); e.target.value = '' }} />
          </div>

          {/* Datos */}
          <div className="mt-4 divide-y divide-black/[0.06] overflow-hidden rounded-xl bg-white dark:divide-white/[0.08] dark:bg-[#1C1C1E]">
            <Fila label="Categoría">
              <Selector label="Categoría" value={categoria} opciones={categorias} onChange={(v) => { if (v !== categoria) setSubcategoria(''); setCategoria(v) }} placeholder="Buscar o crear" vacio="Sin categoría" />
            </Fila>
            <Fila label="Subcategoría">
              <Selector label="Subcategoría" value={subcategoria} opciones={subcategorias[categoria] ?? []} onChange={setSubcategoria} placeholder="Ej: Termos, Remeras" vacio="Ninguna" />
            </Fila>
            <Fila label="Marca">
              <Selector label="Marca" value={marca} opciones={marcas} onChange={setMarca} placeholder="Buscar o crear" vacio="Opcional" />
            </Fila>
            <Fila label="Unidad">
              <Selector label="Unidad" value={unidad} opciones={unidades} onChange={(v) => setUnidad(v || 'unidad')} placeholder="Buscar o escribir" vacio="unidad" />
            </Fila>
          </div>

          {/* Precio, costo y margen en vivo */}
          <div className="mt-4 divide-y divide-black/[0.06] overflow-hidden rounded-xl bg-white dark:divide-white/[0.08] dark:bg-[#1C1C1E]">
            <Fila label={combos.length > 0 ? 'Precio base' : 'Precio de venta'}>
              <div className="flex items-center gap-1">
                <span className="text-[15px] text-[#8E8E93]">$</span>
                <input inputMode="decimal" value={precio} onChange={(e) => setPrecio(formatearMonto(e.target.value))} placeholder="0" aria-label="Precio de venta" className={`${INPUT} w-32 tabular-nums`} />
              </div>
            </Fila>
            {combos.length === 0 && (
              <Fila label="Costo prom.">
                <span className="text-right text-[15px] tabular-nums text-[#8E8E93]">{costo > 0 ? fmt$(costo) : 'Sale de las compras'}</span>
              </Fila>
            )}
          </div>
          <p className="mt-1.5 px-4 text-[12px] text-[#8E8E93]">
            {combos.length > 0
              ? 'Las variantes usan este precio; si alguna vale distinto, cargalo abajo.'
              : costo > 0 && precioNum > 0 ? (
                <>Margen <span className={`tabular-nums ${margen < 0 ? 'text-[#B8664F] dark:text-[#E3A592]' : 'text-[#1C1C1E] dark:text-white'}`}>{margen < 0 ? '−' : ''}{fmt$(Math.abs(margen))}</span> · {margenPct.toLocaleString('es-AR', { maximumFractionDigits: 0 })}% por {unidad || 'unidad'}</>
              ) : costo > 0 ? 'Cargá el precio para ver el margen.' : 'El costo y el stock se calculan solos con cada compra.'}
          </p>

          {/* Variantes: atributos y combinaciones */}
          {tipo === 'MERCADERIA' && (
            <>
              <p className={SECCION}>Variantes</p>
              <div className="divide-y divide-black/[0.06] overflow-hidden rounded-xl bg-white dark:divide-white/[0.08] dark:bg-[#1C1C1E]">
                {atributos.map((a, i) => (
                  <AtributoEditor
                    key={i}
                    def={a}
                    sugeridos={valoresUsados[norm(a.nombre)] ?? []}
                    nombresUsados={atributos.map((x) => x.nombre)}
                    onChange={(d) => setAtributos((prev) => prev.map((x, j) => (j === i ? d : x)))}
                    onQuitar={() => setAtributos((prev) => prev.filter((_, j) => j !== i))}
                  />
                ))}
                {atributos.length < 3 && (
                  <button type="button" onClick={() => setAtributos((prev) => [...prev, { nombre: '', valores: [] }])} className="flex w-full items-center gap-2 px-4 py-3 text-left text-[15px] text-[#007AFF] dark:text-[#0A84FF]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#007AFF] text-[14px] leading-none text-white dark:bg-[#0A84FF]">+</span>
                    {atributos.length === 0 ? 'Agregar talle, color, tamaño…' : 'Agregar otro atributo'}
                  </button>
                )}
              </div>
              <p className="mt-1.5 px-4 text-[12px] text-[#8E8E93]">
                {combos.length > 0
                  ? `${combos.length} variante${combos.length === 1 ? '' : 's'}, cada una con su stock.`
                  : 'Sin variantes: un solo stock para todo el producto.'}
              </p>

              {combos.length > 0 && (
                <div className="mt-3 divide-y divide-black/[0.06] overflow-hidden rounded-xl bg-white dark:divide-white/[0.08] dark:bg-[#1C1C1E]">
                  {combos.map((c, i) => {
                    const k = claveVariante(c)
                    const ex = existentes.get(k)
                    const propio = (precios[k] ?? '').trim() !== ''
                    return (
                      <div key={k} className="flex min-h-[42px] items-center gap-3 px-4 py-1.5">
                        <span className="min-w-0 flex-1 truncate text-[14px] text-[#1C1C1E] dark:text-white">
                          {etiquetaVariante(c, defs)}
                          {ex && ex.stock !== 0 && <span className="ml-1.5 text-[12px] tabular-nums text-[#AEAEB2]">{ex.stock.toLocaleString('es-AR')} u</span>}
                          {i === 0 && stockSinVariante > 0 && <span className="ml-1.5 text-[12px] text-[#AEAEB2]">recibe {stockSinVariante.toLocaleString('es-AR')} u actuales</span>}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className={`text-[14px] ${propio ? 'text-[#007AFF] dark:text-[#0A84FF]' : 'text-[#C7C7CC]'}`}>$</span>
                          <input
                            inputMode="decimal"
                            value={precios[k] ?? ''}
                            onChange={(e) => setPrecios((prev) => ({ ...prev, [k]: formatearMonto(e.target.value) }))}
                            placeholder={precio || '0'}
                            aria-label={`Precio de ${etiquetaVariante(c, defs)}`}
                            className={`w-24 bg-transparent text-right text-[14px] tabular-nums outline-none placeholder:text-[#C7C7CC] ${propio ? 'text-[#007AFF] dark:text-[#0A84FF]' : 'text-[#1C1C1E] dark:text-white'}`}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {error && <p className="mt-3 px-4 text-[13px] text-[#FF3B30]">{error}</p>}
        </div>
      </form>
    </div>,
    document.body,
  )
}

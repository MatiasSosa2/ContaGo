'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { actualizarPrecioVariante, guardarFotoArticulo } from '@/app/actions'
import { unidadDe } from '@/lib/unidades'
import { achicarFoto } from './Foto'
import StockGrid from './StockGrid'
import { CostoUnitario, DiferenciaStock, UnidadMedida } from './EditoresFicha'
import type { ArticuloVista, VarianteVista } from './tipos'

export type MovimientoFicha = {
  id: string
  fecha: Date | string
  tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'REVALUACION'
  /** DIFERENCIA_INVENTARIO = sobrante/faltante cargado a mano */
  concepto?: string | null
  cantidad: number
  precio: number
  motivo: string | null
  productoId: string
}

const fmt$ = (v: number) => `$${Math.round(v).toLocaleString('es-AR')}`
const fmtU = (v: number) => v.toLocaleString('es-AR', { maximumFractionDigits: 2 })
const fechaCorta = (d: Date | string | number) => new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '')
/** "45.000" / "45.000,5" → número */
const aNumero = (txt: string) => Number(txt.replace(/\./g, '').replace(',', '.'))
function formatearMonto(raw: string) {
  const limpio = raw.replace(/[^\d,]/g, '')
  const [entero = '', ...resto] = limpio.split(',')
  const miles = entero.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return resto.length > 0 ? `${miles},${resto.join('').slice(0, 1)}` : miles
}

/**
 * Ficha del artículo (hoja iOS): foto a la izquierda y datos a la derecha. Con variantes, se
 * elige por atributo (Talle, Color…) y los datos se ajustan a lo elegido; con una sola variante
 * elegida se pueden cambiar en el momento el precio, el stock (diferencia de inventario), el
 * costo unitario (fijo o promedio) y la unidad de medida.
 */
export default function ProductoSheet({ articulo, movimientos, varianteInicial, onClose, onEdit, onChanged }: {
  articulo: ArticuloVista
  movimientos: MovimientoFicha[]
  /** Abrir con esta variante elegida (ej. al tocar una celda de la cuadrícula) */
  varianteInicial?: string | null
  onClose: () => void
  onEdit: () => void
  /** Después de un cambio: recargar datos */
  onChanged: () => void
}) {
  const conVariantes = articulo.atributos.length > 0 && articulo.variantes.length > 1
  const inicial = articulo.variantes.find((v) => v.id === varianteInicial)
  // Valor elegido por atributo ('' = todos)
  const [eleccion, setEleccion] = useState<Record<string, string>>(() =>
    Object.fromEntries(articulo.atributos.map((a) => [a.nombre, inicial?.valores?.[a.nombre] ?? ''])),
  )
  // Editor abierto debajo de los datos
  const [editor, setEditor] = useState<'stock' | 'costo' | 'unidad' | null>(null)
  const [editPrecio, setEditPrecio] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  // Variantes que coinciden con lo elegido
  const visibles = articulo.variantes.filter((v) =>
    articulo.atributos.every((a) => !eleccion[a.nombre] || v.valores?.[a.nombre] === eleccion[a.nombre]),
  )
  const una: VarianteVista | null = visibles.length === 1 ? visibles[0] : null
  const idsVisibles = new Set(visibles.map((v) => v.id))
  const movsVisibles = movimientos.filter((m) => idsVisibles.has(m.productoId) && m.tipo !== 'REVALUACION')
  // Historial de costos de la variante elegida (cambios a costo fijo o vuelta al promedio)
  const historialCostos = una ? movimientos.filter((m) => m.productoId === una.id && m.tipo === 'REVALUACION') : []
  const etiquetaDe = new Map(articulo.variantes.map((v) => [v.id, v.etiqueta]))

  const stock = visibles.reduce((s, v) => s + v.stockActual, 0)
  const precios = visibles.map((v) => v.precioVenta)
  const pMin = Math.min(...precios)
  const pMax = Math.max(...precios)
  const conStock = visibles.filter((v) => v.stockActual > 0)
  const base = conStock.length > 0 ? conStock : visibles
  const peso = (v: VarianteVista) => (conStock.length > 0 ? v.stockActual : 1)
  const totalPeso = base.reduce((s, v) => s + peso(v), 0) || 1
  const costo = base.reduce((s, v) => s + v.precioCosto * peso(v), 0) / totalPeso
  const precioProm = base.reduce((s, v) => s + v.precioVenta * peso(v), 0) / totalPeso
  const margen = precioProm - costo
  const margenPct = precioProm > 0 ? (margen / precioProm) * 100 : 0

  const elegir = (atributo: string, valor: string) => {
    setEditor(null)
    setEleccion((prev) => ({ ...prev, [atributo]: prev[atributo] === valor ? '' : valor }))
  }
  const elegirVariante = (v: VarianteVista) => {
    setEditor(null)
    setEleccion(Object.fromEntries(articulo.atributos.map((a) => [a.nombre, v.valores?.[a.nombre] ?? ''])))
  }
  // Con varias variantes a la vista: primero hay que elegir una
  const abrirEditor = (cual: 'stock' | 'costo' | 'unidad') => {
    if (cual !== 'unidad' && !una) { setError('Elegí una variante'); return }
    setError(null)
    setEditor((prev) => (prev === cual ? null : cual))
  }
  const listo = () => { setEditor(null); onChanged() }

  const cambiarFoto = (file: File | undefined) => {
    if (!file) return
    setError(null)
    startTransition(async () => {
      try {
        const data = await achicarFoto(file)
        const res = await guardarFotoArticulo({ articuloId: articulo.articuloId, productoId: articulo.variantes[0]?.id }, data)
        if (!res.success) { setError(res.error); return }
        onChanged()
      } catch (e) { setError((e as Error).message) }
    })
  }

  const guardarPrecio = (valor: number | null) => {
    if (!una) return
    if (valor !== null && (!Number.isFinite(valor) || valor < 0)) { setError('Ingresá un precio válido'); return }
    setError(null)
    startTransition(async () => {
      const res = await actualizarPrecioVariante(una.id, valor)
      if (!res.success) { setError(res.error); return }
      setEditPrecio(null)
      onChanged()
    })
  }

  const subtitulo = [articulo.marca, [articulo.categoria, articulo.subcategoria].filter(Boolean).join(' › ')].filter(Boolean).join(' · ')
  const fila = 'flex min-h-[44px] items-center justify-between gap-3 px-4 py-2'

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={articulo.nombre}>
      <div className="reg-backdrop absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="reg-sheet relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-[#F2F2F7] shadow-2xl dark:bg-black md:rounded-3xl">
        <div className="flex justify-center pt-2 md:hidden" aria-hidden>
          <span className="h-[5px] w-9 rounded-full bg-black/15 dark:bg-white/20" />
        </div>
        {!editor && (
          <button type="button" onClick={onEdit} className="absolute right-14 top-4 z-10 h-7 text-[15px] text-[#007AFF] transition-opacity active:opacity-60 dark:text-[#0A84FF]">
            Editar
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.06] text-[#8E8E93] transition active:scale-90 dark:bg-white/10"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>

        {/* Pantalla de edición (entra de costado, como en iOS) */}
        {editor && (
          <div key={editor} className="animate-[reg-push-in_280ms_cubic-bezier(0.32,0.72,0,1)] overflow-y-auto px-4 pb-6 pt-4 md:px-6">
            <div className="relative mb-4 flex h-7 items-center justify-center pr-8">
              <button type="button" onClick={() => setEditor(null)} className="absolute left-0 flex max-w-[45%] items-center gap-0.5 text-[16px] text-[#007AFF] transition-opacity active:opacity-60 dark:text-[#0A84FF]">
                <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                <span className="truncate">{articulo.nombre}</span>
              </button>
              <h3 className="text-[16px] font-semibold text-[#1C1C1E] dark:text-white">
                {editor === 'stock' ? 'Corregir stock' : editor === 'costo' ? 'Costo unitario' : 'Unidad de medida'}
              </h3>
            </div>
            <div className="mx-auto max-w-md">
              {editor === 'stock' && una && (
                <DiferenciaStock
                  key={una.id}
                  productoId={una.id}
                  etiqueta={una.etiqueta}
                  stockHoy={una.stockHoy}
                  costo={una.costoFijo ?? una.costoPromedio}
                  unidad={articulo.unidad}
                  onCancelar={() => setEditor(null)}
                  onListo={listo}
                />
              )}
              {editor === 'costo' && una && (
                <CostoUnitario
                  key={una.id}
                  productoId={una.id}
                  costoHoy={una.costoFijo ?? una.costoPromedio}
                  promedio={una.costoPromedio}
                  fijo={una.costoFijo != null}
                  precio={una.precioVenta}
                  stockHoy={una.stockHoy}
                  unidad={articulo.unidad}
                  onCancelar={() => setEditor(null)}
                  onListo={listo}
                />
              )}
              {editor === 'unidad' && (
                <UnidadMedida
                  articuloId={articulo.articuloId}
                  productoId={articulo.variantes[0].id}
                  unidad={articulo.unidad}
                  stock={stock}
                  onCancelar={() => setEditor(null)}
                  onListo={listo}
                />
              )}
            </div>
          </div>
        )}

        <div className={`overflow-y-auto px-4 pb-5 pt-5 md:px-6 ${editor ? 'hidden' : ''}`}>
          {/* Encabezado */}
          <div className="pr-28">
            <h3 className="text-[20px] font-semibold tracking-tight text-[#1C1C1E] dark:text-white">{articulo.nombre}</h3>
            <p className="text-[13px] text-[#8E8E93]">{subtitulo || 'Sin categoría'}</p>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
            {/* Foto: tocar para cambiarla (en el celu, más chica y centrada) */}
            <div className="mx-auto w-full max-w-[200px] md:max-w-none">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={pending}
                aria-label={articulo.fotoSrc ? 'Cambiar foto' : 'Agregar foto'}
                className="group relative block w-full overflow-hidden rounded-2xl bg-white transition active:scale-[0.99] dark:bg-[#1C1C1E]"
              >
                {articulo.fotoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={articulo.fotoSrc} alt={articulo.nombre} className="aspect-square w-full object-cover" />
                ) : (
                  <span className="flex aspect-square w-full flex-col items-center justify-center gap-2 text-[#C7C7CC] dark:text-[#48484A]">
                    <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V7.5A2.5 2.5 0 0 1 5.5 5h1.3l1.4-2h7.6l1.4 2h1.3A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5Z" />
                      <circle cx="12" cy="12" r="3.5" />
                    </svg>
                    <span className="text-[13px] text-[#007AFF] dark:text-[#0A84FF]">Agregar foto</span>
                  </span>
                )}
                {articulo.fotoSrc && (
                  <span className="absolute inset-x-0 bottom-0 bg-black/45 py-1.5 text-center text-[12px] text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">Cambiar foto</span>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { cambiarFoto(e.target.files?.[0]); e.target.value = '' }} />
            </div>

            {/* Datos */}
            <div className="min-w-0">
              {/* Variantes: un grupo de opciones por atributo */}
              {conVariantes && (
                <div className="mb-3 space-y-2">
                  {articulo.atributos.map((a) => (
                    <div key={a.nombre}>
                      <p className="mb-1 text-[11px] text-[#8E8E93]">{a.nombre}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {a.valores.map((val) => {
                          const on = eleccion[a.nombre] === val
                          // Sin stock en ninguna variante con ese valor: más apagado
                          const hay = articulo.variantes.some((v) => v.valores?.[a.nombre] === val && v.stockActual > 0)
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => elegir(a.nombre, val)}
                              aria-pressed={on}
                              className={`rounded-full px-3 py-1 text-[13px] transition active:scale-95 ${on
                                ? 'bg-[#007AFF] text-white dark:bg-[#0A84FF]'
                                : `bg-white ring-1 ring-black/[0.08] dark:bg-[#1C1C1E] dark:ring-white/10 ${hay ? 'text-[#1C1C1E] dark:text-white' : 'text-[#AEAEB2] dark:text-[#636366]'}`}`}
                            >
                              {val}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Precio, costo y margen: lo principal */}
              <p className="mb-1.5 px-4 text-[12px] uppercase tracking-wide text-[#8E8E93]">Precio</p>
              <div className="divide-y divide-black/[0.06] overflow-hidden rounded-xl bg-white dark:divide-white/[0.08] dark:bg-[#1C1C1E]">
                <div className={fila}>
                  <span className="text-[15px] text-[#1C1C1E] dark:text-white">Precio</span>
                  {editPrecio !== null && una ? (
                    <span className="flex items-center gap-2">
                      <span className="text-[15px] text-[#8E8E93]">$</span>
                      <input
                        autoFocus inputMode="decimal" value={editPrecio}
                        onChange={(e) => setEditPrecio(formatearMonto(e.target.value))}
                        onKeyDown={(e) => { if (e.key === 'Enter') guardarPrecio(aNumero(editPrecio)); if (e.key === 'Escape') { e.stopPropagation(); setEditPrecio(null) } }}
                        aria-label="Precio nuevo"
                        className="w-28 rounded-md bg-black/[0.05] px-2 py-1 text-right text-[15px] tabular-nums text-[#1C1C1E] outline-none dark:bg-white/[0.08] dark:text-white"
                      />
                      <button type="button" onClick={() => guardarPrecio(aNumero(editPrecio))} disabled={pending} className="text-[14px] font-semibold text-[#007AFF] disabled:opacity-50 dark:text-[#0A84FF]">OK</button>
                    </span>
                  ) : una ? (
                    // Precio rápido: tocar para cambiarlo
                    <button
                      type="button"
                      onClick={() => setEditPrecio(formatearMonto(String(Math.round(una.precioVenta * 10) / 10).replace('.', ',')))}
                      aria-label="Cambiar precio"
                      className={`flex items-center gap-2 text-[15px] font-semibold tabular-nums transition-opacity active:opacity-60 ${una.precioPropio && conVariantes ? 'text-[#007AFF] dark:text-[#0A84FF]' : 'text-[#1C1C1E] dark:text-white'}`}
                    >
                      {fmt$(una.precioVenta)}
                      <svg className="h-3.5 w-3.5 shrink-0 text-[#C7C7CC] dark:text-[#48484A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </button>
                  ) : (
                    <span className="text-[15px] font-semibold tabular-nums text-[#1C1C1E] dark:text-white">
                      {pMin === pMax ? fmt$(pMin) : `${fmt$(pMin)} – ${fmt$(pMax)}`}
                    </span>
                  )}
                </div>
                {una && una.precioPropio && conVariantes && editPrecio === null && (
                  <div className="flex items-center justify-between px-4 py-1.5 text-[12px] text-[#8E8E93]">
                    <span>Precio propio de esta variante</span>
                    <button type="button" onClick={() => guardarPrecio(null)} disabled={pending} className="text-[#007AFF] dark:text-[#0A84FF]">Usar precio base ({fmt$(articulo.precioBase)})</button>
                  </div>
                )}
                {/* Costo unitario: el fijo (si lo hay) o el promedio. El promedio del sistema se ve al editarlo */}
                <button type="button" onClick={() => abrirEditor('costo')} className={`${fila} w-full text-left transition-colors active:bg-black/[0.04] dark:active:bg-white/[0.06]`}>
                  <span className="flex items-center gap-1.5 text-[15px] text-[#1C1C1E] dark:text-white">
                    Costo unitario
                    {una?.costoFijo != null && Math.abs(costo - una.costoFijo) < 0.5 && <span className="text-[12px] text-[#8E8E93]">· fijo</span>}
                  </span>
                  <span className="flex items-center gap-2 text-[15px] tabular-nums text-[#1C1C1E] dark:text-white">
                    {costo > 0 ? fmt$(costo) : '—'}
                    {una && <svg className="h-3.5 w-3.5 shrink-0 text-[#C7C7CC] dark:text-[#48484A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>}
                  </span>
                </button>
                <div className={fila}>
                  <span className="text-[15px] text-[#1C1C1E] dark:text-white">Margen</span>
                  <span className="text-[15px] tabular-nums text-[#1C1C1E] dark:text-white">
                    {costo > 0 ? <>{margen < 0 ? '−' : ''}{fmt$(Math.abs(margen))} <span className="text-[13px] text-[#8E8E93]">· {margenPct.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%</span></> : '—'}
                  </span>
                </div>
              </div>

              {/* Stock y unidad: una línea sutil (tocar cada uno para cambiarlo) */}
              <div className="mt-2.5 flex flex-wrap items-center gap-x-1 px-4 text-[13px] text-[#8E8E93]">
                <button type="button" onClick={() => abrirEditor('stock')} className="flex items-center gap-1 transition-opacity active:opacity-60">
                  Stock <span className="font-medium tabular-nums text-[#1C1C1E] dark:text-white">{fmtU(stock)} {unidadDe(articulo.unidad, stock)}</span>
                  {conVariantes && !una && <span>en {visibles.length} variantes</span>}
                  <svg className="h-3 w-3 shrink-0 text-[#C7C7CC] dark:text-[#48484A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
                <span aria-hidden className="mx-1 text-[#C7C7CC] dark:text-[#48484A]">·</span>
                <button type="button" onClick={() => abrirEditor('unidad')} className="flex items-center gap-1 transition-opacity active:opacity-60">
                  Unidad <span className="text-[#1C1C1E] dark:text-white">{articulo.unidad || 'unidad'}</span>
                  <svg className="h-3 w-3 shrink-0 text-[#C7C7CC] dark:text-[#48484A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
              {error && <p className="mt-2 px-4 text-[12px] text-[#FF3B30]">{error}</p>}
            </div>
          </div>

          {/* Stock por talle y color */}
          {articulo.atributos.length === 2 && (
            <div className="mt-4 rounded-2xl bg-white p-3 dark:bg-[#1C1C1E]">
              <p className="mb-1 px-1 text-[12px] text-[#8E8E93]">Stock por {articulo.atributos.map((a) => a.nombre.toLowerCase()).join(' y ')}</p>
              <StockGrid articulo={articulo} seleccionada={una?.id ?? null} onElegir={elegirVariante} />
            </div>
          )}

          {/* Movimientos: plegado */}
          {movsVisibles.length > 0 && (
            <details className="ios-disclosure group mt-4">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl bg-white px-4 py-3 text-[15px] text-[#1C1C1E] dark:bg-[#1C1C1E] dark:text-white [&::-webkit-details-marker]:hidden">
                <span>Movimientos <span className="text-[#8E8E93]">({movsVisibles.length})</span></span>
                <svg className="h-3.5 w-3.5 text-[#C7C7CC] transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </summary>
              <div className="mt-2 divide-y divide-black/[0.06] overflow-hidden rounded-xl bg-white dark:divide-white/[0.08] dark:bg-[#1C1C1E]">
                {movsVisibles.map((m) => {
                  const entra = m.tipo === 'ENTRADA'
                  const etiqueta = conVariantes && !una ? etiquetaDe.get(m.productoId) : ''
                  const esDif = m.concepto === 'DIFERENCIA_INVENTARIO'
                  return (
                    <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] text-[#1C1C1E] dark:text-white">{m.motivo || (entra ? 'Compra' : m.tipo === 'SALIDA' ? 'Venta' : 'Ajuste')}</p>
                        <p className="text-[12px] text-[#8E8E93]">{fechaCorta(m.fecha)}{etiqueta ? ` · ${etiqueta}` : ''}{esDif ? ` · ${fmt$(m.cantidad * m.precio)} ${entra ? 'de ganancia' : 'de pérdida'}` : ''}</p>
                      </div>
                      <span className={`shrink-0 text-[14px] tabular-nums ${entra ? 'text-[#4F8A6B] dark:text-[#8FC0A4]' : m.tipo === 'SALIDA' ? 'text-[#B8664F] dark:text-[#E3A592]' : 'text-[#8E8E93]'}`}>
                        {entra ? '+' : m.tipo === 'SALIDA' ? '−' : ''}{fmtU(m.cantidad)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </details>
          )}

          {/* Historial de costos de la variante */}
          {historialCostos.length > 0 && (
            <details className="ios-disclosure group mt-3">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl bg-white px-4 py-3 text-[15px] text-[#1C1C1E] dark:bg-[#1C1C1E] dark:text-white [&::-webkit-details-marker]:hidden">
                <span>Historial de costos <span className="text-[#8E8E93]">({historialCostos.length})</span></span>
                <svg className="h-3.5 w-3.5 text-[#C7C7CC] transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </summary>
              <div className="mt-2 divide-y divide-black/[0.06] overflow-hidden rounded-xl bg-white dark:divide-white/[0.08] dark:bg-[#1C1C1E]">
                {historialCostos.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] text-[#1C1C1E] dark:text-white">{m.motivo === 'Vuelve al costo promedio' ? 'Costo promedio' : 'Costo fijo'}</p>
                      <p className="text-[12px] text-[#8E8E93]">Desde {fechaCorta(m.fecha)}</p>
                    </div>
                    <span className="shrink-0 text-[14px] tabular-nums text-[#1C1C1E] dark:text-white">{fmt$(m.precio)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

        </div>
      </div>
    </div>,
    document.body,
  )
}

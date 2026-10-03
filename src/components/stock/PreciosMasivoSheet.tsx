'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { actualizarPreciosMasivo } from '@/app/actions'

type ProductoPrecio = { id: string; nombre: string; categoria: string | null; marca: string | null; precioVenta: number }

const fmt$ = (v: number) => `$${Math.round(v).toLocaleString('es-AR')}`

function Segmentado<T extends string | number>({ opciones, valor, onChange, label }: {
  opciones: readonly (readonly [T, string])[]
  valor: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="flex rounded-lg bg-black/[0.06] p-0.5 dark:bg-white/[0.1]" role="tablist" aria-label={label}>
      {opciones.map(([v, l]) => (
        <button key={String(v)} type="button" role="tab" aria-selected={valor === v} onClick={() => onChange(v)}
          className={`flex-1 rounded-md py-1.5 text-[13px] transition ${valor === v ? 'bg-white font-medium text-[#1C1C1E] shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-[#636366] dark:text-white' : 'text-[#3C3C43] dark:text-[#EBEBF5]/70'}`}>
          {l}
        </button>
      ))}
    </div>
  )
}

/** Actualizar precios en bloque (hoja iOS): a todo, una categoría o una marca, con vista previa */
export default function PreciosMasivoSheet({ productos, onClose, onDone }: {
  productos: ProductoPrecio[]
  onClose: () => void
  onDone: (cambiados: number) => void
}) {
  const [alcance, setAlcance] = useState<'TODO' | 'CATEGORIA' | 'MARCA'>('TODO')
  const [filtro, setFiltro] = useState('')
  const [sentido, setSentido] = useState<'SUBE' | 'BAJA'>('SUBE')
  const [pctTxt, setPctTxt] = useState('')
  const [redondeo, setRedondeo] = useState<1 | 10 | 100>(10)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const unicos = (xs: (string | null)[]) => Array.from(new Set(xs.map((x) => x?.trim()).filter((x): x is string => !!x))).sort((a, b) => a.localeCompare(b, 'es'))
  const opciones = alcance === 'CATEGORIA' ? unicos(productos.map((p) => p.categoria)) : alcance === 'MARCA' ? unicos(productos.map((p) => p.marca)) : []
  const afectados = productos.filter((p) =>
    alcance === 'TODO' ? true : alcance === 'CATEGORIA' ? p.categoria?.trim() === filtro : p.marca?.trim() === filtro,
  )
  const pct = (Number(pctTxt.replace(',', '.')) || 0) * (sentido === 'SUBE' ? 1 : -1)
  const nuevo = (precio: number) => Math.max(0, Math.round((precio * (1 + pct / 100)) / redondeo) * redondeo)
  const listo = pct !== 0 && Math.abs(pct) < 100 && afectados.length > 0 && (alcance === 'TODO' || !!filtro)

  const aplicar = () => {
    if (!listo) return
    setError(null)
    startTransition(async () => {
      const res = await actualizarPreciosMasivo({
        categoria: alcance === 'CATEGORIA' ? filtro : null,
        marca: alcance === 'MARCA' ? filtro : null,
        porcentaje: pct,
        redondeo,
      })
      if (!res.success) { setError(res.error); return }
      onDone(res.data?.cambiados ?? afectados.length)
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label="Actualizar precios">
      <div className="reg-backdrop absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="reg-sheet relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-[#F2F2F7] shadow-2xl dark:bg-black md:rounded-3xl">
        <div className="flex justify-center pt-2 md:hidden" aria-hidden>
          <span className="h-[5px] w-9 rounded-full bg-black/15 dark:bg-white/20" />
        </div>
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <button type="button" onClick={onClose} className="text-[15px] text-[#007AFF] dark:text-[#0A84FF]">Cancelar</button>
          <h3 className="text-[16px] font-semibold text-[#1C1C1E] dark:text-white">Actualizar precios</h3>
          <button type="button" onClick={aplicar} disabled={!listo || pending} className="text-[15px] font-semibold text-[#007AFF] disabled:opacity-40 dark:text-[#0A84FF]">
            {pending ? 'Aplicando…' : 'Aplicar'}
          </button>
        </div>

        <div className="overflow-y-auto px-4 pb-6">
          <p className="mb-1.5 mt-3 px-4 text-[12px] uppercase tracking-wide text-[#8E8E93]">Aplicar a</p>
          <Segmentado label="Aplicar a" valor={alcance} onChange={(v) => { setAlcance(v); setFiltro('') }} opciones={[['TODO', 'Todo'], ['CATEGORIA', 'Categoría'], ['MARCA', 'Marca']] as const} />
          {alcance !== 'TODO' && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {opciones.length === 0 && <p className="px-1 text-[13px] text-[#8E8E93]">No hay {alcance === 'CATEGORIA' ? 'categorías' : 'marcas'} cargadas.</p>}
              {opciones.map((o) => (
                <button key={o} type="button" onClick={() => setFiltro(o)} aria-pressed={filtro === o}
                  className={`rounded-full px-3 py-1 text-[13px] transition active:scale-95 ${filtro === o ? 'bg-[#007AFF] text-white dark:bg-[#0A84FF]' : 'bg-white text-[#1C1C1E] ring-1 ring-black/[0.08] dark:bg-[#1C1C1E] dark:text-white dark:ring-white/10'}`}>
                  {o}
                </button>
              ))}
            </div>
          )}

          <p className="mb-1.5 mt-5 px-4 text-[12px] uppercase tracking-wide text-[#8E8E93]">Cambio</p>
          <div className="divide-y divide-black/[0.06] overflow-hidden rounded-xl bg-white dark:divide-white/[0.08] dark:bg-[#1C1C1E]">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="w-40"><Segmentado label="Sentido" valor={sentido} onChange={setSentido} opciones={[['SUBE', 'Subir'], ['BAJA', 'Bajar']] as const} /></div>
              <div className="flex items-center gap-1">
                <input autoFocus inputMode="decimal" value={pctTxt} onChange={(e) => setPctTxt(e.target.value.replace(/[^\d,]/g, '').slice(0, 5))} placeholder="0" aria-label="Porcentaje"
                  className="w-16 bg-transparent text-right text-[17px] font-semibold tabular-nums text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] dark:text-white" />
                <span className="text-[17px] text-[#8E8E93]">%</span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-[15px] text-[#1C1C1E] dark:text-white">Redondear a</span>
              <div className="w-44"><Segmentado label="Redondeo" valor={redondeo} onChange={setRedondeo} opciones={[[1, '$1'], [10, '$10'], [100, '$100']] as const} /></div>
            </div>
          </div>

          {/* Vista previa */}
          <p className="mb-1.5 mt-5 px-4 text-[12px] uppercase tracking-wide text-[#8E8E93]">
            Vista previa · {afectados.length} producto{afectados.length === 1 ? '' : 's'}
          </p>
          <div className="divide-y divide-black/[0.06] overflow-hidden rounded-xl bg-white dark:divide-white/[0.08] dark:bg-[#1C1C1E]">
            {(alcance === 'TODO' || filtro) && afectados.slice(0, 6).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2 text-[13px]">
                <span className="min-w-0 truncate text-[#1C1C1E] dark:text-white">{p.nombre}</span>
                <span className="shrink-0 tabular-nums">
                  <span className="text-[#8E8E93]">{fmt$(p.precioVenta)}</span>
                  {pct !== 0 && <><span className="mx-1 text-[#C7C7CC]">→</span><span className="font-medium text-[#1C1C1E] dark:text-white">{fmt$(nuevo(p.precioVenta))}</span></>}
                </span>
              </div>
            ))}
            {(alcance === 'TODO' || filtro) && afectados.length > 6 && (
              <p className="px-4 py-2 text-[12px] text-[#8E8E93]">y {afectados.length - 6} más</p>
            )}
            {alcance !== 'TODO' && !filtro && <p className="px-4 py-3 text-[13px] text-[#8E8E93]">Elegí {alcance === 'CATEGORIA' ? 'una categoría' : 'una marca'}.</p>}
          </div>
          {error && <p className="mt-3 px-4 text-[13px] text-[#FF3B30]">{error}</p>}
        </div>
      </div>
    </div>,
    document.body,
  )
}

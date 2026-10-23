'use client'

import { useRef, useState, useTransition } from 'react'
import { ajustarStock, cambiarUnidad, fijarCostoUnitario } from '@/app/actions'
import { CalendarPopover, SingleCalendar } from '@/components/ui/IosCalendar'
import { unidadDe } from '@/lib/unidades'

const fmt$ = (v: number) => `$${Math.round(v).toLocaleString('es-AR')}`
const fmtU = (v: number) => v.toLocaleString('es-AR', { maximumFractionDigits: 2 })
/** "45.000" / "45.000,5" → número */
const aNumero = (txt: string) => Number(txt.replace(/\./g, '').replace(',', '.'))
export function formatearMonto(raw: string) {
  const limpio = raw.replace(/[^\d,]/g, '')
  const [entero = '', ...resto] = limpio.split(',')
  const miles = entero.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return resto.length > 0 ? `${miles},${resto.join('').slice(0, 1)}` : miles
}
const hoyISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())
const aISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fechaLarga = (iso: string) => (iso === hoyISO()
  ? 'Hoy'
  : new Date(`${iso}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', ''))

/** Bloque blanco agrupado (como Ajustes de iOS) */
const CARD = 'rounded-2xl bg-white p-4 dark:bg-[#1C1C1E]'
const INPUT = 'rounded-lg bg-black/[0.05] px-3 py-2 text-[15px] text-[#1C1C1E] outline-none placeholder:text-[#8E8E93] dark:bg-white/[0.08] dark:text-white'
const MOTIVOS = ['Conteo', 'Rotura', 'Vencido', 'Robo', 'Muestra o regalo']

/** Botón principal de la pantalla (volver es "‹ Atrás" arriba) */
function Botones({ onGuardar, pending, texto = 'Guardar', disabled = false }: {
  onCancelar?: () => void
  onGuardar: () => void
  pending: boolean
  texto?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button" onClick={onGuardar} disabled={pending || disabled}
      className="mt-5 w-full rounded-xl bg-[#007AFF] py-3 text-[16px] font-semibold text-white transition active:scale-[0.99] active:opacity-90 disabled:opacity-40 dark:bg-[#0A84FF]"
    >
      {pending ? 'Guardando…' : texto}
    </button>
  )
}

/**
 * Corregir el stock de una variante: se ve antes → después, la diferencia valorizada al costo
 * de hoy, el motivo y la fecha. Se registra como diferencia de inventario (no mueve la caja).
 */
export function DiferenciaStock({ productoId, etiqueta, stockHoy, costo, unidad, onCancelar, onListo }: {
  productoId: string
  etiqueta: string
  stockHoy: number
  costo: number
  unidad: string
  onCancelar: () => void
  onListo: () => void
}) {
  const [nuevo, setNuevo] = useState('')
  const [motivo, setMotivo] = useState('')
  const [detalle, setDetalle] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [calendario, setCalendario] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const fechaRef = useRef<HTMLButtonElement>(null)

  const n = nuevo.trim() === '' ? null : Number(nuevo.replace(',', '.'))
  const valido = n !== null && Number.isFinite(n) && n >= 0
  const dif = valido ? Math.round((n! - stockHoy) * 100) / 100 : 0
  const sobra = dif > 0
  const tono = sobra ? 'text-[#4F8A6B] dark:text-[#8FC0A4]' : 'text-[#B8664F] dark:text-[#E3A592]'

  const registrar = () => {
    if (!valido) { setError('Ingresá el stock nuevo'); return }
    if (Math.abs(dif) < 0.001) { setError('Es igual al stock actual'); return }
    setError(null)
    const texto = [motivo, detalle.trim()].filter(Boolean).join(' · ')
    startTransition(async () => {
      const res = await ajustarStock(productoId, n!, texto, fecha)
      if (!res.success) { setError(res.error); return }
      onListo()
    })
  }

  return (
    <div className={CARD}>
      {etiqueta && <p className="text-center text-[13px] text-[#8E8E93]">{etiqueta}</p>}

      {/* Antes → después */}
      <div className="mt-1 flex items-center justify-center gap-3">
        <div className="text-center">
          <p className="text-[11px] text-[#8E8E93]">Hoy</p>
          <p className="text-[24px] font-semibold tabular-nums text-[#AEAEB2]">{fmtU(stockHoy)}</p>
        </div>
        <svg className="h-4 w-4 text-[#C7C7CC]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" /></svg>
        <div className="text-center">
          <p className="text-[11px] text-[#8E8E93]">Nuevo</p>
          <input
            autoFocus inputMode="decimal" value={nuevo}
            onChange={(e) => setNuevo(e.target.value.replace(/[^\d,.]/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') registrar() }}
            placeholder={fmtU(stockHoy)} aria-label="Stock nuevo"
            className="w-24 bg-transparent text-center text-[24px] font-semibold tabular-nums text-[#1C1C1E] outline-none placeholder:text-[#D1D1D6] dark:text-white dark:placeholder:text-[#48484A]"
          />
        </div>
        <span className="w-14 text-[12px] text-[#8E8E93]">{unidadDe(unidad, n ?? stockHoy)}</span>
      </div>

      {/* Diferencia valorizada */}
      {valido && Math.abs(dif) >= 0.001 && (
        <div className={`mt-3 rounded-xl px-3 py-2 text-center text-[13px] ${sobra ? 'bg-[#6FA287]/[0.12]' : 'bg-[#D08770]/[0.12]'}`}>
          <span className={`font-semibold tabular-nums ${tono}`}>{sobra ? 'Sobran' : 'Faltan'} {fmtU(Math.abs(dif))} {unidadDe(unidad, Math.abs(dif))}</span>
          <span className="text-[#8E8E93]"> × {fmt$(costo)} = </span>
          <span className={`font-semibold tabular-nums ${tono}`}>{sobra ? '+' : '−'}{fmt$(Math.abs(dif) * costo)}</span>
          <span className="text-[#8E8E93]"> de {sobra ? 'ganancia' : 'pérdida'}</span>
        </div>
      )}

      {/* Motivo */}
      <p className="mb-1.5 mt-4 text-[11px] text-[#8E8E93]">Motivo (opcional)</p>
      <div className="flex flex-wrap gap-1.5">
        {MOTIVOS.map((m) => (
          <button key={m} type="button" onClick={() => setMotivo((prev) => (prev === m ? '' : m))} aria-pressed={motivo === m}
            className={`rounded-full px-3 py-1 text-[13px] transition active:scale-95 ${motivo === m ? 'bg-[#007AFF] text-white dark:bg-[#0A84FF]' : 'bg-black/[0.04] text-[#3C3C43] dark:bg-white/[0.08] dark:text-[#EBEBF5]'}`}>
            {m}
          </button>
        ))}
      </div>
      <input value={detalle} onChange={(e) => setDetalle(e.target.value)} maxLength={120} placeholder="Detalle (ej: se cayó una caja)" aria-label="Detalle del motivo" className={`${INPUT} mt-2 w-full text-[14px]`} />

      {/* Fecha */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[14px] text-[#1C1C1E] dark:text-white">Fecha</span>
        <button ref={fechaRef} type="button" onClick={() => setCalendario((v) => !v)} className="rounded-lg bg-black/[0.05] px-3 py-1 text-[14px] text-[#1C1C1E] transition active:scale-95 dark:bg-white/[0.08] dark:text-white">
          {fechaLarga(fecha)}
        </button>
        <CalendarPopover anchorRef={fechaRef} open={calendario} onClose={() => setCalendario(false)} align="right">
          <SingleCalendar
            selected={new Date(`${fecha}T12:00:00`)}
            onSelect={(d) => {
              const iso = aISO(d)
              setFecha(iso > hoyISO() ? hoyISO() : iso)
              setCalendario(false)
            }}
          />
        </CalendarPopover>
      </div>

      <p className="mt-3 text-[12px] text-[#8E8E93]">Se registra como diferencia de inventario. No mueve la caja.</p>
      {error && <p className="mt-2 text-[12px] text-[#FF3B30]">{error}</p>}
      <Botones onCancelar={onCancelar} onGuardar={registrar} pending={pending} texto="Registrar" disabled={!valido || Math.abs(dif) < 0.001} />
    </div>
  )
}

/**
 * Costo unitario: se puede fijar a mano (vale desde hoy) o volver al promedio del sistema.
 * Muestra el margen en vivo con el precio actual y cuánto pasa a valer el stock.
 */
export function CostoUnitario({ productoId, costoHoy, promedio, fijo, precio, stockHoy, unidad, onCancelar, onListo }: {
  productoId: string
  costoHoy: number
  promedio: number
  fijo: boolean
  precio: number
  stockHoy: number
  unidad: string
  onCancelar: () => void
  onListo: () => void
}) {
  const [texto, setTexto] = useState(formatearMonto(String(Math.round(costoHoy * 10) / 10).replace('.', ',')))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const costo = texto.trim() === '' ? NaN : aNumero(texto)
  const valido = Number.isFinite(costo) && costo >= 0
  const margen = precio - (valido ? costo : costoHoy)
  const margenPct = precio > 0 ? (margen / precio) * 100 : 0

  const guardar = (valor: number | null) => {
    if (valor !== null && !valido) { setError('Ingresá un costo válido'); return }
    setError(null)
    startTransition(async () => {
      const res = await fijarCostoUnitario(productoId, valor)
      if (!res.success) { setError(res.error); return }
      onListo()
    })
  }

  return (
    <div className={CARD}>
      <div className="flex items-center gap-2">
        <span className="text-[17px] text-[#8E8E93]">$</span>
        <input
          autoFocus inputMode="decimal" value={texto}
          onChange={(e) => setTexto(formatearMonto(e.target.value))}
          onKeyDown={(e) => { if (e.key === 'Enter') guardar(costo) }}
          aria-label="Costo unitario"
          className={`${INPUT} w-40 text-[17px] font-semibold tabular-nums`}
        />
        <span className="text-[13px] text-[#8E8E93]">por {unidad || 'unidad'}</span>
      </div>

      {/* Referencia y margen en vivo */}
      <div className="mt-3 divide-y divide-black/[0.06] rounded-xl bg-black/[0.025] text-[13px] dark:divide-white/[0.08] dark:bg-white/[0.04]">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-[#8E8E93]">Promedio del sistema</span>
          <span className="tabular-nums text-[#1C1C1E] dark:text-white">{promedio > 0 ? fmt$(promedio) : '—'}</span>
        </div>
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-[#8E8E93]">Margen con precio {fmt$(precio)}</span>
          <span className={`tabular-nums ${margen < 0 ? 'text-[#B8664F] dark:text-[#E3A592]' : 'text-[#1C1C1E] dark:text-white'}`}>
            {margen < 0 ? '−' : ''}{fmt$(Math.abs(margen))} · {margenPct.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%
          </span>
        </div>
        {stockHoy > 0 && valido && Math.abs(costo - costoHoy) > 0.004 && (
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-[#8E8E93]">Tu stock ({fmtU(stockHoy)} {unidadDe(unidad, stockHoy)}) pasa a valer</span>
            <span className="tabular-nums text-[#1C1C1E] dark:text-white">{fmt$(stockHoy * costoHoy)} → {fmt$(stockHoy * costo)}</span>
          </div>
        )}
      </div>

      <p className="mt-3 text-[12px] text-[#8E8E93]">
        Vale desde hoy: el stock se valoriza a este costo y las próximas ventas salen con él. Lo anterior no cambia.
      </p>
      {fijo && (
        <button type="button" onClick={() => guardar(null)} disabled={pending} className="mt-2 text-[13px] text-[#007AFF] transition-opacity active:opacity-60 disabled:opacity-40 dark:text-[#0A84FF]">
          Usar el costo promedio ({fmt$(promedio)})
        </button>
      )}
      {error && <p className="mt-2 text-[12px] text-[#FF3B30]">{error}</p>}
      <Botones onCancelar={onCancelar} onGuardar={() => guardar(costo)} pending={pending} texto="Fijar costo" disabled={!valido} />
    </div>
  )
}

const UNIDADES = ['unidad', 'kg', 'gr', 'lt', 'ml', 'm', 'm²', 'm³', 'cm', 'caja', 'pack', 'bolsa', 'bulto', 'rollo', 'docena', 'balde', 'barra', 'par']

/** Cambiar la unidad de medida: solo el nombre (avisa que el número de stock queda igual) */
export function UnidadMedida({ articuloId, productoId, unidad, stock, onCancelar, onListo }: {
  articuloId: string | null
  productoId: string
  unidad: string
  stock: number
  onCancelar: () => void
  onListo: () => void
}) {
  const [valor, setValor] = useState(unidad)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const nueva = valor.trim()
  const cambia = !!nueva && nueva !== unidad

  const guardar = () => {
    if (!cambia) { onCancelar(); return }
    setError(null)
    startTransition(async () => {
      const res = await cambiarUnidad({ articuloId, productoId }, nueva)
      if (!res.success) { setError(res.error); return }
      onListo()
    })
  }

  return (
    <div className={CARD}>
      <input value={valor} onChange={(e) => setValor(e.target.value.slice(0, 30))} onKeyDown={(e) => { if (e.key === 'Enter') guardar() }} aria-label="Unidad" className={`${INPUT} w-full`} />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {UNIDADES.map((u) => (
          <button key={u} type="button" onClick={() => setValor(u)} aria-pressed={valor === u}
            className={`rounded-full px-2.5 py-0.5 text-[12px] transition active:scale-95 ${valor === u ? 'bg-[#007AFF] text-white dark:bg-[#0A84FF]' : 'bg-black/[0.04] text-[#3C3C43] dark:bg-white/[0.08] dark:text-[#EBEBF5]'}`}>
            {u}
          </button>
        ))}
      </div>
      {cambia && (
        <div className="mt-3 rounded-xl bg-[#FF9F0A]/[0.12] px-3 py-2 text-[13px] text-[#C93400] dark:text-[#FFB340]">
          Solo cambia el nombre: tus {fmtU(stock)} {unidadDe(unidad, stock)} pasan a ser {fmtU(stock)} {unidadDe(nueva, stock)}. El stock, el costo y el precio no se convierten.
        </div>
      )}
      {error && <p className="mt-2 text-[12px] text-[#FF3B30]">{error}</p>}
      <Botones onCancelar={onCancelar} onGuardar={guardar} pending={pending} texto="Cambiar" disabled={!cambia} />
    </div>
  )
}

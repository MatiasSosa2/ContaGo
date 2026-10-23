'use client'

import { useEffect, useMemo, useState } from 'react'
import { createConceptOperation, getClientesConCreditoPendiente, getProveedoresConDeudaPendiente } from '@/app/actions'
import type { Account, BienDeUso } from './TransactionForm'
import type { Registrado } from '@/lib/registro'
import { MoneyField, PaymentSection, fmt, num, round2, usePayments } from './registro/payment'
import { Caption, Group, IOS_FONT, PrimaryButton, Row } from './ui/ios'

export type ConceptKind = 'OTRO_INGRESO' | 'OTRO_EGRESO' | 'VENTA_BIEN' | 'COMPRA_BIEN' | 'COBRO' | 'PAGO_DEUDA'

type Pendiente = {
  id: string
  description: string
  saldoPendiente: number
  fechaVencimiento: Date | string | null
  date: Date | string
}
type ContactoConPendientes = { contactId: string; nombre: string; items: Pendiente[] }

const TEXT_INPUT_CLS =
  'ios-bare w-full bg-transparent text-right text-[12px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] dark:text-white'

/**
 * "Venta: Cemento 50 kg, Cal y 3 más · cuota 1/2" → título "Cuota 1 de 2" y detalle
 * "Cemento 50 kg, Cal y 3 más" (sin el "Venta:" ni la cuota). Sin cuotas: el detalle es el título.
 */
function partesCuota(description: string) {
  const m = description.match(/\s*·\s*cuota\s+(\d+)\s*\/\s*(\d+)\s*$/i)
  const base = (m ? description.slice(0, m.index) : description).replace(/^(Venta|Compra|Crédito|Deuda)\s*:\s*/i, '').trim()
  return m ? { titulo: `Cuota ${m[1]} de ${m[2]}`, detalle: base } : { titulo: base || 'Crédito', detalle: '' }
}
/** "4 sept" (con el año solo si no es el actual) */
const fechaCorta = (d: Date | string | null) => {
  if (!d) return ''
  const f = new Date(d)
  const conAnio = f.getFullYear() !== new Date().getFullYear()
  return f.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', ...(conAnio ? { year: 'numeric' } : {}) }).replace('.', '')
}

/**
 * Registración de las categorías que no son de productos, con el mismo estilo y el
 * mismo bloque de pago que la venta/compra de productos.
 */
export default function ConceptOperationForm({
  kind, accounts, bienesDeUso, date, categoryId, subcategoryId, preset,
  onDone, footerSlot,
}: {
  kind: ConceptKind
  accounts: Account[]
  bienesDeUso: BienDeUso[]
  date: string
  /** Categoría propia elegida (OTRO_*) */
  categoryId?: string
  subcategoryId?: string
  /** Cobro/pago abierto desde Créditos: cliente/proveedor y cuota ya elegidos */
  preset?: { linkedCreditoId: string; contactId: string } | null
  onDone: (registrado?: Registrado) => void
  /** Lugar debajo de la pestaña para la tarjeta del botón */
  footerSlot?: HTMLElement | null
}) {
  const esIngreso = kind === 'OTRO_INGRESO' || kind === 'VENTA_BIEN' || kind === 'COBRO'
  const esSaldo = kind === 'COBRO' || kind === 'PAGO_DEUDA'

  // ── Monto ──
  const [montoText, setMontoText] = useState('')

  // ── Bien de uso ──
  const [bienId, setBienId] = useState('')
  // Buscador del "carrito" de venta de bien de uso
  const [buscaBien, setBuscaBien] = useState('')
  const [buscandoBien, setBuscandoBien] = useState(false)
  const [bienNombre, setBienNombre] = useState('')
  const [bienCategoria, setBienCategoria] = useState('')
  const [bienMarca, setBienMarca] = useState('')

  // ── Cobro / pago de deuda: contactos con cuotas pendientes ──
  const [pendientes, setPendientes] = useState<ContactoConPendientes[] | null>(null)
  const [saldoContactId, setSaldoContactId] = useState(preset?.contactId ?? '')
  // Buscador de los cuadraditos de clientes / proveedores
  const [buscaContacto, setBuscaContacto] = useState('')
  const [seleccion, setSeleccion] = useState<string[]>(preset?.linkedCreditoId ? [preset.linkedCreditoId] : [])
  // Mientras no se edite a mano, el monto es la suma de las cuotas elegidas
  const [montoManual, setMontoManual] = useState(false)
  // Momento de apertura, para marcar las cuotas vencidas
  const [ahora] = useState(() => Date.now())

  useEffect(() => {
    if (!esSaldo) return
    let cancel = false
    const load = kind === 'COBRO'
      ? getClientesConCreditoPendiente().then((rows) => rows.map((c) => ({ contactId: c.contactId, nombre: c.nombre, items: c.creditos })))
      : getProveedoresConDeudaPendiente().then((rows) => rows.map((c) => ({ contactId: c.contactId, nombre: c.nombre, items: c.deudas })))
    load.then((rows) => { if (!cancel) setPendientes(rows as ContactoConPendientes[]) })
    return () => { cancel = true }
  }, [esSaldo, kind])

  const contacto = pendientes?.find((c) => c.contactId === saldoContactId)
  // Cuotas del contacto, la que vence primero arriba
  const cuotas = useMemo(() => [...(contacto?.items ?? [])].sort((a, b) => {
    const fa = a.fechaVencimiento ? new Date(a.fechaVencimiento).getTime() : Infinity
    const fb = b.fechaVencimiento ? new Date(b.fechaVencimiento).getTime() : Infinity
    return fa - fb
  }), [contacto])
  const saldoElegido = round2(cuotas.filter((c) => seleccion.includes(c.id)).reduce((s, c) => s + c.saldoPendiente, 0))

  const monto = esSaldo && !montoManual ? saldoElegido : num(montoText)

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const pay = usePayments({ total: round2(monto), accounts, date, allowCredit: !esSaldo })

  const bienesActivos = bienesDeUso
  const bien = bienesActivos.find((b) => b.id === bienId)

  const toggleCuota = (id: string) => {
    setSeleccion((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setMontoManual(false)
    setError(null)
  }

  const handleSubmit = async () => {
    setError(null)
    if (kind === 'VENTA_BIEN' && !bienId) { setError('Elegí el bien de uso'); return }
    if (kind === 'COMPRA_BIEN' && !bienNombre.trim()) { setError('Indicá el nombre del bien'); return }
    if (esSaldo && seleccion.length === 0) { setError(kind === 'COBRO' ? 'Elegí qué cuotas se cobran' : 'Elegí qué cuotas se pagan'); return }
    if (monto <= 0) { setError('El monto debe ser mayor a 0'); return }
    if (esSaldo && monto > saldoElegido + 0.01) { setError(`El monto supera el saldo de las cuotas elegidas (${fmt(saldoElegido)})`); return }

    const pagosRes = pay.buildPayload()
    if (!pagosRes.ok) { setError(pagosRes.error); return }

    // Las cuotas se saldan en orden de vencimiento
    const creditoIds = cuotas.filter((c) => seleccion.includes(c.id)).map((c) => c.id)

    const fd = new FormData()
    fd.set('payload', JSON.stringify({
      kind,
      date,
      monto: round2(monto),
      categoryId: categoryId || undefined,
      subcategoryId: subcategoryId || undefined,
      bienDeUsoId: kind === 'VENTA_BIEN' ? bienId : undefined,
      bien: kind === 'COMPRA_BIEN'
        ? { nombre: bienNombre.trim(), categoria: bienCategoria.trim() || undefined, marca: bienMarca.trim() || undefined }
        : undefined,
      creditoIds: esSaldo ? creditoIds : undefined,
      pagos: pagosRes.pagos,
    }))

    setSubmitting(true)
    const result = await createConceptOperation(fd)
    setSubmitting(false)
    if (!result.success) { setError(result.error || 'No se pudo registrar la operación'); return }
    const alDia = result.data?.clienteSaldado ? result.data.clienteNombre : result.data?.proveedorSaldado ? result.data.proveedorNombre : undefined
    const titulo = verbo.charAt(0).toUpperCase() + verbo.slice(1)
    onDone({
      titulo: `${titulo} registrad${verbo === 'venta' || verbo === 'compra' ? 'a' : 'o'}`,
      monto,
      detalle: alDia ? `${alDia} quedó al día` : undefined,
      undo: result.data?.undo,
    })
  }

  const verbo =
    kind === 'COBRO' ? 'cobro'
      : kind === 'PAGO_DEUDA' ? 'pago'
      : kind === 'VENTA_BIEN' ? 'venta'
      : kind === 'COMPRA_BIEN' ? 'compra'
      : esIngreso ? 'ingreso' : 'egreso'

  // Fila "Monto" como el Total del carrito
  const montoRow = (label: string) => (
    <div className="flex min-h-[44px] items-center justify-between gap-3 px-3">
      <span className="text-[14px] font-medium text-[#1C1C1E] dark:text-white">{label}</span>
      <div className="w-36">
        <MoneyField
          align="right"
          size="total"
          value={esSaldo && !montoManual ? (saldoElegido > 0 ? String(saldoElegido) : '') : montoText}
          onChange={(v) => { setMontoText(v); if (esSaldo) setMontoManual(true) }}
          label={label}
        />
      </div>
    </div>
  )

  return (
    <div className={`mt-5 flex flex-col ${IOS_FONT}`}>
      {error && (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-[#FF3B30]/10 px-4 py-2.5 text-[13px] text-[#D70015] dark:text-[#FF6961]">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar aviso" className="ml-3 opacity-60">×</button>
        </div>
      )}

      {/* ── Venta de bien de uso: mismo formato que el carrito de productos (un bien por venta) ── */}
      {kind === 'VENTA_BIEN' && (() => {
        const GRID = 'grid grid-cols-[minmax(0,1fr)_84px_92px_12px] items-center gap-2'
        const q = buscaBien.trim().toLowerCase()
        const resultados = bienesActivos.filter((b) => !q || b.nombre.toLowerCase().includes(q)).slice(0, 8)
        const libros = (b: BienDeUso) => Math.max(0, b.valorAdquisicion - b.depreciacionAcumulada)
        const elegirBien = (id: string) => { setBienId(id); setBuscaBien(''); setBuscandoBien(false); setError(null) }
        return (
          <div className="rounded-xl bg-[#fff] dark:bg-[#1C1C1E]">
            <div className={`${GRID} px-3 pb-1 pt-2.5 text-[10px] text-[#AEAEB2]`}>
              <span>Bien de uso</span>
              <span className="text-right">Valor libros</span>
              <span className="text-right">Precio</span>
              <span />
            </div>

            {bien && (
              <div className={`${GRID} group min-h-[32px] border-t border-black/[0.05] px-3 py-1 text-[12px] text-[#1C1C1E] dark:border-white/[0.06] dark:text-white`}>
                <span className="truncate" title={bien.nombre}>{bien.nombre}</span>
                <span className="text-right tabular-nums text-[#8E8E93]">{fmt(libros(bien))}</span>
                <MoneyField align="right" value={montoText} onChange={setMontoText} label="Precio de venta" placeholder="$0" />
                <button
                  type="button"
                  onClick={() => { setBienId(''); setMontoText('') }}
                  className="flex justify-end text-[#D1D1D6] opacity-0 transition hover:text-[#B8664F] group-hover:opacity-100 focus:opacity-100 dark:text-[#48484A]"
                  aria-label="Quitar bien de uso"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}

            {/* Última fila: buscador sutil (elegir otro reemplaza al actual) */}
            {bienesActivos.length === 0 ? (
              <p className="border-t border-black/[0.05] px-3 py-2.5 text-[12px] text-[#8E8E93] dark:border-white/[0.06]">No hay bienes de uso cargados</p>
            ) : (
              <div className="relative border-t border-black/[0.05] dark:border-white/[0.06]">
                <div className="flex min-h-[34px] items-center gap-2 px-3">
                  <svg className="h-3.5 w-3.5 shrink-0 text-[#C7C7CC] dark:text-[#636366]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
                  <input
                    value={buscaBien}
                    onChange={(e) => { setBuscaBien(e.target.value); setBuscandoBien(true) }}
                    onFocus={() => setBuscandoBien(true)}
                    onBlur={() => setTimeout(() => setBuscandoBien(false), 120)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && resultados[0]) { e.preventDefault(); elegirBien(resultados[0].id) }
                      if (e.key === 'Escape') { e.stopPropagation(); setBuscandoBien(false); e.currentTarget.blur() }
                    }}
                    placeholder={bien ? 'Cambiar bien de uso' : 'Buscar bien de uso para vender'}
                    aria-label="Buscar bien de uso"
                    className="ios-bare min-w-0 flex-1 bg-transparent text-[12px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] dark:text-white dark:placeholder:text-[#636366]"
                  />
                </div>
                {buscandoBien && (
                  <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-xl bg-[#fff] py-1 shadow-[0_12px_40px_rgba(0,0,0,0.16)] ring-1 ring-black/[0.06] dark:bg-[#2C2C2E] dark:ring-white/10">
                    {resultados.length === 0 ? (
                      <p className="px-3 py-2.5 text-[12px] text-[#8E8E93]">Sin coincidencias</p>
                    ) : resultados.map((b) => (
                      <button
                        key={b.id} type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => elegirBien(b.id)}
                        className="flex w-full items-center gap-3 px-3 py-1.5 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                      >
                        <span className="min-w-0 flex-1 truncate text-[12px] text-[#1C1C1E] dark:text-white">{b.nombre}</span>
                        <span className="shrink-0 text-[10px] tabular-nums text-[#AEAEB2]">Libros {fmt(libros(b))}</span>
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[15px] leading-none text-[var(--reg-accent,#4F8A6B)]" aria-hidden>+</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Total (= precio de venta) */}
            <div className="flex min-h-[44px] items-center justify-between gap-3 border-t border-black/[0.08] px-3 dark:border-white/[0.1]">
              <span className="text-[14px] font-medium text-[#1C1C1E] dark:text-white">Total</span>
              <span className="text-[17px] font-semibold tabular-nums text-[var(--reg-accent,#4F8A6B)]">{fmt(monto)}</span>
            </div>
          </div>
        )
      })()}

      {/* ── Compra de bien de uso ── */}
      {kind === 'COMPRA_BIEN' && (
        <>
          <Caption>Bien de uso</Caption>
          <Group>
            <Row size="sm" label="Nombre" value={<input value={bienNombre} onChange={(e) => setBienNombre(e.target.value)} placeholder="Ej: Camioneta" maxLength={120} className={TEXT_INPUT_CLS} aria-label="Nombre del bien" />} />
            <Row size="sm" label="Categoría" value={<input value={bienCategoria} onChange={(e) => setBienCategoria(e.target.value)} placeholder="Opcional" maxLength={80} className={TEXT_INPUT_CLS} aria-label="Categoría del bien" />} />
            <Row size="sm" label="Marca" value={<input value={bienMarca} onChange={(e) => setBienMarca(e.target.value)} placeholder="Opcional" maxLength={80} className={TEXT_INPUT_CLS} aria-label="Marca del bien" />} />
          </Group>
          <Group className="mt-3">{montoRow('Valor')}</Group>
        </>
      )}

      {/* ── Cobro de crédito / pago de deuda ── */}
      {esSaldo && (
        <>
          {pendientes === null ? (
            <Group className="mt-3"><p className="px-3 py-2.5 text-[12px] text-[#8E8E93]">Cargando…</p></Group>
          ) : pendientes.length === 0 ? (
            <Group className="mt-3"><p className="px-3 py-2.5 text-[12px] text-[#8E8E93]">{kind === 'COBRO' ? 'No hay créditos pendientes de cobro' : 'No hay deudas pendientes de pago'}</p></Group>
          ) : (() => {
            // Cuadraditos: iniciales, nombre y saldo; del que más debe al que menos
            const saldoDe = (c: ContactoConPendientes) => round2(c.items.reduce((acc, i) => acc + i.saldoPendiente, 0))
            const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
            const q = norm(buscaContacto.trim())
            const lista = [...pendientes]
              .filter((c) => !q || norm(c.nombre).includes(q))
              .sort((a, b) => saldoDe(b) - saldoDe(a))
            const iniciales = (n: string) => n.split(/\s+/).filter((p) => /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(p)).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?'
            return (
              <div className="mt-3">
                <p className="mb-1.5 px-3 text-[12px] text-[#8E8E93]">{kind === 'COBRO' ? 'Clientes con créditos' : 'Proveedores con deudas'}</p>
                {/* Buscador fino */}
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-black/[0.05] px-2.5 py-1.5 dark:bg-white/[0.08]">
                  <svg className="h-3.5 w-3.5 shrink-0 text-[#8E8E93]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
                  </svg>
                  <input
                    value={buscaContacto}
                    onChange={(e) => setBuscaContacto(e.target.value)}
                    placeholder={kind === 'COBRO' ? 'Buscar cliente' : 'Buscar proveedor'}
                    aria-label={kind === 'COBRO' ? 'Buscar cliente' : 'Buscar proveedor'}
                    className="ios-bare min-w-0 flex-1 bg-transparent text-[12px] text-[#1C1C1E] outline-none placeholder:text-[#8E8E93] dark:text-white"
                  />
                </div>
                {lista.length === 0 ? (
                  <p className="px-3 py-2 text-[12px] text-[#8E8E93]">Sin coincidencias</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {lista.map((c) => {
                      const on = c.contactId === saldoContactId
                      return (
                        <button
                          key={c.contactId}
                          type="button"
                          onClick={() => { setSaldoContactId(on ? '' : c.contactId); setSeleccion([]); setMontoManual(false) }}
                          aria-pressed={on}
                          className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl bg-[#fff] px-2 py-3 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition active:scale-[0.97] dark:bg-[#1C1C1E] ${on ? 'ring-2 ring-[var(--reg-accent,#4F8A6B)]' : 'ring-1 ring-black/[0.04] dark:ring-white/[0.06]'}`}
                        >
                          <span className={`flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-semibold ${on ? 'bg-[var(--reg-accent,#4F8A6B)] text-white' : 'bg-black/[0.05] text-[#3C3C43] dark:bg-white/[0.08] dark:text-[#EBEBF5]'}`}>
                            {iniciales(c.nombre)}
                          </span>
                          <span className="w-full truncate text-[12px] text-[#1C1C1E] dark:text-white">{c.nombre}</span>
                          <span className="text-[11px] tabular-nums text-[#8E8E93]">{fmt(saldoDe(c))}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}

          {contacto && (
            <>
              <Caption right={<span className="text-[11px] text-[#8E8E93]">Pendiente {fmt(round2(cuotas.reduce((s, c) => s + c.saldoPendiente, 0)))}</span>}>
                Cuotas
              </Caption>
              <Group>
                {cuotas.map((c) => {
                  const on = seleccion.includes(c.id)
                  const vencida = c.fechaVencimiento ? new Date(c.fechaVencimiento).getTime() < ahora : false
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCuota(c.id)}
                      aria-pressed={on}
                      className="flex min-h-[38px] w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors active:bg-black/[0.04] dark:active:bg-white/[0.06]"
                    >
                      <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${on ? 'border-[var(--reg-accent,#4F8A6B)] bg-[var(--reg-accent,#4F8A6B)] text-white' : 'border-[#C7C7CC]'}`}>
                        {on && <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </span>
                      {(() => {
                        const { titulo, detalle } = partesCuota(c.description)
                        return (
                          <>
                            {/* Título: la cuota; debajo, de qué venta es (sutil) */}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12px] font-medium text-[#1C1C1E] dark:text-white">{titulo}</span>
                              {detalle && <span className="block truncate text-[10px] text-[#AEAEB2] dark:text-[#636366]">{detalle}</span>}
                            </span>
                            {/* Monto y, debajo, el vencimiento */}
                            <span className="shrink-0 text-right">
                              <span className="block text-[12px] tabular-nums text-[#1C1C1E] dark:text-white">{fmt(c.saldoPendiente)}</span>
                              <span className={`block text-[10px] ${vencida ? 'text-[#B8664F] dark:text-[#E3A592]' : 'text-[#AEAEB2] dark:text-[#636366]'}`}>
                                {c.fechaVencimiento ? `${vencida ? 'Venció' : 'Vence'} ${fechaCorta(c.fechaVencimiento)}` : 'Sin vencimiento'}
                              </span>
                            </span>
                          </>
                        )
                      })()}
                    </button>
                  )
                })}
              </Group>
              <Group className="mt-3">{montoRow(kind === 'COBRO' ? 'Cobrado' : 'Pagado')}</Group>
              {montoManual && monto < saldoElegido - 0.01 && (
                <p className="mt-1.5 px-3 text-[11px] text-[#8E8E93]">Pago parcial: se aplica a las cuotas en orden de vencimiento</p>
              )}
            </>
          )}
        </>
      )}

      {/* ── Categorías propias ── */}
      {(kind === 'OTRO_INGRESO' || kind === 'OTRO_EGRESO') && (
        <Group>{montoRow('Monto')}</Group>
      )}

      {/* ── Pago ── */}
      {(!esSaldo || contacto) && (
        <div className="mt-3">
          <PaymentSection pay={pay} title={esSaldo ? (kind === 'COBRO' ? 'Cobro' : 'Pago') : 'Pago'} />
        </div>
      )}

      <PrimaryButton onClick={handleSubmit} disabled={submitting} color={esIngreso ? 'green' : 'red'} slot={footerSlot}>
        {submitting ? 'Guardando…' : `Registrar ${verbo}${monto > 0 ? ` · ${fmt(monto)}` : ''}`}
      </PrimaryButton>
    </div>
  )
}

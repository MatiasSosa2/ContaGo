'use client'

import { useEffect, useMemo, useState } from 'react'
import { createConceptOperation, getClientesConCreditoPendiente, getProveedoresConDeudaPendiente } from '@/app/actions'
import type { Account, BienDeUso } from './TransactionForm'
import { MoneyField, PaymentSection, fmt, num, round2, usePayments } from './registro/payment'
import { Caption, Group, IOS_FONT, MenuSelect, PrimaryButton, Row } from './ui/ios'

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
  'ios-bare w-full bg-transparent text-right text-[15px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] dark:text-white'

const fmtFecha = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '') : 'Sin vencimiento'

/**
 * Registración de las categorías que no son de productos, con el mismo estilo y el
 * mismo bloque de pago que la venta/compra de productos.
 */
export default function ConceptOperationForm({
  kind, accounts, bienesDeUso, date, categoryId, subcategoryId, preset,
  onDone, onClienteSaldado, onProveedorSaldado, footerSlot,
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
  onDone: () => void
  onClienteSaldado?: (nombre: string) => void
  onProveedorSaldado?: (nombre: string) => void
  /** Lugar debajo de la pestaña para la tarjeta del botón */
  footerSlot?: HTMLElement | null
}) {
  const esIngreso = kind === 'OTRO_INGRESO' || kind === 'VENTA_BIEN' || kind === 'COBRO'
  const esSaldo = kind === 'COBRO' || kind === 'PAGO_DEUDA'

  // ── Monto ──
  const [montoText, setMontoText] = useState('')

  // ── Bien de uso ──
  const [bienId, setBienId] = useState('')
  const [bienNombre, setBienNombre] = useState('')
  const [bienCategoria, setBienCategoria] = useState('')
  const [bienMarca, setBienMarca] = useState('')

  // ── Cobro / pago de deuda: contactos con cuotas pendientes ──
  const [pendientes, setPendientes] = useState<ContactoConPendientes[] | null>(null)
  const [saldoContactId, setSaldoContactId] = useState(preset?.contactId ?? '')
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
    if (result.data?.clienteSaldado && result.data.clienteNombre) onClienteSaldado?.(result.data.clienteNombre)
    if (result.data?.proveedorSaldado && result.data.proveedorNombre) onProveedorSaldado?.(result.data.proveedorNombre)
    onDone()
  }

  const verbo =
    kind === 'COBRO' ? 'cobro'
      : kind === 'PAGO_DEUDA' ? 'pago'
      : kind === 'VENTA_BIEN' ? 'venta'
      : kind === 'COMPRA_BIEN' ? 'compra'
      : esIngreso ? 'ingreso' : 'egreso'

  // Fila "Monto" como el Total del carrito
  const montoRow = (label: string) => (
    <div className="flex min-h-[52px] items-center justify-between gap-3 px-4">
      <span className="text-[15px] font-medium text-[#1C1C1E] dark:text-white">{label}</span>
      <div className="w-40">
        <MoneyField
          align="right"
          size="lg"
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

      {/* ── Venta de bien de uso ── */}
      {kind === 'VENTA_BIEN' && (
        <>
          <Caption>Bien de uso</Caption>
          <Group>
            {bienesActivos.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-[#8E8E93]">No hay bienes de uso cargados</p>
            ) : (
              <Row label="Bien" value={
                <MenuSelect
                  label="Bien de uso"
                  value={bienId}
                  options={[{ value: '', label: 'Elegir' }, ...bienesActivos.map((b) => ({ value: b.id, label: b.nombre }))]}
                  onChange={setBienId}
                />
              } />
            )}
            {bien && (
              <div className="flex min-h-[36px] items-center justify-between px-4 text-[13px] text-[#8E8E93]">
                <span>Valor en libros</span>
                <span>{fmt(Math.max(0, bien.valorAdquisicion - bien.depreciacionAcumulada))}</span>
              </div>
            )}
          </Group>
          <Group className="mt-3">{montoRow('Precio de venta')}</Group>
        </>
      )}

      {/* ── Compra de bien de uso ── */}
      {kind === 'COMPRA_BIEN' && (
        <>
          <Caption>Bien de uso</Caption>
          <Group>
            <Row label="Nombre" value={<input value={bienNombre} onChange={(e) => setBienNombre(e.target.value)} placeholder="Ej: Camioneta" maxLength={120} className={TEXT_INPUT_CLS} aria-label="Nombre del bien" />} />
            <Row label="Categoría" value={<input value={bienCategoria} onChange={(e) => setBienCategoria(e.target.value)} placeholder="Opcional" maxLength={80} className={TEXT_INPUT_CLS} aria-label="Categoría del bien" />} />
            <Row label="Marca" value={<input value={bienMarca} onChange={(e) => setBienMarca(e.target.value)} placeholder="Opcional" maxLength={80} className={TEXT_INPUT_CLS} aria-label="Marca del bien" />} />
          </Group>
          <Group className="mt-3">{montoRow('Valor')}</Group>
        </>
      )}

      {/* ── Cobro de crédito / pago de deuda ── */}
      {esSaldo && (
        <>
          <Group className="mt-5">
            {pendientes === null ? (
              <p className="px-4 py-3 text-[13px] text-[#8E8E93]">Cargando…</p>
            ) : pendientes.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-[#8E8E93]">{kind === 'COBRO' ? 'No hay créditos pendientes de cobro' : 'No hay deudas pendientes de pago'}</p>
            ) : (
              <Row label={kind === 'COBRO' ? 'Cliente' : 'Proveedor'} value={
                <MenuSelect
                  label={kind === 'COBRO' ? 'Cliente' : 'Proveedor'}
                  value={saldoContactId}
                  options={[{ value: '', label: 'Elegir' }, ...pendientes.map((c) => ({ value: c.contactId, label: c.nombre }))]}
                  onChange={(v) => { setSaldoContactId(v); setSeleccion([]); setMontoManual(false) }}
                />
              } />
            )}
          </Group>

          {contacto && (
            <>
              <Caption right={<span className="text-[12px] text-[#8E8E93]">Pendiente {fmt(round2(cuotas.reduce((s, c) => s + c.saldoPendiente, 0)))}</span>}>
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
                      className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left transition-colors active:bg-black/[0.04] dark:active:bg-white/[0.06]"
                    >
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${on ? 'border-brand-military bg-brand-military text-white' : 'border-[#C7C7CC]'}`}>
                        {on && <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-[#1C1C1E] dark:text-white">{c.description}</span>
                        <span className={`block text-[11px] ${vencida ? 'text-[#FF3B30]' : 'text-[#8E8E93]'}`}>
                          {vencida ? 'Venció' : 'Vence'} {fmtFecha(c.fechaVencimiento)}
                        </span>
                      </span>
                      <span className="text-[13px] text-[#1C1C1E] dark:text-white">{fmt(c.saldoPendiente)}</span>
                    </button>
                  )
                })}
              </Group>
              <Group className="mt-3">{montoRow(kind === 'COBRO' ? 'Cobrado' : 'Pagado')}</Group>
              {montoManual && monto < saldoElegido - 0.01 && (
                <p className="mt-1.5 px-4 text-[12px] text-[#8E8E93]">Pago parcial: se aplica a las cuotas en orden de vencimiento</p>
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
        <div className="mt-5">
          <PaymentSection pay={pay} title={esSaldo ? (kind === 'COBRO' ? 'Cobro' : 'Pago') : 'Pago'} />
        </div>
      )}

      <PrimaryButton onClick={handleSubmit} disabled={submitting} color={esIngreso ? 'green' : 'red'} slot={footerSlot}>
        {submitting ? 'Guardando…' : `Registrar ${verbo}${monto > 0 ? ` · ${fmt(monto)}` : ''}`}
      </PrimaryButton>
    </div>
  )
}

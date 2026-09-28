'use client'

/**
 * Pago de la pestaña de registración, compartido por todas las categorías:
 * Efectivo | Virtual | Crédito, crédito en cuotas editables y "Combinar medios de pago"
 * (el último medio toma lo que falta del total).
 */

import { useMemo, useState } from 'react'
import type { Account } from '../TransactionForm'
import { Chevron, DateChip, Group, INLINE_INPUT_CLS, IOS_FONT, MenuSelect, Row, Segmented } from '../ui/ios'

export type Metodo = 'EFECTIVO' | 'VIRTUAL' | 'CREDITO'
const METODOS_TODOS: { value: Metodo; label: string }[] = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'VIRTUAL', label: 'Virtual' },
  { value: 'CREDITO', label: 'Crédito' },
]
const METODO_LABEL: Record<Metodo, string> = { EFECTIVO: 'Efectivo', VIRTUAL: 'Virtual', CREDITO: 'Crédito' }

type Pago = {
  key: number
  metodo: Metodo
  accountId: string
  monto: string // solo se usa al combinar medios de pago
  // Al combinar, el último medio toma lo que falta salvo que se haya editado a mano
  montoManual?: boolean
  cuotasCount: number
  primeraFecha: string
  // Cuotas editadas a mano (índice → valor); el resto se calcula
  overrides: Record<number, { monto?: string; fecha?: string }>
}

export type PagoPayload = {
  metodo: Metodo
  monto: number
  accountId?: string
  cuotas?: { monto: number; fecha: string }[]
}

// ── Utilidades de números y fechas ──────────────────────────────────────────

// Claves estables para listas (ítems, pagos, avisos)
let keySeq = 1
export const nextKey = () => keySeq++

export const round2 = (v: number) => Math.round(v * 100) / 100
export const num = (s: string) => {
  const v = parseFloat(s)
  return isNaN(v) ? 0 : v
}
// "$255.000" — decimales solo si los hay
export const fmt = (v: number) =>
  `$${v.toLocaleString('es-AR', { minimumFractionDigits: Number.isInteger(round2(v)) ? 0 : 2, maximumFractionDigits: 2 })}`

export function addMonths(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1 + n, 1)
  // Mismo día del mes, o el último si ese mes es más corto
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(d, last))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Monto con separador de miles; al tocarlo se edita como número */
export function MoneyField({ value, onChange, onEnter, label, align = 'left', size = 'sm', placeholder = '$0' }: {
  value: string
  onChange: (v: string) => void
  onEnter?: () => void
  label: string
  align?: 'left' | 'right'
  /** md: monto destacado (medios combinados). lg: monto principal (fila "Monto") */
  size?: 'sm' | 'md' | 'lg'
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const sizeCls = size === 'lg' ? 'text-[20px] font-semibold' : size === 'md' ? 'text-[15px] font-medium' : 'text-[13px]'
  const cls = `${align === 'right' ? 'text-right' : 'text-left'} ${sizeCls}`
  if (editing) {
    return (
      <input
        autoFocus type="number" min="0" step="0.01" value={value} placeholder="0"
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => { if (e.key === 'Enter') { setEditing(false); onEnter?.() } }}
        className={`ios-bare w-full border-b border-brand-military bg-transparent text-[#1C1C1E] outline-none dark:text-white tabular-nums ${cls}`}
        aria-label={label}
      />
    )
  }
  return (
    <button type="button" onClick={() => setEditing(true)} aria-label={`Editar ${label.toLowerCase()}`}
      className={`w-full border-b border-transparent text-[#1C1C1E] transition-colors hover:border-black/10 dark:text-white dark:hover:border-white/15 ${cls}`}>
      {value === '' ? <span className="text-[#C7C7CC]">{placeholder}</span> : fmt(num(value))}
    </button>
  )
}

/**
 * Cuotas de una parte a crédito: mensuales y de igual monto por defecto.
 * Las que se editan a mano quedan fijas y las demás se reparten lo que falta,
 * así siempre suman el total (salvo que se editen todas).
 */
function buildCuotas(p: Pago, monto: number) {
  const n = Math.max(1, p.cuotasCount)
  const fijas = Array.from({ length: n }, (_, i) => p.overrides[i]?.monto)
  const sumaFijas = fijas.reduce((s, m) => s + (m !== undefined ? num(m) : 0), 0)
  const libres = fijas.map((m, i) => (m === undefined ? i : -1)).filter((i) => i >= 0)
  const resto = Math.max(0, round2(monto - sumaFijas))
  const base = libres.length ? Math.floor((resto / libres.length) * 100) / 100 : 0
  const ultimaLibre = libres[libres.length - 1]
  return Array.from({ length: n }, (_, i) => {
    const fija = fijas[i]
    // La última cuota libre absorbe el redondeo
    const def = i === ultimaLibre ? round2(resto - base * (libres.length - 1)) : base
    return {
      monto: fija !== undefined ? num(fija) : def,
      montoText: fija ?? String(def),
      fecha: p.overrides[i]?.fecha ?? addMonths(p.primeraFecha, i),
    }
  })
}

// ── Estado del pago ─────────────────────────────────────────────────────────

export type PaymentsApi = ReturnType<typeof usePayments>

/** allowCredit: false en cobros y pagos de deuda (ya son el pago de un crédito) */
export function usePayments({ total, accounts, date, allowCredit = true }: {
  total: number
  accounts: Account[]
  date: string
  allowCredit?: boolean
}) {
  const metodos = useMemo(() => (allowCredit ? METODOS_TODOS : METODOS_TODOS.filter((m) => m.value !== 'CREDITO')), [allowCredit])
  // Pagos en pesos
  const arsAccounts = useMemo(() => accounts.filter((a) => a.currency === 'ARS'), [accounts])
  const cajasPara = (m: Metodo) =>
    m === 'EFECTIVO' ? arsAccounts.filter((a) => a.type === 'CASH')
      : m === 'VIRTUAL' ? arsAccounts.filter((a) => a.type !== 'CASH')
      : []

  const nuevoPago = (metodo: Metodo): Pago => ({
    key: nextKey(),
    metodo,
    accountId: cajasPara(metodo)[0]?.id ?? '',
    monto: '',
    cuotasCount: 1,
    primeraFecha: addMonths(date, 1),
    overrides: {},
  })
  const [pagos, setPagos] = useState<Pago[]>(() => [nuevoPago('EFECTIVO')])
  const [cuotasOpen, setCuotasOpen] = useState<number | null>(null)
  const combinado = pagos.length > 1

  // Al combinar, el último medio (si no se editó a mano) toma lo que falta del total
  const autoIndex = combinado && !pagos[pagos.length - 1].montoManual ? pagos.length - 1 : -1
  const sumaOtros = round2(pagos.reduce((s, p, i) => (i === autoIndex ? s : s + num(p.monto)), 0))
  const montoDe = (p: Pago) => {
    if (!combinado) return total
    if (autoIndex >= 0 && p.key === pagos[autoIndex].key) return Math.max(0, round2(total - sumaOtros))
    return num(p.monto)
  }
  const asignado = round2(pagos.reduce((s, p) => s + montoDe(p), 0))
  const falta = round2(total - asignado)

  const updatePago = (key: number, patch: Partial<Pago>) =>
    setPagos((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)))
  const setMetodo = (p: Pago, metodo: Metodo) =>
    updatePago(p.key, { metodo, accountId: cajasPara(metodo)[0]?.id ?? '', overrides: {} })

  // El primero arranca vacío para escribirle el monto; el segundo toma el resto
  const combinar = () =>
    setPagos((prev) => [{ ...prev[0], monto: '', montoManual: false }, { ...nuevoPago(allowCredit ? 'CREDITO' : 'VIRTUAL'), monto: '' }])
  // El que era último queda con su monto actual; el nuevo pasa a tomar el resto
  const agregarMedio = () =>
    setPagos((prev) => [
      ...prev.map((p) => ({ ...p, monto: String(montoDe(p)), montoManual: true })),
      { ...nuevoPago('VIRTUAL'), monto: '' },
    ])
  const noCombinar = () => setPagos((prev) => [{ ...prev[0], monto: '', montoManual: false }])
  const quitarPago = (key: number) =>
    setPagos((prev) => {
      const rest = prev.filter((p) => p.key !== key)
      if (rest.length === 1) return [{ ...rest[0], monto: '', montoManual: false }]
      // El nuevo último vuelve a tomar lo que falta
      return rest.map((p, i) => (i === rest.length - 1 ? { ...p, montoManual: false } : p))
    })

  /** Valida y arma los pagos para el servidor */
  const buildPayload = (): { ok: true; pagos: PagoPayload[] } | { ok: false; error: string } => {
    if (combinado && Math.abs(falta) > 0.01) {
      return { ok: false, error: falta > 0 ? `Falta asignar ${fmt(falta)}` : `Los medios de pago superan el total por ${fmt(-falta)}` }
    }
    const out: PagoPayload[] = []
    for (const p of pagos) {
      const monto = round2(montoDe(p))
      if (monto <= 0) return { ok: false, error: 'Cada medio de pago debe tener un monto' }
      if (p.metodo === 'CREDITO') {
        const cuotas = buildCuotas(p, monto)
        const suma = round2(cuotas.reduce((s, c) => s + c.monto, 0))
        if (Math.abs(suma - monto) > 0.01) return { ok: false, error: `Las cuotas suman ${fmt(suma)} y deberían sumar ${fmt(monto)}` }
        if (cuotas.some((c) => c.monto <= 0 || !c.fecha)) return { ok: false, error: 'Revisá el monto y la fecha de cada cuota' }
        out.push({ metodo: p.metodo, monto, cuotas: cuotas.map((c) => ({ monto: round2(c.monto), fecha: c.fecha })) })
      } else {
        if (!p.accountId) return { ok: false, error: `No hay caja para ${METODO_LABEL[p.metodo].toLowerCase()}` }
        out.push({ metodo: p.metodo, monto, accountId: p.accountId })
      }
    }
    return { ok: true, pagos: out }
  }

  return {
    metodos, pagos, combinado, autoIndex, falta, cuotasOpen, setCuotasOpen, cajasPara, montoDe,
    updatePago, setMetodo, combinar, agregarMedio, noCombinar, quitarPago, buildPayload,
  }
}

// ── Pantalla del pago ───────────────────────────────────────────────────────

export function PaymentSection({ pay, title = 'Pago' }: { pay: PaymentsApi; title?: string }) {
  const { metodos, pagos, combinado, autoIndex, falta, cuotasOpen, setCuotasOpen, cajasPara, montoDe, updatePago, setMetodo, combinar, agregarMedio, noCombinar, quitarPago } = pay

  const cajaRow = (p: Pago) => {
    const cajas = cajasPara(p.metodo)
    if (cajas.length <= 1) return null
    return (
      <Row label={p.metodo === 'EFECTIVO' ? 'Caja' : 'Cuenta'} value={
        <MenuSelect
          label="Caja"
          value={p.accountId}
          options={cajas.map((a) => ({ value: a.id, label: a.name }))}
          onChange={(v) => updatePago(p.key, { accountId: v })}
        />
      } />
    )
  }

  // sutil: fila chica y gris (dentro de medios combinados, para que resalten los medios)
  const cuotasRows = (p: Pago, sutil = false) => {
    const monto = montoDe(p)
    const cuotas = buildCuotas(p, monto)
    const suma = round2(cuotas.reduce((s, c) => s + c.monto, 0))
    const open = cuotasOpen === p.key
    const iguales = Object.keys(p.overrides).length === 0
    const resumen = iguales ? `${cuotas.length} × ${fmt(cuotas[0]?.monto ?? 0)}` : `${cuotas.length} cuotas`
    return (
      <>
        {sutil ? (
          <button
            type="button"
            onClick={() => setCuotasOpen(open ? null : p.key)}
            aria-expanded={open}
            className="flex w-full items-center justify-between gap-2 px-4 pb-2 text-[12px] text-[#8E8E93] transition-opacity active:opacity-60"
          >
            <span>Cuotas</span>
            <span className="flex items-center gap-1">{resumen}<Chevron open={open} /></span>
          </button>
        ) : (
          <Row label="Cuotas" value={resumen} onClick={() => setCuotasOpen(open ? null : p.key)} chevron />
        )}
        {open && (
          <div className="bg-[#F9F9FB] px-4 py-2 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between py-1.5 text-[15px]">
              <span className="text-[#1C1C1E] dark:text-white">Cantidad</span>
              <input
                type="number" min={1} max={60} value={p.cuotasCount}
                onChange={(e) => updatePago(p.key, { cuotasCount: Math.min(60, Math.max(1, parseInt(e.target.value) || 1)), overrides: {} })}
                className={`${INLINE_INPUT_CLS} w-16`}
                aria-label="Cantidad de cuotas"
              />
            </div>
            {/* Cada cuota: fecha y monto editables (por defecto iguales y mensuales) */}
            <div className="mt-1 border-t border-black/[0.06] pt-1 dark:border-white/[0.06]">
              {cuotas.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-1 text-[13px]">
                  <span className="w-8 text-[#8E8E93]">{i + 1}/{cuotas.length}</span>
                  <div className="flex-1">
                    <DateChip
                      value={c.fecha}
                      onChange={(iso) => updatePago(p.key, { overrides: { ...p.overrides, [i]: { ...p.overrides[i], fecha: iso } } })}
                      label={`Fecha cuota ${i + 1}`}
                    />
                  </div>
                  <div className="w-28">
                    <MoneyField
                      align="right"
                      value={c.montoText}
                      onChange={(v) => updatePago(p.key, { overrides: { ...p.overrides, [i]: { ...p.overrides[i], monto: v } } })}
                      label={`Monto cuota ${i + 1}`}
                    />
                  </div>
                </div>
              ))}
            </div>
            {Math.abs(suma - monto) > 0.01 && (
              <p className="py-1 text-[12px] text-[#FF3B30]">Suman {fmt(suma)} · deberían sumar {fmt(monto)}</p>
            )}
          </div>
        )}
      </>
    )
  }

  return (
    <div className={IOS_FONT}>
      <div className="mb-1.5 px-4 text-[13px] text-[#8E8E93]">{title}</div>
      {!combinado ? (
        <>
          <Group>
            <div className="px-3 py-2.5">
              <Segmented options={metodos} value={pagos[0].metodo} onChange={(m) => setMetodo(pagos[0], m)} />
            </div>
            {pagos[0].metodo === 'CREDITO' ? cuotasRows(pagos[0]) : cajaRow(pagos[0])}
          </Group>
          <div className="mt-1.5 px-4">
            <button type="button" onClick={combinar} className="text-[12px] text-[#8E8E93] transition-opacity active:opacity-60">
              Combinar medios de pago
            </button>
          </div>
        </>
      ) : (
        <>
          <Group>
            {pagos.map((p, idx) => {
              const esAuto = idx === autoIndex
              return (
                <div key={p.key}>
                  <div className="flex min-h-[44px] items-center justify-between gap-3 px-4">
                    <MenuSelect
                      label="Medio de pago"
                      tone="strong"
                      align="left"
                      value={p.metodo}
                      options={metodos}
                      onChange={(m) => setMetodo(p, m)}
                    />
                    <div className="flex items-center gap-2.5">
                      <div className="w-28 text-right">
                        <MoneyField
                          align="right"
                          value={esAuto ? String(montoDe(p)) : p.monto}
                          onChange={(v) => updatePago(p.key, { monto: v, montoManual: esAuto ? true : p.montoManual })}
                          label="Monto"
                          size="md"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => quitarPago(p.key)}
                        aria-label="Quitar medio de pago"
                        className="text-[#C7C7CC] transition-colors hover:text-[#FF3B30]"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                  {p.metodo === 'CREDITO' ? cuotasRows(p, true) : cajaRow(p)}
                </div>
              )
            })}
            <div className="px-4 py-2">
              <button type="button" onClick={agregarMedio} className="text-[12px] text-[#8E8E93] transition-opacity active:opacity-60">+ Agregar medio</button>
            </div>
          </Group>
          <div className="mt-2 flex items-center justify-between px-4 text-[13px]">
            <span className={Math.abs(falta) <= 0.01 ? 'text-brand-military dark:text-[#9AC7A8]' : 'text-[#FF3B30]'}>
              {Math.abs(falta) <= 0.01 ? 'Pago completo' : falta > 0 ? `Falta asignar ${fmt(falta)}` : `Te pasaste ${fmt(-falta)}`}
            </span>
            <button type="button" onClick={noCombinar} className="text-[12px] text-[#8E8E93] transition-opacity active:opacity-60">No combinar</button>
          </div>
        </>
      )}
    </div>
  )
}

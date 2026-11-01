'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import type { CreditAccount } from '@/server/credits/credit-balances'
import EmptyState from '@/components/ui/EmptyState'

const CURRENCY_SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$' }

function fmt(v: number, cur = 'ARS') {
  return `${CURRENCY_SYMBOL[cur] || '$'}${Math.round(Math.abs(v)).toLocaleString('es-AR')}`
}

function fmtDate(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '')
}

// Ingreso y egreso conservan el mismo significado en toda la aplicación.
const COLOR = {
  cxc: { text: 'text-[var(--income)]', soft: 'bg-[var(--income-soft)] text-[var(--income)]', btn: 'bg-[var(--brand-700)] hover:bg-[var(--brand-800)] dark:bg-[#151515] dark:text-[#A8C89C] dark:ring-1 dark:ring-[#A8C89C]/35 dark:hover:bg-black', focus: 'focus-visible:outline-[var(--brand-700)]', progress: 'bg-[var(--income)]' },
  cxp: { text: 'text-[var(--expense)]', soft: 'bg-[var(--expense-soft)] text-[var(--expense)]', btn: 'bg-[var(--brand-700)] hover:bg-[var(--brand-800)] dark:bg-[#151515] dark:text-[#A8C89C] dark:ring-1 dark:ring-[#A8C89C]/35 dark:hover:bg-black', focus: 'focus-visible:outline-[var(--brand-700)]', progress: 'bg-[var(--expense)]' },
}

/** "Arq. Paula Martínez" → "AP" */
function iniciales(nombre: string) {
  const partes = nombre.replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean)
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || '·'
}

/** Más urgentes primero: por próximo vencimiento; sin vencimiento, al final */
function sortByVencimiento(items: CreditAccount[]) {
  return [...items].sort((a, b) =>
    (a.proximoVencimiento ? new Date(a.proximoVencimiento).getTime() : Infinity) -
    (b.proximoVencimiento ? new Date(b.proximoVencimiento).getTime() : Infinity))
}

/** Tarjeta de resumen arriba: Te deben / Debés / Balance neto */
function ResumenCard({ titulo, monto, detalle, tono, variant = 'neutral' }: { titulo: string; monto: number; detalle?: string; tono: string; variant?: 'income' | 'expense' | 'neutral' }) {
  return (
    <div className={`credit-summary-card min-w-0 rounded-lg border bg-[var(--surface)] p-4 ${variant === 'income' ? 'credit-summary-card--income border-[color-mix(in_srgb,var(--income)_22%,var(--border-token))]' : variant === 'expense' ? 'credit-summary-card--expense border-[color-mix(in_srgb,var(--expense)_22%,var(--border-token))]' : 'credit-summary-card--net border-[var(--border-token)]'}`}>
      <p className="credit-summary-label text-[11px] font-semibold text-[var(--text-secondary)]">{titulo}</p>
      <p className={`metric-value mt-2 w-full text-[clamp(20px,2.1vw,27px)] font-semibold ${tono}`}>
        {monto < 0 ? '−' : ''}{fmt(monto)}
      </p>
      {detalle && <p className="credit-summary-detail mt-1 text-[12px] text-[var(--text-tertiary)]">{detalle}</p>}
    </div>
  )
}

// ── Fila iOS: iniciales, nombre y saldo. Toda la fila abre la ficha ──
function CreditAccountRow({ account, onOpen }: { account: CreditAccount; onOpen: () => void }) {
  const isCxC = account.type === 'INCOME'
  const c = isCxC ? COLOR.cxc : COLOR.cxp
  const saldado = account.saldo <= 0

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${account.name}, ${saldado ? 'saldado' : `saldo ${fmt(account.saldo, account.currency)}`}`}
      className={`flex min-h-[68px] w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--surface-muted)] active:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset ${c.focus} ${saldado ? 'opacity-60' : ''}`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[12px] font-semibold ${saldado ? 'bg-[var(--surface-muted)] text-[var(--text-tertiary)]' : c.soft}`}>
        {iniciales(account.name)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--text)]">{account.name}<span className="mt-0.5 block text-[12px] font-normal text-[var(--text-tertiary)]">{saldado ? 'Saldado' : isCxC ? 'Saldo pendiente de cobro' : 'Saldo pendiente de pago'}</span></span>
      {!saldado && (
        <span className={`metric-value w-28 shrink-0 text-right text-[13px] font-semibold ${c.text}`}>{fmt(account.saldo, account.currency)}</span>
      )}
      <svg className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

// ── Ficha: hoja iOS mínima. Saldo, progreso, cuotas pendientes, movimientos (plegado) y Cobrar/Pagar ──
function CreditAccountSheet({ account, onClose }: { account: CreditAccount; onClose: () => void }) {
  const isCxC = account.type === 'INCOME'
  const c = isCxC ? COLOR.cxc : COLOR.cxp
  const cur = account.currency
  const progreso = account.total > 0 ? Math.min(100, Math.round((account.aplicado / account.total) * 100)) : 0

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  // Abre el "+" en Cobro / Pago con este cliente y su cuota más vieja ya elegidos
  const cobrarOPagar = () => {
    if (!account.primeraPendienteId) return
    window.dispatchEvent(new CustomEvent('contago:open-credito-action', {
      detail: {
        type: isCxC ? 'INCOME' : 'EXPENSE',
        subType: isCxC ? 'COBRO_CREDITO' : 'PAGO_DEUDA',
        linkedCreditoId: account.primeraPendienteId,
        contactId: account.contactId ?? '',
        saldoMax: account.cuotasPendientes[0]?.saldo ?? account.saldo,
      },
    }))
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={account.name}>
      <div className="reg-backdrop absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="section-polish reg-sheet relative flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[var(--border-token)] bg-[var(--surface-muted)] shadow-xl md:rounded-3xl">
        <div className="flex justify-center pt-2 md:hidden" aria-hidden>
          <span className="h-[5px] w-9 rounded-full bg-black/15 dark:bg-white/20" />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className={`absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--text-secondary)] transition active:scale-90 focus-visible:outline focus-visible:outline-2 ${c.focus}`}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>

        <div className="overflow-y-auto px-4 pb-4">
          {/* Encabezado: iniciales, nombre, saldo y progreso */}
          <div className="flex flex-col items-center pt-5 text-center">
            <span className={`flex h-14 w-14 items-center justify-center rounded-full text-[18px] font-semibold ${c.soft}`}>{iniciales(account.name)}</span>
            <p className="mt-3 text-[17px] font-semibold text-[var(--text)]">{account.name}</p>
            <p className={`metric-value mt-2 w-full text-center text-[clamp(24px,6vw,34px)] font-semibold ${c.text}`}>{fmt(account.saldo, cur)}</p>
            <p className="text-[13px] text-[var(--text-tertiary)]">{account.saldo > 0 ? (isCxC ? 'Pendiente de cobro' : 'Pendiente de pago') : 'Cuenta saldada'}</p>
            {account.total > 0 && (
              <div className="mt-4 w-full max-w-[260px]">
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border-token)]">
                  <div className={`h-full rounded-full ${c.progress}`} style={{ width: `${progreso}%` }} />
                </div>
                <p className="mt-1.5 text-[12px] text-[var(--text-tertiary)]">
                  {isCxC ? 'Cobrado' : 'Pagado'} {progreso}% · {fmt(account.aplicado, cur)} de {fmt(account.total, cur)}
                </p>
              </div>
            )}
          </div>

          {/* Operaciones: venta/compra a crédito; al tocar se despliegan sus cuotas */}
          {account.operaciones.length > 0 && (
            <section className="mt-6">
              <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Operaciones</p>
              <div className="divide-y divide-[var(--border-token)] overflow-hidden rounded-xl border border-[var(--border-token)] bg-[var(--surface)]">
                {account.operaciones.map((op) => {
                  const saldada = op.resta <= 0.009
                  const n = op.cuotas.length
                  return (
                    <details key={op.id} className="ios-disclosure group">
                      <summary className={`flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden ${saldada ? 'opacity-60' : ''}`}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium text-[var(--text)]">
                            {fmtDate(op.date)} · {isCxC ? 'Venta' : 'Compra'}
                          </p>
                          <p className="truncate text-[12px] text-[var(--text-tertiary)]">
                            {n} {n === 1 ? 'cuota' : 'cuotas'} · {saldada ? (isCxC ? 'Cobrada' : 'Pagada') : `resta ${fmt(op.resta, cur)}`}
                          </p>
                        </div>
                        <span className="metric-value w-28 shrink-0 text-right text-[13px] font-medium text-[var(--text)]">{fmt(op.total, cur)}</span>
                        <svg className="h-3.5 w-3.5 shrink-0 text-[#C7C7CC] transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </summary>
                      {/* Cuotas, sutiles: suman el total de la operación */}
                      <ul className="pb-2 pl-4 pr-10">
                        {op.cuotas.map((q) => {
                          const pagada = q.estado === 'PAGADA'
                          return (
                            <li key={q.id} className="flex items-center gap-2 py-1 text-[12px] tabular-nums">
                              <span className="flex w-3 shrink-0 justify-center" aria-hidden>
                                {pagada ? (
                                  <svg className="h-3 w-3 text-[#AEAEB2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                                ) : q.vencida ? (
                                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--warning)]" />
                                ) : null}
                              </span>
                              <span className={`min-w-0 flex-1 truncate ${pagada ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text-secondary)]'}`}>
                                {q.cuotasTotal ? `Cuota ${q.cuotaNumero}/${q.cuotasTotal}` : 'Cuota única'} · {fmtDate(q.fechaVencimiento)}
                                {q.estado === 'PARCIAL' && <span className="text-[var(--text-tertiary)] no-underline"> · resta {fmt(q.resta, cur)}</span>}
                              </span>
                              <span className={`metric-value w-24 shrink-0 text-right text-[12px] ${pagada ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text-secondary)]'}`}>
                                {fmt(q.monto, cur)}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    </details>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        {/* Botón fijo abajo */}
        {account.saldo > 0 && account.primeraPendienteId && (
          <div className="border-t border-[var(--border-token)] px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
            <button type="button" onClick={cobrarOPagar} className={`min-h-12 w-full rounded-xl py-3.5 text-[16px] font-semibold text-white transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${c.focus} ${c.btn}`}>
              {isCxC ? 'Cobrar' : 'Pagar'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ── Lista CxC (te deben) o CxP (debés): todos, los abiertos por vencimiento y los saldados al final ──
function CreditGroupPanel({ label, isCxC, accounts, abrir }: {
  label: string
  isCxC: boolean
  accounts: CreditAccount[]
  /** Nombre del cliente o proveedor cuya ficha se abre al entrar (ej. desde el Estado patrimonial) */
  abrir?: string | null
}) {
  const [openKey, setOpenKey] = useState<string | null>(() => (abrir ? accounts.find((a) => a.name === abrir)?.key ?? null : null))
  const abiertos = sortByVencimiento(accounts.filter((a) => a.saldo > 0))
  const saldados = accounts.filter((a) => a.saldo <= 0).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const abierta = accounts.find((a) => a.key === openKey) ?? null

  return (
    <section className={`credit-group ${isCxC ? 'credit-group-receivable' : 'credit-group-payable'}`}>
      <div className="overflow-hidden rounded-2xl border border-[var(--border-token)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(5,31,32,0.04)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-token)] px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text)]">{label}</h2>
            <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">{abiertos.length} {abiertos.length === 1 ? 'saldo pendiente' : 'saldos pendientes'}</p>
          </div>
          <span className={`rounded-lg px-2.5 py-1 text-[12px] font-semibold tabular-nums ${isCxC ? COLOR.cxc.soft : COLOR.cxp.soft}`}>{accounts.length}</span>
        </div>
        <div className="divide-y divide-[var(--border-token)]">
        {abiertos.length === 0 && saldados.length === 0 ? (
          <EmptyState
            compact
            title={isCxC ? 'Nadie te debe por ahora' : 'No debés nada por ahora'}
            description={isCxC
              ? 'Cuando registres una venta a crédito, el cliente aparece acá con su saldo y vencimientos.'
              : 'Cuando registres una compra a crédito, el proveedor aparece acá con lo que le debés.'}
          />
        ) : (
          [...abiertos, ...saldados].map((a) => <CreditAccountRow key={a.key} account={a} onOpen={() => setOpenKey(a.key)} />)
        )}
        </div>
      </div>
      {abierta && <CreditAccountSheet account={abierta} onClose={() => setOpenKey(null)} />}
    </section>
  )
}

// ── Componente principal ──
export default function CreditosClient({ accounts }: { accounts: CreditAccount[] }) {
  // Ficha a abrir al entrar (?abrir=Nombre), ej. desde el Estado patrimonial
  const abrir = useSearchParams().get('abrir')
  const cxc = accounts.filter((a) => a.type === 'INCOME')
  const cxp = accounts.filter((a) => a.type === 'EXPENSE')
  // Totales en pesos = suma de los saldos de la lista (misma regla que el Balance general)
  const sumArs = (list: CreditAccount[]) => list.filter((a) => a.currency === 'ARS').reduce((s, a) => s + a.saldo, 0)
  const totalPorCobrar = sumArs(cxc)
  const totalPorPagar = sumArs(cxp)

  const abiertos = (list: CreditAccount[]) => list.filter((a) => a.saldo > 0).length
  const nCxc = abiertos(cxc)
  const nCxp = abiertos(cxp)

  return (
    <div className="space-y-5">
      {/* Resumen: créditos (te deben) y deudas (debés) */}
      <div className="credit-summary grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <ResumenCard titulo="Por cobrar" monto={totalPorCobrar} detalle={`${nCxc} ${nCxc === 1 ? 'cuenta abierta' : 'cuentas abiertas'}`} tono={COLOR.cxc.text} variant="income" />
        <ResumenCard titulo="Por pagar" monto={totalPorPagar} detalle={`${nCxp} ${nCxp === 1 ? 'cuenta abierta' : 'cuentas abiertas'}`} tono={COLOR.cxp.text} variant="expense" />
        <ResumenCard titulo="Balance neto" monto={totalPorCobrar - totalPorPagar} detalle="Por cobrar menos por pagar" tono={totalPorCobrar >= totalPorPagar ? COLOR.cxc.text : COLOR.cxp.text} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <CreditGroupPanel label="Créditos" isCxC accounts={cxc} abrir={abrir} />
        <CreditGroupPanel label="Deudas" isCxC={false} accounts={cxp} abrir={abrir} />
      </div>
    </div>
  )
}

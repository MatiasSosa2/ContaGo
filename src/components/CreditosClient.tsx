'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CreditAccount } from '@/server/credits/credit-balances'

const CURRENCY_SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$' }

function fmt(v: number, cur = 'ARS') {
  return `${CURRENCY_SYMBOL[cur] || '$'}${Math.round(Math.abs(v)).toLocaleString('es-AR')}`
}

function fmtDate(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '')
}

// Créditos en verde (te deben), deudas en rojo (debés)
const COLOR = {
  cxc: { text: 'text-[#2D6A4F] dark:text-[#5B9A78]', soft: 'bg-[#2D6A4F]/12 text-[#2D6A4F] dark:bg-[#5B9A78]/20 dark:text-[#8FBFA5]', btn: 'bg-[#2D6A4F] hover:bg-[#2D6A4F]' },
  cxp: { text: 'text-[#B42318] dark:text-[#F97066]', soft: 'bg-[var(--ds-orange-dark)]/15 text-[#B42318] dark:bg-[var(--ds-orange-dark)]/20 dark:text-[#F97066]', btn: 'bg-[var(--ds-orange-dark)] hover:bg-[#912018]' },
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

type Filtro = 'todos' | 'vencidos' | 'alDia' | 'saldados'

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'vencidos', label: 'Vencidos' },
  { id: 'alDia', label: 'Al día' },
  { id: 'saldados', label: 'Saldados' },
]

function cumpleFiltro(a: CreditAccount, f: Filtro) {
  if (f === 'todos') return true
  if (f === 'saldados') return a.saldo <= 0
  if (a.saldo <= 0) return false
  return f === 'vencidos' ? a.vencido : !a.vencido
}

/** Estado de cada cuenta: vencida en rojo, próxima fecha en verde, saldada en gris */
function EstadoChip({ account }: { account: CreditAccount }) {
  if (account.saldo <= 0) return <span className="text-[12px] text-[var(--ds-gray-500)]">Saldado</span>
  if (account.vencido) {
    return <span className="inline-flex rounded-full bg-[#B42318]/10 px-2 py-0.5 text-[11px] font-semibold text-[#B42318] dark:bg-[#F97066]/15 dark:text-[#F97066]">Vencido</span>
  }
  if (account.proximoVencimiento) {
    return <span className="inline-flex rounded-full bg-[#2D6A4F]/10 px-2 py-0.5 text-[11px] font-medium text-[#2D6A4F] dark:bg-[#5B9A78]/20 dark:text-[#8FBFA5]">Vence {fmtDate(account.proximoVencimiento)}</span>
  }
  return null
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
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.03] active:bg-black/[0.05] dark:hover:bg-white/[0.04] ${saldado ? 'opacity-55' : ''}`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${saldado ? 'bg-black/[0.06] text-[var(--ds-gray-500)] dark:bg-white/10' : c.soft}`}>
        {iniciales(account.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] text-[var(--ds-gray-900)] dark:text-white">{account.name}</span>
        <span className="mt-0.5 block"><EstadoChip account={account} /></span>
      </span>
      {!saldado && (
        <span className="shrink-0 text-[15px] font-medium tabular-nums text-[var(--ds-gray-900)] dark:text-white">{fmt(account.saldo, account.currency)}</span>
      )}
      <svg className="h-3.5 w-3.5 shrink-0 text-[var(--ds-gray-300)] dark:text-[var(--ds-gray-650)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
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
      <div className="reg-sheet relative flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-[var(--ds-gray-100)] shadow-2xl dark:bg-black md:rounded-3xl">
        <div className="flex justify-center pt-2 md:hidden" aria-hidden>
          <span className="h-[5px] w-9 rounded-full bg-black/15 dark:bg-white/20" />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.06] text-[var(--ds-gray-500)] transition active:scale-90 dark:bg-white/10"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>

        <div className="overflow-y-auto px-4 pb-4">
          {/* Encabezado: iniciales, nombre, saldo y progreso */}
          <div className="flex flex-col items-center pt-5 text-center">
            <span className={`flex h-14 w-14 items-center justify-center rounded-full text-[18px] font-semibold ${c.soft}`}>{iniciales(account.name)}</span>
            <p className="mt-2 text-[17px] font-semibold text-[var(--ds-gray-900)] dark:text-white">{account.name}</p>
            <p className={`mt-1 text-[34px] font-semibold tracking-tight tabular-nums ${c.text}`}>{fmt(account.saldo, cur)}</p>
            <p className="text-[13px] text-[var(--ds-gray-500)]">{account.saldo > 0 ? (isCxC ? 'te debe' : 'le debés') : 'Saldado'}</p>
            {account.total > 0 && (
              <div className="mt-4 w-full max-w-[260px]">
                <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                  <div className={`h-full rounded-full ${isCxC ? 'bg-[#2D6A4F]' : 'bg-[var(--ds-orange-dark)]'}`} style={{ width: `${progreso}%` }} />
                </div>
                <p className="mt-1.5 text-[12px] text-[var(--ds-gray-500)]">
                  {isCxC ? 'Cobrado' : 'Pagado'} {progreso}% · {fmt(account.aplicado, cur)} de {fmt(account.total, cur)}
                </p>
              </div>
            )}
          </div>

          {/* Operaciones: venta/compra a crédito; al tocar se despliegan sus cuotas */}
          {account.operaciones.length > 0 && (
            <section className="mt-6">
              <p className="mb-1.5 px-4 text-[13px] text-[var(--ds-gray-500)]">Operaciones</p>
              <div className="divide-y divide-black/[0.06] overflow-hidden rounded-xl bg-white dark:divide-white/[0.08] dark:bg-[var(--ds-gray-900)]">
                {account.operaciones.map((op) => {
                  const saldada = op.resta <= 0.009
                  const n = op.cuotas.length
                  return (
                    <details key={op.id} className="ios-disclosure group">
                      <summary className={`flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden ${saldada ? 'opacity-60' : ''}`}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] text-[var(--ds-gray-900)] dark:text-white">
                            {fmtDate(op.date)} · {isCxC ? 'Venta' : 'Compra'}
                          </p>
                          <p className="truncate text-[12px] text-[var(--ds-gray-500)]">
                            {n} {n === 1 ? 'cuota' : 'cuotas'} · {saldada ? (isCxC ? 'Cobrada' : 'Pagada') : `resta ${fmt(op.resta, cur)}`}
                          </p>
                        </div>
                        <span className="shrink-0 text-[15px] tabular-nums text-[var(--ds-gray-900)] dark:text-white">{fmt(op.total, cur)}</span>
                        <svg className="h-3.5 w-3.5 shrink-0 text-[var(--ds-gray-300)] transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
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
                                  <svg className="h-3 w-3 text-[var(--ds-gray-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                                ) : q.vencida ? (
                                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--ds-orange-dark)]" />
                                ) : null}
                              </span>
                              <span className={`min-w-0 flex-1 truncate ${pagada ? 'text-[var(--ds-gray-400)] line-through decoration-black/15 dark:text-[var(--ds-gray-600)] dark:decoration-white/15' : 'text-[var(--ds-gray-700)] dark:text-[var(--ds-gray-200)]/80'}`}>
                                {q.cuotasTotal ? `Cuota ${q.cuotaNumero}/${q.cuotasTotal}` : 'Cuota única'} · {fmtDate(q.fechaVencimiento)}
                                {q.estado === 'PARCIAL' && <span className="text-[var(--ds-gray-500)] no-underline"> · resta {fmt(q.resta, cur)}</span>}
                              </span>
                              <span className={`shrink-0 ${pagada ? 'text-[var(--ds-gray-400)] line-through decoration-black/15 dark:text-[var(--ds-gray-600)] dark:decoration-white/15' : 'text-[var(--ds-gray-700)] dark:text-[var(--ds-gray-200)]/80'}`}>
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
          <div className="border-t border-black/[0.06] px-4 py-3 dark:border-white/10">
            <button type="button" onClick={cobrarOPagar} className={`w-full rounded-xl py-3.5 text-[16px] font-semibold text-white transition active:scale-[0.99] ${c.btn}`}>
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
function CreditGroupPanel({ label, isCxC, accounts, filtro }: {
  label: string
  isCxC: boolean
  accounts: CreditAccount[]
  filtro: Filtro
}) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const visibles = accounts.filter((a) => cumpleFiltro(a, filtro))
  const abiertos = sortByVencimiento(visibles.filter((a) => a.saldo > 0))
  const saldados = visibles.filter((a) => a.saldo <= 0).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const abierta = accounts.find((a) => a.key === openKey) ?? null

  const vacio = filtro !== 'todos'
    ? 'Sin cuentas en este filtro'
    : `${isCxC ? 'Nadie te debe' : 'No debés nada'} por ahora`

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="ds-label">{label}</h2>
        <span className="text-[12px] tabular-nums text-[var(--ds-gray-500)]">{visibles.length}</span>
      </div>
      <div className="ds-panel divide-y divide-black/[0.06] overflow-hidden dark:divide-white/[0.08]">
        {visibles.length === 0 ? (
          <p className="py-8 text-center text-[14px] text-[var(--ds-gray-500)]">{vacio}</p>
        ) : (
          [...abiertos, ...saldados].map((a) => <CreditAccountRow key={a.key} account={a} onOpen={() => setOpenKey(a.key)} />)
        )}
      </div>
      {abierta && <CreditAccountSheet account={abierta} onClose={() => setOpenKey(null)} />}
    </section>
  )
}

// ── Componente principal ──
export default function CreditosClient({ accounts }: { accounts: CreditAccount[] }) {
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const cxc = accounts.filter((a) => a.type === 'INCOME')
  const cxp = accounts.filter((a) => a.type === 'EXPENSE')
  // Totales en pesos = suma de los saldos de la lista (misma regla que el Balance general)
  const sumArs = (list: CreditAccount[]) => list.filter((a) => a.currency === 'ARS').reduce((s, a) => s + a.saldo, 0)
  const totalPorCobrar = sumArs(cxc)
  const totalPorPagar = sumArs(cxp)
  const neto = totalPorCobrar - totalPorPagar
  const totalBruto = totalPorCobrar + totalPorPagar
  const pctCobrar = totalBruto > 0 ? Math.round((totalPorCobrar / totalBruto) * 100) : 0

  const abiertos = (list: CreditAccount[]) => list.filter((a) => a.saldo > 0).length
  const nCxc = abiertos(cxc)
  const nCxp = abiertos(cxp)
  const nVencidos = accounts.filter((a) => a.vencido).length
  const conteo = (f: Filtro) => accounts.filter((a) => cumpleFiltro(a, f)).length

  return (
    <div className="space-y-6">
      {/* Panel destacado: balance neto, cobrar vs pagar y alertas */}
      <section className="ds-hero p-5 md:p-6">
        <p className="ds-label">Balance de créditos</p>
        <p className="mt-2 text-[36px] font-semibold leading-none tracking-tight tabular-nums">
          {neto < 0 ? '−' : ''}{fmt(neto)}
        </p>
        <p className="mt-2 text-[13px] text-white/60">
          {neto >= 0 ? 'Te deben más de lo que debés' : 'Debés más de lo que te deben'}
          {nVencidos > 0 && (
            <>
              {' · '}
              <span className="font-medium text-[#FCA5A5]">{nVencidos} {nVencidos === 1 ? 'vencido' : 'vencidos'}</span>
            </>
          )}
        </p>

        <div className="mt-5 flex h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
          <div className="h-full bg-[#6DA47A]" style={{ width: `${pctCobrar}%` }} />
          <div className="h-full bg-[#F97066]" style={{ width: `${totalBruto > 0 ? 100 - pctCobrar : 0}%` }} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/[0.06] p-3">
            <p className="ds-label">Por cobrar</p>
            <p className="mt-1 text-[18px] font-semibold tabular-nums text-[#F0FDF4]">{fmt(totalPorCobrar)}</p>
            <p className="text-[12px] text-white/50">{nCxc} {nCxc === 1 ? 'cliente' : 'clientes'}</p>
          </div>
          <div className="rounded-xl bg-white/[0.06] p-3">
            <p className="ds-label">Por pagar</p>
            <p className="mt-1 text-[18px] font-semibold tabular-nums text-[#FCA5A5]">{fmt(totalPorPagar)}</p>
            <p className="text-[12px] text-white/50">{nCxp} {nCxp === 1 ? 'proveedor' : 'proveedores'}</p>
          </div>
        </div>
      </section>

      {/* Filtro por estado: el mismo lenguaje de la barra lateral */}
      <div role="tablist" aria-label="Filtrar cuentas" className="scrollbar-hide flex gap-1 overflow-x-auto rounded-xl bg-black/[0.05] p-1 dark:bg-white/[0.06]">
        {FILTROS.map((f) => {
          const activo = filtro === f.id
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => setFiltro(f.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${activo ? 'ds-item-active' : 'text-[var(--ds-gray-500)] hover:text-[var(--ds-gray-900)] dark:hover:text-white'}`}
            >
              {f.label}
              <span className="text-[11px] tabular-nums opacity-70">{conteo(f.id)}</span>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <CreditGroupPanel label="Créditos" isCxC accounts={cxc} filtro={filtro} />
        <CreditGroupPanel label="Deudas" isCxC={false} accounts={cxp} filtro={filtro} />
      </div>
    </div>
  )
}

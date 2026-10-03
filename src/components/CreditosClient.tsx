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

// Colores (los mismos que Cajas): créditos índigo, deudas ámbar
const COLOR = {
  cxc: { text: 'text-[#5E5CE6] dark:text-[#7D7AFF]', soft: 'bg-[#5E5CE6]/12 text-[#4B49C8] dark:bg-[#7D7AFF]/20 dark:text-[#A5A3FF]', btn: 'bg-[#5E5CE6] hover:bg-[#4B49C8]' },
  cxp: { text: 'text-[#C77700] dark:text-[#FFB340]', soft: 'bg-[#FF9F0A]/15 text-[#B86E00] dark:bg-[#FF9F0A]/20 dark:text-[#FFB340]', btn: 'bg-[#FF9F0A] hover:bg-[#E58E00]' },
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
function ResumenCard({ titulo, monto, detalle, tono }: { titulo: string; monto: number; detalle?: string; tono: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.03)] dark:bg-[#1C1C1E] dark:shadow-none">
      <p className="text-[13px] font-medium text-[#8E8E93]">{titulo}</p>
      <p className={`mt-1 text-[30px] font-semibold leading-tight tracking-tight tabular-nums ${tono}`}>
        {monto < 0 ? '−' : ''}{fmt(monto)}
      </p>
      {detalle && <p className="mt-0.5 text-[13px] text-[#8E8E93]">{detalle}</p>}
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
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.03] active:bg-black/[0.05] dark:hover:bg-white/[0.04] ${saldado ? 'opacity-55' : ''}`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${saldado ? 'bg-black/[0.06] text-[#8E8E93] dark:bg-white/10' : c.soft}`}>
        {iniciales(account.name)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] text-[#1C1C1E] dark:text-white">{account.name}</span>
      {!saldado && (
        <span className="shrink-0 text-[15px] font-medium tabular-nums text-[#1C1C1E] dark:text-white">{fmt(account.saldo, account.currency)}</span>
      )}
      <svg className="h-3.5 w-3.5 shrink-0 text-[#C7C7CC] dark:text-[#48484A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
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
      <div className="reg-sheet relative flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-[#F2F2F7] shadow-2xl dark:bg-black md:rounded-3xl">
        <div className="flex justify-center pt-2 md:hidden" aria-hidden>
          <span className="h-[5px] w-9 rounded-full bg-black/15 dark:bg-white/20" />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.06] text-[#8E8E93] transition active:scale-90 dark:bg-white/10"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>

        <div className="overflow-y-auto px-4 pb-4">
          {/* Encabezado: iniciales, nombre, saldo y progreso */}
          <div className="flex flex-col items-center pt-5 text-center">
            <span className={`flex h-14 w-14 items-center justify-center rounded-full text-[18px] font-semibold ${c.soft}`}>{iniciales(account.name)}</span>
            <p className="mt-2 text-[17px] font-semibold text-[#1C1C1E] dark:text-white">{account.name}</p>
            <p className={`mt-1 text-[34px] font-semibold tracking-tight tabular-nums ${c.text}`}>{fmt(account.saldo, cur)}</p>
            <p className="text-[13px] text-[#8E8E93]">{account.saldo > 0 ? (isCxC ? 'te debe' : 'le debés') : 'Saldado'}</p>
            {account.total > 0 && (
              <div className="mt-4 w-full max-w-[260px]">
                <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                  <div className={`h-full rounded-full ${isCxC ? 'bg-[#5E5CE6]' : 'bg-[#FF9F0A]'}`} style={{ width: `${progreso}%` }} />
                </div>
                <p className="mt-1.5 text-[12px] text-[#8E8E93]">
                  {isCxC ? 'Cobrado' : 'Pagado'} {progreso}% · {fmt(account.aplicado, cur)} de {fmt(account.total, cur)}
                </p>
              </div>
            )}
          </div>

          {/* Operaciones: venta/compra a crédito; al tocar se despliegan sus cuotas */}
          {account.operaciones.length > 0 && (
            <section className="mt-6">
              <p className="mb-1.5 px-4 text-[13px] text-[#8E8E93]">Operaciones</p>
              <div className="divide-y divide-black/[0.06] overflow-hidden rounded-xl bg-white dark:divide-white/[0.08] dark:bg-[#1C1C1E]">
                {account.operaciones.map((op) => {
                  const saldada = op.resta <= 0.009
                  const n = op.cuotas.length
                  return (
                    <details key={op.id} className="ios-disclosure group">
                      <summary className={`flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden ${saldada ? 'opacity-60' : ''}`}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] text-[#1C1C1E] dark:text-white">
                            {fmtDate(op.date)} · {isCxC ? 'Venta' : 'Compra'}
                          </p>
                          <p className="truncate text-[12px] text-[#8E8E93]">
                            {n} {n === 1 ? 'cuota' : 'cuotas'} · {saldada ? (isCxC ? 'Cobrada' : 'Pagada') : `resta ${fmt(op.resta, cur)}`}
                          </p>
                        </div>
                        <span className="shrink-0 text-[15px] tabular-nums text-[#1C1C1E] dark:text-white">{fmt(op.total, cur)}</span>
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
                                  <span className="h-1.5 w-1.5 rounded-full bg-[#FF9F0A]" />
                                ) : null}
                              </span>
                              <span className={`min-w-0 flex-1 truncate ${pagada ? 'text-[#AEAEB2] line-through decoration-black/15 dark:text-[#636366] dark:decoration-white/15' : 'text-[#3C3C43] dark:text-[#EBEBF5]/80'}`}>
                                {q.cuotasTotal ? `Cuota ${q.cuotaNumero}/${q.cuotasTotal}` : 'Cuota única'} · {fmtDate(q.fechaVencimiento)}
                                {q.estado === 'PARCIAL' && <span className="text-[#8E8E93] no-underline"> · resta {fmt(q.resta, cur)}</span>}
                              </span>
                              <span className={`shrink-0 ${pagada ? 'text-[#AEAEB2] line-through decoration-black/15 dark:text-[#636366] dark:decoration-white/15' : 'text-[#3C3C43] dark:text-[#EBEBF5]/80'}`}>
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
function CreditGroupPanel({ label, isCxC, accounts }: {
  label: string
  isCxC: boolean
  accounts: CreditAccount[]
}) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const abiertos = sortByVencimiento(accounts.filter((a) => a.saldo > 0))
  const saldados = accounts.filter((a) => a.saldo <= 0).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const abierta = accounts.find((a) => a.key === openKey) ?? null

  return (
    <section>
      <h2 className="mb-2 px-1 text-[13px] font-medium text-[#8E8E93]">{label}</h2>
      <div className="divide-y divide-black/[0.06] overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:divide-white/[0.08] dark:bg-[#1C1C1E] dark:shadow-none">
        {abiertos.length === 0 && saldados.length === 0 ? (
          <p className="py-8 text-center text-[14px] text-[#8E8E93]">{isCxC ? 'Nadie te debe' : 'No debés nada'} por ahora</p>
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
    <div className="space-y-6">
      {/* Resumen: créditos (te deben) y deudas (debés) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ResumenCard titulo="Créditos" monto={totalPorCobrar} detalle={`${nCxc} ${nCxc === 1 ? 'cliente' : 'clientes'}`} tono={COLOR.cxc.text} />
        <ResumenCard titulo="Deudas" monto={totalPorPagar} detalle={`${nCxp} ${nCxp === 1 ? 'proveedor' : 'proveedores'}`} tono={COLOR.cxp.text} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <CreditGroupPanel label="Créditos" isCxC accounts={cxc} />
        <CreditGroupPanel label="Deudas" isCxC={false} accounts={cxp} />
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import type { CreditAccount } from '@/server/credits/credit-balances'

const CURRENCY_SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$' }

function fmt(v: number, cur = 'ARS') {
  return `${CURRENCY_SYMBOL[cur] || '$'}${Math.abs(v).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function fmtDate(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const isPast = (d: Date | string | null) => Boolean(d && new Date(d) < new Date())

// ── Íconos ──
function CxCIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  )
}

function CxPIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  )
}

/** Más urgentes primero: por próximo vencimiento; sin vencimiento, al final */
function sortByVencimiento(items: CreditAccount[]) {
  return [...items].sort((a, b) =>
    (a.proximoVencimiento ? new Date(a.proximoVencimiento).getTime() : Infinity) -
    (b.proximoVencimiento ? new Date(b.proximoVencimiento).getTime() : Infinity))
}

function SummarySplitCard({
  porCobrar,
  porPagar,
  diferencia,
}: {
  porCobrar: number
  porPagar: number
  diferencia: number
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_240px] xl:items-center">
      <div
        className="relative w-full min-h-[92px] overflow-hidden border border-[#E7E5E4] px-4 py-3 shadow-[0_8px_20px_rgba(0,0,0,0.05)] backdrop-blur-[6px] dark:border-[#3A3A3A]"
      >
        <svg className="pointer-events-none absolute inset-0 h-full w-full dark:hidden" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="balance-left-fill-light" x1="0" y1="0" x2="66" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#D7EEE4" />
              <stop offset="100%" stopColor="#C6E3D6" />
            </linearGradient>
            <linearGradient id="balance-right-fill-light" x1="34" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F0D8B7" />
              <stop offset="100%" stopColor="#E3C08F" />
            </linearGradient>
            <linearGradient id="balance-line-light" x1="34" y1="0" x2="66" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#C6E3D6" />
              <stop offset="48%" stopColor="#C6E3D6" />
              <stop offset="52%" stopColor="#EACCA3" />
              <stop offset="100%" stopColor="#EACCA3" />
            </linearGradient>
          </defs>

          <path d="M0 0 H66 L52 42 L48 58 L34 100 H0 Z" fill="url(#balance-left-fill-light)" />
          <path d="M66 0 H100 V100 H34 L48 58 L52 42 Z" fill="url(#balance-right-fill-light)" />
          <path
            d="M66 0 L52 42 L48 58 L34 100"
            fill="none"
            stroke="url(#balance-line-light)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <svg className="pointer-events-none absolute inset-0 hidden h-full w-full dark:block" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="balance-left-fill-dark" x1="0" y1="0" x2="66" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#26483B" />
              <stop offset="100%" stopColor="#1F3A31" />
            </linearGradient>
            <linearGradient id="balance-right-fill-dark" x1="34" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#6B4D2D" />
              <stop offset="100%" stopColor="#533A20" />
            </linearGradient>
            <linearGradient id="balance-line-dark" x1="34" y1="0" x2="66" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1F3A31" />
              <stop offset="48%" stopColor="#1F3A31" />
              <stop offset="52%" stopColor="#6B4D2D" />
              <stop offset="100%" stopColor="#6B4D2D" />
            </linearGradient>
          </defs>

          <path d="M0 0 H66 L52 42 L48 58 L34 100 H0 Z" fill="url(#balance-left-fill-dark)" />
          <path d="M66 0 H100 V100 H34 L48 58 L52 42 Z" fill="url(#balance-right-fill-dark)" />
          <path
            d="M66 0 L52 42 L48 58 L34 100"
            fill="none"
            stroke="url(#balance-line-dark)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div
          className="pointer-events-none absolute inset-0 opacity-80 dark:opacity-40"
          style={{
            background: 'linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.08) 100%)',
          }}
        />

        <div className="relative flex items-center justify-between gap-4">
          <div className="z-[2] flex min-w-0 flex-col items-start">
            <span className="text-[24px] font-mono font-bold leading-none text-[#1A1A1A] num-tabular dark:text-[#F4FFF8]">
              {fmt(porCobrar)}
            </span>
            <span className="mt-0.5 text-[11px] text-[#666666] dark:text-[#D6D3D1]">Por cobrar</span>
          </div>

          <div className="z-[2] flex min-w-0 flex-col items-end">
            <span className="text-[24px] font-mono font-bold leading-none text-[#1A1A1A] num-tabular dark:text-[#FFF7EA]">
              {fmt(porPagar)}
            </span>
            <span className="mt-0.5 text-[11px] text-[#666666] dark:text-[#D6D3D1]">Por pagar</span>
          </div>
        </div>
      </div>

      <div className="flex min-h-[92px] flex-col justify-center border border-[#E7E5E4] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:border-[#3A3A3A] dark:bg-[#181818]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400 dark:text-[#9F9F9F]">Balance neto</p>
        <p className={`mt-2 text-[30px] font-mono font-bold leading-none num-tabular ${diferencia >= 0 ? 'text-brand-military-dark dark:text-[#6EBC8A]' : 'text-[#9A3412] dark:text-[#F59E0B]'}`}>
          {diferencia >= 0 ? '' : '-'}{fmt(Math.abs(diferencia))}
        </p>
      </div>
    </div>
  )
}

// ── Fila: próximo vencimiento, cliente/proveedor y saldo. Toda la fila abre la ficha ──
function CreditAccountRow({ account, onOpen }: { account: CreditAccount; onOpen: () => void }) {
  const isCxC = account.type === 'INCOME'
  const saldado = account.saldo <= 0
  const vencido = isPast(account.proximoVencimiento) && !saldado

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-center border-b border-l-[3px] border-[#ECE7E1] bg-white text-left transition hover:bg-[#FAFBFA] dark:border-white/5 dark:bg-transparent dark:hover:bg-white/[0.03] ${
        isCxC ? 'border-l-[#3A4D39]' : 'border-l-[#A65D57]'
      }`}
    >
      <span className={`w-[110px] shrink-0 px-4 py-4 text-sm font-medium tabular-nums ${vencido ? 'font-semibold text-red-500' : 'text-[#4B5563] dark:text-stone-300'}`}>
        {saldado ? '—' : fmtDate(account.proximoVencimiento)}
      </span>
      <span className="min-w-0 flex-1 truncate px-4 py-4 text-sm font-semibold text-[#1F2937] dark:text-[#E8E8E8]">{account.name}</span>
      <span className="shrink-0 px-4 py-4 text-right">
        {saldado ? (
          <span className="rounded-full border border-stone-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-400 dark:border-white/10">Saldado</span>
        ) : (
          <span className={`font-mono text-sm font-bold num-tabular ${isCxC ? 'text-[#2D6A4F] dark:text-[#8FD0A7]' : 'text-[#A65D57] dark:text-[#E08580]'}`}>
            {isCxC ? '+' : '−'}{fmt(account.saldo, account.currency)}
          </span>
        )}
      </span>
      <svg className="mr-3 h-4 w-4 shrink-0 text-stone-300 dark:text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

function Modal({ onClose, children, maxWidth = 'max-w-[920px]' }: { onClose: () => void; children: React.ReactNode; maxWidth?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 sm:p-6">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative my-4 flex max-h-[calc(100vh-56px)] w-full ${maxWidth} flex-col overflow-hidden border border-stone-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)] sm:max-h-[calc(100vh-72px)] dark:border-white/10 dark:bg-[#141414]`}>
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center border border-stone-200 bg-white/95 text-stone-500 shadow-sm transition-colors hover:text-stone-700 dark:border-white/10 dark:bg-[#1B1B1B] dark:text-stone-300"
          aria-label="Cerrar"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  )
}

// ── Ficha: saldo, cuotas pendientes y movimientos (crédito inicial y cobros/pagos) ──
function CreditAccountSheet({ account, onClose }: { account: CreditAccount; onClose: () => void }) {
  const isCxC = account.type === 'INCOME'
  const cur = account.currency

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

  return (
    <Modal onClose={onClose} maxWidth="max-w-[640px]">
      <div className="border-b border-stone-100 px-5 py-4 pr-14 dark:border-white/10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">{isCxC ? 'Cliente' : 'Proveedor'}</p>
        <h3 className="mt-0.5 truncate text-base font-semibold text-stone-900 dark:text-[#E8E8E8]">{account.name}</h3>
      </div>

      <div className="overflow-y-auto">
        {/* Saldo restante */}
        <div className="px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Saldo {isCxC ? 'a cobrar' : 'a pagar'}</p>
          <p className={`mt-1 font-mono text-[32px] font-bold leading-none num-tabular ${isCxC ? 'text-brand-military-dark dark:text-[#6EBC8A]' : 'text-brand-gold-dark dark:text-[#C5A065]'}`}>
            {fmt(account.saldo, cur)}
          </p>
          <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
            {isCxC ? 'Vendido' : 'Comprado'} a crédito {fmt(account.total, cur)} · {isCxC ? 'Cobrado' : 'Pagado'} {fmt(account.aplicado, cur)}
          </p>
        </div>

        {/* Cuotas pendientes */}
        {account.cuotasPendientes.length > 0 && (
          <div className="border-t border-[#ECE7E1] dark:border-white/10">
            <p className="px-5 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">Cuotas pendientes</p>
            {account.cuotasPendientes.map((q) => (
              <div key={q.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className={`w-[76px] shrink-0 tabular-nums ${q.vencida ? 'font-semibold text-red-500' : 'text-stone-500 dark:text-stone-400'}`}>{fmtDate(q.fechaVencimiento)}</span>
                <span className="min-w-0 flex-1 truncate text-[#374151] dark:text-stone-300">
                  {q.description}
                  {q.cuotasTotal && q.cuotasTotal > 1 ? <span className="text-stone-400"> · cuota {q.cuotaNumero}/{q.cuotasTotal}</span> : null}
                </span>
                <span className="shrink-0 font-mono font-semibold num-tabular text-[#1F2937] dark:text-[#E8E8E8]">{fmt(q.saldo, cur)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Movimientos: + crédito inicial / − cobros y pagos, con la fecha en que impactaron en caja */}
        <div className="border-t border-[#ECE7E1] pb-3 dark:border-white/10">
          <p className="px-5 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">Movimientos</p>
          {account.movimientos.map((m) => {
            const esCredito = m.kind === 'CREDITO'
            return (
              <div key={m.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className="w-[76px] shrink-0 tabular-nums text-stone-500 dark:text-stone-400">{fmtDate(m.date)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[#374151] dark:text-stone-300">
                    {esCredito ? (isCxC ? 'Venta a crédito' : 'Compra a crédito') : (isCxC ? 'Cobro' : 'Pago')}
                  </span>
                  <span className="block truncate text-[11px] text-stone-400">{esCredito ? m.description : m.account ?? m.description}</span>
                </span>
                <span className={`shrink-0 font-mono font-semibold num-tabular ${esCredito ? 'text-[#1F2937] dark:text-[#E8E8E8]' : isCxC ? 'text-[#2D6A4F] dark:text-[#8FD0A7]' : 'text-[#A65D57] dark:text-[#E08580]'}`}>
                  {esCredito ? '+' : '−'}{fmt(m.amount, cur)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {account.saldo > 0 && account.primeraPendienteId && (
        <div className="border-t border-[#ECE7E1] px-5 py-4 dark:border-white/10">
          <button
            type="button"
            onClick={cobrarOPagar}
            className={`w-full py-3 text-sm font-semibold text-white shadow-sm transition ${isCxC ? 'bg-brand-military hover:bg-brand-military-dark' : 'bg-brand-oxide hover:opacity-90'}`}
          >
            {isCxC ? 'Cobrar' : 'Pagar'}
          </button>
        </div>
      )}
    </Modal>
  )
}

// ── Panel CxC (cobrar) o CxP (pagar) ──
function CreditGroupPanel({ label, icon, isCxC, accounts, total }: {
  label: string
  icon: React.ReactNode
  isCxC: boolean
  accounts: CreditAccount[]
  total: number
}) {
  const [showAll, setShowAll] = useState(false)
  const [openKey, setOpenKey] = useState<string | null>(null)

  const abiertos = sortByVencimiento(accounts.filter((a) => a.saldo > 0))
  // En "Ver todos" también los saldados, al final, para poder ver su historial
  const todos = [...abiertos, ...accounts.filter((a) => a.saldo <= 0).sort((a, b) => a.name.localeCompare(b.name))]
  const abierta = accounts.find((a) => a.key === openKey) ?? null

  return (
    <div
      className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-white/10 overflow-hidden"
      style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.05)' }}
    >
      <div className="px-5 pt-5 pb-4 bg-gradient-to-b from-[#FAFBFC] to-white dark:from-[#141414] dark:to-[#141414]">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 flex items-center justify-center ${isCxC ? 'bg-brand-military-light text-brand-military' : 'bg-brand-gold-light text-brand-gold-dark'}`}>
              {icon}
            </div>
            <h2 className="text-base font-semibold text-[#1F2937] dark:text-[#E8E8E8]">{label}</h2>
          </div>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="border border-[#D6D3D1] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#57534E] transition-colors hover:border-[#A8A29E] hover:text-[#1F2937] dark:border-white/10 dark:bg-white/5 dark:text-[#D6D3D1]"
          >
            Ver todos
          </button>
        </div>
        <p className={`text-3xl md:text-[32px] font-mono font-bold num-tabular leading-none ${isCxC ? 'text-brand-military-dark dark:text-[#6EBC8A]' : 'text-brand-gold-dark dark:text-[#C5A065]'}`}>
          {fmt(total)}
        </p>
        <p className="text-xs text-[#9CA3AF] mt-1">pendiente de {isCxC ? 'cobro' : 'pago'}</p>
      </div>

      <div className="border-t border-[#ECE7E1] dark:border-white/10">
        {abiertos.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#9CA3AF]">{isCxC ? 'Nadie te debe' : 'No debés nada'} por ahora</p>
        ) : (
          abiertos.slice(0, 3).map((a) => <CreditAccountRow key={a.key} account={a} onOpen={() => setOpenKey(a.key)} />)
        )}
      </div>

      {showAll && (
        <Modal onClose={() => setShowAll(false)}>
          <div className="border-b border-stone-100 px-5 py-4 pr-14 dark:border-white/10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">{isCxC ? 'Clientes' : 'Proveedores'}</p>
            <h3 className="mt-0.5 text-base font-semibold text-stone-900 dark:text-[#E8E8E8]">{label}</h3>
          </div>
          <div className="overflow-y-auto">
            {todos.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#9CA3AF]">No hay registros para mostrar.</p>
            ) : (
              todos.map((a) => <CreditAccountRow key={a.key} account={a} onOpen={() => setOpenKey(a.key)} />)
            )}
          </div>
        </Modal>
      )}

      {abierta && <CreditAccountSheet account={abierta} onClose={() => setOpenKey(null)} />}
    </div>
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CreditGroupPanel label="Cuentas por Cobrar" icon={<CxCIcon />} isCxC accounts={cxc} total={totalPorCobrar} />
        <CreditGroupPanel label="Cuentas por Pagar" icon={<CxPIcon />} isCxC={false} accounts={cxp} total={totalPorPagar} />
      </div>

      <SummarySplitCard porCobrar={totalPorCobrar} porPagar={totalPorPagar} diferencia={totalPorCobrar - totalPorPagar} />
    </div>
  )
}

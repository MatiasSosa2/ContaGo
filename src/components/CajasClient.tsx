'use client'

import { useMemo, useState } from 'react'

interface CajasAccountItem {
  id: string
  name: string
  type: string
  currency: string
  currentBalance: number
  recentMovements: number
  todayVariation: number
}

interface CajasGroupData {
  accounts: CajasAccountItem[]
  total: number
  todayVariation: number
}

interface CajasData {
  efectivo: CajasGroupData
  virtual: CajasGroupData
  summaryMessage: string
  aiTipEfectivo: string
  aiTipVirtual: string
}

interface CajasMovementItem {
  id: string
  description: string
  amount: number
  currency: string
  date: string | Date
  type: string
  category: { name: string } | null
  account: { name: string; type: string } | null
}

const CURRENCY_SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$' }
const CAJA_CURRENCIES = ['ARS', 'USD'] as const

type CajaCurrency = typeof CAJA_CURRENCIES[number]

function fmtMoney(v: number, currency = 'ARS') {
  const sym = CURRENCY_SYMBOL[currency] || '$'
  return `${sym}${Math.abs(v).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`
}

function getCurrencyLabel(currency: CajaCurrency) {
  return currency === 'ARS' ? 'Pesos argentinos' : 'USD'
}

function fmtDate(value: string | Date) {
  return new Date(value).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function isCashMovement(movement: CajasMovementItem) {
  return movement.account?.type === 'CASH'
}

// ── Ícono Efectivo ──
function CashIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  )
}

// ── Ícono Virtual ──
function VirtualIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  )
}

function MovementIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 17.25V6.75A2.25 2.25 0 0 1 5.25 4.5h13.5A2.25 2.25 0 0 1 21 6.75v10.5A2.25 2.25 0 0 1 18.75 19.5H5.25A2.25 2.25 0 0 1 3 17.25Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 12h9m-9 3h5.25m-5.25-6h3" />
    </svg>
  )
}

function CajaDetailsModal({
  label,
  currency,
  accounts,
  total,
  onClose,
}: {
  label: string
  currency: string
  accounts: CajasAccountItem[]
  total: number
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar modal"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-[#141414]">
        <div className="flex items-start justify-between border-b border-stone-200 px-5 py-4 dark:border-white/10">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Detalle de cajas</p>
            <h3 className="mt-1 text-lg font-semibold text-[#1F2937] dark:text-[#E8E8E8]">{label}</h3>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              {currency === 'ARS' ? 'Pesos argentinos (ARS)' : currency === 'USD' ? 'Dólares (USD)' : currency}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-white/5 dark:hover:text-stone-200"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto px-4 py-4">
          {accounts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 px-4 py-6 text-center dark:border-white/10">
              <p className="text-sm text-stone-500 dark:text-stone-400">No hay cajas disponibles para esta moneda.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between rounded-xl border border-stone-200 px-3.5 py-3 dark:border-white/10"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#1F2937] dark:text-[#E8E8E8]">{acc.name}</p>
                    <p className="mt-0.5 text-xs text-stone-400">
                      {acc.recentMovements > 0
                        ? `${acc.recentMovements} movimiento${acc.recentMovements !== 1 ? 's' : ''} esta semana`
                        : 'Sin movimientos recientes'}
                    </p>
                  </div>
                  <p className="ml-3 shrink-0 text-sm font-mono font-semibold text-[#1F2937] dark:text-[#E8E8E8] num-tabular">
                    {fmtMoney(acc.currentBalance, acc.currency)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-stone-200 bg-stone-50 px-5 py-4 dark:border-white/10 dark:bg-[#101010]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-stone-500 dark:text-stone-400">Total</span>
            <span className="text-sm font-mono font-bold text-[#1F2937] dark:text-[#E8E8E8] num-tabular">
              {fmtMoney(total, currency)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function MovementsPanel({
  movements,
}: {
  movements: CajasMovementItem[]
}) {
  const [activeFilter, setActiveFilter] = useState<'CASH' | 'VIRTUAL'>('CASH')
  const [movementTypeFilter, setMovementTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [dateFilter, setDateFilter] = useState('')

  const cajaMovements = useMemo(
    () => movements.filter((movement) => (
      activeFilter === 'CASH' ? isCashMovement(movement) : !isCashMovement(movement)
    )),
    [activeFilter, movements],
  )

  const categories = useMemo(
    () => [...new Set(cajaMovements.map((movement) => movement.category?.name).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)),
    [cajaMovements],
  )

  const filteredMovements = useMemo(
    () => cajaMovements.filter((movement) => {
      if (movementTypeFilter !== 'ALL' && movement.type !== movementTypeFilter) {
        return false
      }

      if (categoryFilter !== 'ALL' && movement.category?.name !== categoryFilter) {
        return false
      }

      if (dateFilter) {
        const movementDate = new Date(movement.date).toISOString().slice(0, 10)
        if (movementDate !== dateFilter) {
          return false
        }
      }

      return true
    }),
    [cajaMovements, categoryFilter, dateFilter, movementTypeFilter],
  )

  return (
    <div className="rounded-2xl bg-white dark:bg-[#141414]" style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.05)' }}>
      <div className="border-b border-[#D8E2D6] bg-[#F3F6F4] px-5 pt-5 pb-4 dark:border-white/10 dark:bg-[#111513]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D5E3D8] bg-white text-brand-military dark:border-[#294235] dark:bg-[#162019] dark:text-[#9AC7A8]">
              <MovementIcon />
            </div>
            <h3 className="text-base font-semibold text-[#1F2937] dark:text-[#E8E8E8]">Movimientos</h3>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2">
            <button
              type="button"
              onClick={() => setActiveFilter('CASH')}
              className={`flex h-[44px] min-w-[160px] items-center justify-center overflow-hidden rounded-xl border px-5 text-sm font-semibold uppercase tracking-[0.12em] leading-none transition ${
                activeFilter === 'CASH'
                  ? 'border-[#1B4332] bg-[#1B4332] text-white shadow-sm'
                  : 'border-[#D8E2D6] bg-[#F0F4EF] text-[#1B4332]'
              }`}
              title="Caja Efectivo"
            >
              Efectivo
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('VIRTUAL')}
              className={`flex h-[44px] min-w-[160px] items-center justify-center overflow-hidden rounded-xl border px-5 text-sm font-semibold uppercase tracking-[0.12em] leading-none transition ${
                activeFilter === 'VIRTUAL'
                  ? 'border-[#B7791F] bg-[#B7791F] text-white shadow-sm'
                  : 'border-[#E8DFC6] bg-[#FBF8F2] text-[#8A6118]'
              }`}
              title="Caja Virtual"
            >
              Virtual
            </button>
          </div>
        </div>
      </div>

      <div className="border-b border-[#E5E7EB] bg-[#FCFCFD] px-5 py-4 dark:border-white/10 dark:bg-[#101113]">
        <div className="flex flex-wrap items-end justify-start gap-3">
          <div className="min-w-[200px]">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400">
              Categoria
            </label>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-stone-700 outline-none transition focus:border-brand-military dark:border-white/10 dark:bg-[#16181b] dark:text-stone-200"
            >
              <option value="ALL">Todas</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400">
              Tipo
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setMovementTypeFilter('ALL')}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  movementTypeFilter === 'ALL'
                    ? 'border-stone-900 bg-stone-900 text-white dark:border-stone-200 dark:bg-stone-200 dark:text-stone-900'
                    : 'border-[#E5E7EB] bg-white text-stone-600 dark:border-white/10 dark:bg-[#16181b] dark:text-stone-300'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setMovementTypeFilter('INCOME')}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  movementTypeFilter === 'INCOME'
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400'
                }`}
              >
                Ingreso
              </button>
              <button
                type="button"
                onClick={() => setMovementTypeFilter('EXPENSE')}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  movementTypeFilter === 'EXPENSE'
                    ? 'border-red-600 bg-red-600 text-white'
                    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400'
                }`}
              >
                Egreso
              </button>
            </div>
          </div>

          <div className="min-w-[180px]">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400">
              Fecha
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-stone-700 outline-none transition focus:border-brand-military dark:border-white/10 dark:bg-[#16181b] dark:text-stone-200"
              />
              {dateFilter ? (
                <button
                  type="button"
                  onClick={() => setDateFilter('')}
                  className="shrink-0 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500 transition hover:border-brand-military hover:text-brand-military dark:border-white/10 dark:bg-[#16181b] dark:text-stone-300"
                >
                  Limpiar
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="px-0 py-4">
        {filteredMovements.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium text-stone-500 dark:text-stone-400">No hay movimientos en este grupo.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-xs">
              <thead>
                <tr className="border-y border-[#D8E2D6] bg-[#F6F8F7] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B7280] dark:border-white/10 dark:bg-[#0D0D0D] dark:text-stone-400">
                  <th className="px-5 py-3 text-left">Fecha</th>
                  <th className="px-5 py-3 text-left">Movimiento</th>
                  <th className="px-5 py-3 text-left">Categoria</th>
                  <th className="px-5 py-3 text-left">Caja</th>
                  <th className="px-5 py-3 text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((movement) => {
                  const isIncome = movement.type === 'INCOME'

                  return (
                    <tr
                      key={movement.id}
                      className={`border-b border-[#E5E7EB] transition hover:bg-[#FAFBFA] dark:border-white/5 dark:hover:bg-white/[0.03] ${
                        isIncome ? 'border-l-[3px] border-l-[#2D6A4F]' : 'border-l-[3px] border-l-[#B45309]'
                      }`}
                    >
                      <td className="px-5 py-3 align-top">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-[#4B5563] dark:text-stone-300">{fmtDate(movement.date)}</span>
                          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF]">
                            {isIncome ? 'Ingreso' : 'Egreso'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 align-top">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#1F2937] dark:text-[#E8E8E8]">{movement.description}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3 align-top text-sm text-stone-600 dark:text-stone-300">
                        <span className="inline-flex rounded-md border border-[#D8E2D6] bg-[#F8FAF8] px-2.5 py-1 text-[11px] font-semibold text-[#3A4D39] dark:border-white/10 dark:bg-white/[0.03] dark:text-stone-300">
                          {movement.category?.name ?? 'Sin categoria'}
                        </span>
                      </td>
                      <td className="px-5 py-3 align-top text-sm text-stone-600 dark:text-stone-300">
                        <span className="inline-flex rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-semibold text-stone-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-stone-300">
                          {movement.account?.name ?? 'Sin cuenta'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right align-top">
                        <span className={`text-sm font-mono font-bold num-tabular ${
                          isIncome ? 'text-[#2D6A4F] dark:text-[#8FD0A7]' : 'text-[#B45309] dark:text-[#F2B272]'
                        }`}>
                          {isIncome ? '+' : '-'}{fmtMoney(movement.amount, movement.currency)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Columna de grupo (Efectivo o Virtual) ──
function CajaGroupColumn({
  label,
  icon,
  group,
  variant = 'military',
}: {
  label: string
  icon: React.ReactNode
  group: CajasGroupData
  variant?: 'military' | 'gold'
}) {
  const availableCurrencies = new Set(group.accounts.map((a) => a.currency))
  const defaultCurrency: CajaCurrency = availableCurrencies.has('ARS') ? 'ARS' : 'USD'
  const [selectedCurrency, setSelectedCurrency] = useState<CajaCurrency>(defaultCurrency)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const filtered = group.accounts.filter(a => a.currency === selectedCurrency)
  const filteredTotal = filtered.reduce((s, a) => s + a.currentBalance, 0)
  const isEfectivo = label === 'Efectivo'
  const detailTitle = isEfectivo
    ? 'Caja principal en uso'
    : `${filtered.length} caja${filtered.length !== 1 ? 's' : ''} en ${selectedCurrency}`
  const detailCopy = isEfectivo
    ? 'El efectivo se administra como una unica caja operativa.'
    : 'Abri el detalle para ver el desglose de bancos, billeteras o cajas virtuales.'
  const tone = variant === 'gold'
    ? {
        card: 'border-[#D9C7A1] bg-[#FFFDF9] dark:border-[#5B4A2F] dark:bg-[#17130D]',
        header: 'bg-[#F6EFE2] border-[#D9C7A1] dark:bg-[#1E170F] dark:border-[#5B4A2F]',
        iconWrap: 'bg-[#EEDCB8] text-[#8A6118] dark:bg-[#3B2E1A] dark:text-[#D7B36B]',
        selectorWrap: 'border-[#E6D6B8] bg-[#FFF8EC] dark:border-[#5B4A2F] dark:bg-[#21180F]',
        selectorActive: 'bg-white text-[#5C4315] shadow-sm dark:bg-[#2A2014] dark:text-[#F2D59B]',
        selectorIdle: 'text-[#8A6118] hover:text-[#5C4315] dark:text-[#CBA86B] dark:hover:text-[#F2D59B]',
        button: 'border-[#D9C7A1] bg-white text-[#8A6118] hover:border-[#B88A2E] hover:text-[#6E4E14] dark:border-[#5B4A2F] dark:bg-[#221A10] dark:text-[#D7B36B]',
        summary: 'border-[#E6D6B8] bg-[#FFF8EC] dark:border-[#5B4A2F] dark:bg-[#1E170F]',
      }
    : {
        card: 'border-[#C9D8CC] bg-[#FBFDFC] dark:border-[#294235] dark:bg-[#101612]',
      header: 'bg-[#E8F0EB] border-[#C9D8CC] dark:bg-[#162019] dark:border-[#294235]',
        iconWrap: 'bg-[#D7E7DC] text-[#2D5A41] dark:bg-[#1F3428] dark:text-[#9AC7A8]',
        selectorWrap: 'border-[#D5E3D8] bg-[#F5FAF7] dark:border-[#294235] dark:bg-[#131C16]',
        selectorActive: 'bg-white text-[#1F4D36] shadow-sm dark:bg-[#1A261E] dark:text-[#D7F3DF]',
        selectorIdle: 'text-[#4D6E59] hover:text-[#1F4D36] dark:text-[#8CB299] dark:hover:text-[#D7F3DF]',
        button: 'border-[#C9D8CC] bg-white text-[#2D5A41] hover:border-[#2D6A4F] hover:text-[#1F4D36] dark:border-[#294235] dark:bg-[#152019] dark:text-[#9AC7A8]',
        summary: 'border-[#D5E3D8] bg-[#F5FAF7] dark:border-[#294235] dark:bg-[#131C16]',
      }

  return (
    <>
    <div className="flex h-full flex-col gap-5">
      {/* Card principal */}
      <div className={`flex h-full flex-col rounded-2xl border overflow-hidden ${tone.card}`} style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.05)' }}>

        {/* Header + monto total */}
        <div className={`px-5 pt-5 pb-4 border-b ${tone.header}`}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tone.iconWrap}`}>
              {icon}
            </div>
            <h2 className="text-base font-semibold text-[#1F2937] dark:text-[#E8E8E8]">{label}</h2>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-3xl md:text-[32px] font-mono font-bold text-[#1F2937] dark:text-[#E8E8E8] num-tabular leading-none">
              {CURRENCY_SYMBOL[selectedCurrency]}{filteredTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
            </p>
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className={`shrink-0 rounded-xl border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${tone.button}`}
            >
              {isEfectivo ? 'Ver caja' : 'Ver detalles de cajas'}
            </button>
          </div>
          <div className={`mt-3 inline-flex w-full items-center gap-1 rounded-xl border p-1 ${tone.selectorWrap}`}>
            {CAJA_CURRENCIES.map((currency) => {
              const isActive = selectedCurrency === currency
              const isAvailable = availableCurrencies.has(currency)

              return (
                <button
                  key={currency}
                  type="button"
                  onClick={() => setSelectedCurrency(currency)}
                  className={`flex-1 rounded-lg px-3 py-2 text-[11px] font-semibold transition ${
                    isActive ? tone.selectorActive : tone.selectorIdle
                  } ${!isAvailable ? 'opacity-55' : ''}`}
                >
                  {getCurrencyLabel(currency)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Lista de sub-cajas */}
        <div className="flex flex-1 px-4 pb-4">
          <div className={`flex w-full flex-col justify-between rounded-xl border border-dashed px-4 py-4 ${tone.summary}`}>
            <p className="text-sm font-medium text-[#1F2937] dark:text-[#E8E8E8]">
              {detailTitle}
            </p>
            <p className="mt-1 text-xs text-[#9CA3AF]">
              {detailCopy}
            </p>
          </div>
        </div>

      </div>
    </div>
    {detailsOpen ? (
      <CajaDetailsModal
        label={label}
        currency={selectedCurrency}
        accounts={filtered}
        total={filteredTotal}
        onClose={() => setDetailsOpen(false)}
      />
    ) : null}
    </>
  )
}

// ── Componente principal ──
export default function CajasClient({ data, movements }: { data: CajasData; movements: CajasMovementItem[] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CajaGroupColumn
          label="Efectivo"
          icon={<CashIcon />}
          group={data.efectivo}
          variant="military"
        />
        <CajaGroupColumn
          label="Virtual"
          icon={<VirtualIcon />}
          group={data.virtual}
          variant="gold"
        />
      </div>

      <MovementsPanel movements={movements} />
    </div>
  )
}

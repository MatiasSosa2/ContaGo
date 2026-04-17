'use client'

import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'

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
  subType?: string | null
  esCredito?: boolean
  estado?: string
  category: { name: string } | null
  account: { name: string; type: string } | null
  contact?: { name: string } | null
}

const CURRENCY_SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$' }
const CAJA_CURRENCIES = ['ARS', 'USD'] as const

type CajaCurrency = typeof CAJA_CURRENCIES[number]
type ChartPeriod = 'diario' | 'semanal' | 'mensual'
type OriginKey = 'efectivo' | 'virtual' | 'credito' | 'deuda'
const PAGE_SIZE = 20

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

// ── Helpers ────────────────────────────────────────────────────────────────
function getSubTypeLabel(subType: string | null | undefined): string {
  if (!subType) return '—'
  const map: Record<string, string> = {
    SALE: 'Venta',
    COBRO: 'Otros Ingresos',
    PURCHASE: 'Compra',
    PAGO: 'Otros Egresos',
  }
  return map[subType] ?? subType
}

function getOrigin(mov: CajasMovementItem): OriginKey {
  const esCredito = mov.esCredito ?? false
  if (esCredito && mov.type === 'INCOME') return 'credito'
  if (esCredito && mov.type === 'EXPENSE') return 'deuda'
  if (mov.account?.type === 'CASH') return 'efectivo'
  return 'virtual'
}

function buildChartData(movements: CajasMovementItem[], period: ChartPeriod) {
  const now = new Date()
  const cutoff = new Date()
  if (period === 'diario') cutoff.setDate(now.getDate() - 30)
  else if (period === 'semanal') cutoff.setDate(now.getDate() - 84)
  else cutoff.setMonth(now.getMonth() - 11)

  const sorted = [...movements]
    .filter(m => new Date(m.date) >= cutoff)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const groups = new Map<string, { label: string; ingresos: number; egresos: number }>()

  for (const mov of sorted) {
    const d = new Date(mov.date)
    let key: string
    let label: string

    if (period === 'diario') {
      key = d.toISOString().slice(0, 10)
      label = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
    } else if (period === 'semanal') {
      const sw = new Date(d)
      sw.setDate(d.getDate() - d.getDay())
      key = sw.toISOString().slice(0, 10)
      label = sw.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      label = d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
    }

    if (!groups.has(key)) groups.set(key, { label, ingresos: 0, egresos: 0 })
    const g = groups.get(key)!
    if (mov.type === 'INCOME') g.ingresos += mov.amount
    else g.egresos += mov.amount
  }

  let runSaldo = 0
  return [...groups.values()].map(e => {
    runSaldo += e.ingresos - e.egresos
    return { label: e.label, ingresos: Math.round(e.ingresos), egresos: Math.round(e.egresos), saldo: Math.round(runSaldo) }
  })
}

// ── Icons ──────────────────────────────────────────────────────────────────
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

function ChartIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
    </svg>
  )
}

// ── Estado Badge ────────────────────────────────────────────────────────────
function EstadoBadge({ type, esCredito }: { type: string; esCredito: boolean }) {
  if (type === 'INCOME' && !esCredito)
    return <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Ingreso</span>
  if (type === 'EXPENSE' && !esCredito)
    return <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">Egreso</span>
  if (type === 'INCOME' && esCredito)
    return <span className="inline-flex rounded-full border border-emerald-700 bg-emerald-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">A cobrar</span>
  return <span className="inline-flex rounded-full border border-red-700 bg-red-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">A pagar</span>
}

// ── Historial Modal ─────────────────────────────────────────────────────────
function HistorialModal({ movements, onClose }: { movements: CajasMovementItem[]; onClose: () => void }) {
  const [period, setPeriod] = useState<ChartPeriod>('mensual')
  const chartData = useMemo(() => buildChartData(movements, period), [movements, period])

  const fmtAxis = (v: number) => {
    const abs = Math.abs(v)
    if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}K`
    return String(v)
  }

  const totalIng = chartData.reduce((s, d) => s + d.ingresos, 0)
  const totalEgr = chartData.reduce((s, d) => s + d.egresos, 0)
  const net = totalIng - totalEgr

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#141414]">
        <div className="flex items-center justify-between border-b border-[#ECE7E1] bg-[#FAFBFC] px-5 py-4 dark:border-white/10 dark:bg-[#171717]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Análisis financiero</p>
            <h3 className="mt-0.5 text-base font-semibold text-[#1F2937] dark:text-[#E8E8E8]">Historial de Caja</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex overflow-hidden rounded-lg border border-stone-200 bg-stone-100 p-0.5 dark:border-white/10 dark:bg-[#1F1F1F]">
              {(['diario', 'semanal', 'mensual'] as ChartPeriod[]).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
                    period === p ? 'bg-brand-military text-white shadow-sm' : 'text-stone-500 hover:text-stone-700 dark:text-stone-400'
                  }`}
                >
                  {p === 'diario' ? 'Diario' : p === 'semanal' ? 'Semanal' : 'Mensual'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-stone-200 bg-white p-2 text-stone-400 transition hover:text-stone-700 dark:border-white/10 dark:bg-[#1B1B1B] dark:hover:text-stone-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5">
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-stone-400">Sin datos para este período</div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip
                    formatter={(value, name) => {
                      const labels: Record<string, string> = { ingresos: 'Ingresos', egresos: 'Egresos', saldo: 'Saldo acumulado' }
                      return [`$${Math.abs(Number(value)).toLocaleString('es-AR')}`, labels[String(name)] ?? String(name)]
                    }}
                    contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #E5E7EB', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                  />
                  <Legend formatter={(value) => {
                    const m: Record<string, string> = { ingresos: 'Ingresos', egresos: 'Egresos', saldo: 'Saldo' }
                    return <span style={{ fontSize: 11, color: '#6B7280' }}>{m[String(value)] ?? String(value)}</span>
                  }} />
                  <Bar dataKey="ingresos" fill="#3A4D39" opacity={0.8} radius={[2, 2, 0, 0] as [number, number, number, number]} />
                  <Bar dataKey="egresos" fill="#A65D57" opacity={0.8} radius={[2, 2, 0, 0] as [number, number, number, number]} />
                  <Line type="monotone" dataKey="saldo" stroke="#C5A065" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#C5A065' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 divide-x divide-[#E5E7EB] border-t border-[#ECE7E1] dark:divide-white/10 dark:border-white/10">
          <div className="px-5 py-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Ingresos</p>
            <p className="mt-1 font-mono text-sm font-bold text-[#3A4D39]">${totalIng.toLocaleString('es-AR')}</p>
          </div>
          <div className="px-5 py-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Egresos</p>
            <p className="mt-1 font-mono text-sm font-bold text-[#A65D57]">${totalEgr.toLocaleString('es-AR')}</p>
          </div>
          <div className="px-5 py-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Neto</p>
            <p className={`mt-1 font-mono text-sm font-bold ${net >= 0 ? 'text-[#3A4D39]' : 'text-[#A65D57]'}`}>
              {net < 0 ? '− ' : ''}${Math.abs(net).toLocaleString('es-AR')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Historial Card ──────────────────────────────────────────────────────────
function HistorialCard({ movements }: { movements: CajasMovementItem[] }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#141414]">
        <div className="border-b border-[#ECE7E1] bg-[#FAFBFC] px-5 pb-4 pt-5 dark:border-white/10 dark:bg-[#171717]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center bg-brand-gold-light text-brand-gold-dark dark:bg-[#3B2E1A] dark:text-[#D7B36B]">
              <ChartIcon />
            </div>
            <h2 className="text-base font-semibold text-[#1F2937] dark:text-[#E8E8E8]">Historial</h2>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-8">
          <p className="text-[11px] text-center font-medium uppercase tracking-[0.12em] text-stone-400">
            Evolución del saldo · Ingresos vs Egresos
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="border border-brand-gold bg-brand-gold-light px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-gold-dark transition hover:bg-brand-gold hover:text-white dark:border-[#5B4A2F] dark:bg-[#221A10] dark:text-[#D7B36B] dark:hover:bg-[#7A5821] dark:hover:text-white"
          >
            Ver gráfico / Historial
          </button>
        </div>
      </div>

      {open && <HistorialModal movements={movements} onClose={() => setOpen(false)} />}
    </>
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
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#141414] dark:shadow-[0_24px_80px_rgba(0,0,0,0.42)]">
        <div className="flex items-start justify-between border-b border-[#ECE7E1] bg-[#FAFBFC] px-5 py-4 dark:border-white/10 dark:bg-[#171717]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Subcajas</p>
            <h3 className="mt-1 text-lg font-semibold text-[#1F2937] dark:text-[#E8E8E8]">{label}</h3>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              {currency === 'ARS' ? 'Pesos argentinos (ARS)' : currency === 'USD' ? 'Dólares (USD)' : currency}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-stone-200 bg-white p-2 text-stone-400 transition hover:text-stone-700 dark:border-white/10 dark:bg-[#1B1B1B] dark:hover:text-stone-200"
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
                  className="flex items-center justify-between rounded-xl border border-[#ECE7E1] px-3.5 py-3 dark:border-white/10"
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

        <div className="border-t border-[#ECE7E1] bg-[#FAFBFC] px-5 py-4 dark:border-white/10 dark:bg-[#171717]">
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

function MovementsPanel({ movements }: { movements: CajasMovementItem[] }) {
  const [origins, setOrigins] = useState<Set<OriginKey>>(new Set())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const toggleOrigin = (o: OriginKey) => {
    setOrigins(prev => {
      const next = new Set(prev)
      if (next.has(o)) next.delete(o)
      else next.add(o)
      return next
    })
    setPage(1)
  }

  const filtered = useMemo(() => {
    return movements.filter(mov => {
      if (origins.size > 0 && !origins.has(getOrigin(mov))) return false
      if (dateFrom) {
        const d = new Date(mov.date).toISOString().slice(0, 10)
        if (d < dateFrom) return false
      }
      if (dateTo) {
        const d = new Date(mov.date).toISOString().slice(0, 10)
        if (d > dateTo) return false
      }
      return true
    })
  }, [movements, origins, dateFrom, dateTo])

  const paginated = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page])
  const hasMore = paginated.length < filtered.length

  const originOptions: { key: OriginKey; label: string; active: string; idle: string }[] = [
    {
      key: 'efectivo',
      label: 'Efectivo',
      active: 'border-brand-military bg-brand-military text-white',
      idle: 'border-[#D5E3D8] bg-[#F5FAF7] text-[#2D5A41] dark:border-[#294235] dark:bg-[#162019] dark:text-[#9AC7A8]',
    },
    {
      key: 'virtual',
      label: 'Virtual',
      active: 'border-brand-gold bg-brand-gold text-white',
      idle: 'border-[#E6D6B8] bg-[#FFF8EC] text-[#8A6118] dark:border-[#5B4A2F] dark:bg-[#21180F] dark:text-[#D7B36B]',
    },
    {
      key: 'credito',
      label: 'Créditos',
      active: 'border-emerald-600 bg-emerald-600 text-white',
      idle: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400',
    },
    {
      key: 'deuda',
      label: 'Deudas',
      active: 'border-brand-oxide bg-brand-oxide text-white',
      idle: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400',
    },
  ]

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
      <div className="border-b border-[#ECE7E1] bg-[#FAFBFC] px-5 pb-4 pt-5 dark:border-white/10 dark:bg-[#171717]">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center bg-brand-military-light text-brand-military dark:bg-[#162019] dark:text-[#9AC7A8]">
            <MovementIcon />
          </div>
          <h3 className="text-base font-semibold text-[#1F2937] dark:text-[#E8E8E8]">Movimientos</h3>
          {filtered.length > 0 && (
            <span className="ml-auto text-[11px] font-semibold text-stone-400">{filtered.length} registros</span>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400">Origen</p>
            <div className="flex flex-wrap gap-2">
              {originOptions.map(({ key, label, active, idle }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleOrigin(key)}
                  className={`h-[36px] border px-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${origins.has(key) ? active : idle}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400">Fecha</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(1) }}
                className="border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-stone-700 outline-none transition focus:border-brand-military dark:border-white/10 dark:bg-[#16181b] dark:text-stone-200"
              />
              <span className="text-xs text-stone-400">—</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(1) }}
                className="border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-stone-700 outline-none transition focus:border-brand-military dark:border-white/10 dark:bg-[#16181b] dark:text-stone-200"
              />
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }}
                  className="border border-[#E5E7EB] bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500 transition hover:border-brand-military hover:text-brand-military dark:border-white/10 dark:bg-[#16181b] dark:text-stone-300"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        {paginated.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium text-stone-500 dark:text-stone-400">No hay movimientos que coincidan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-xs">
              <thead>
                <tr className="border-y border-[#ECE7E1] bg-[#FAFBFC] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B7280] dark:border-white/10 dark:bg-[#171717] dark:text-stone-400">
                  <th className="px-5 py-3 text-left">Fecha</th>
                  <th className="px-5 py-3 text-left">Tipo / Categoría</th>
                  <th className="px-5 py-3 text-left">Estado</th>
                  <th className="px-5 py-3 text-left">Caja</th>
                  <th className="px-5 py-3 text-left">Cliente / Proveedor</th>
                  <th className="px-5 py-3 text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(mov => {
                  const isIncome = mov.type === 'INCOME'
                  const esCredito = mov.esCredito ?? false

                  return (
                    <tr
                      key={mov.id}
                      className={`border-b border-[#ECE7E1] transition hover:bg-[#FAFBFA] dark:border-white/5 dark:hover:bg-white/[0.03] ${
                        isIncome ? 'border-l-[3px] border-l-[#3A4D39]' : 'border-l-[3px] border-l-[#A65D57]'
                      }`}
                    >
                      <td className="px-5 py-3 align-middle whitespace-nowrap">
                        <span className="text-sm font-medium text-[#4B5563] dark:text-stone-300">{fmtDate(mov.date)}</span>
                      </td>

                      <td className="px-5 py-3 align-middle">
                        <p className="text-sm font-semibold text-[#1F2937] dark:text-[#E8E8E8]">{getSubTypeLabel(mov.subType)}</p>
                        {mov.category && (
                          <p className="mt-0.5 text-[11px] text-stone-400">{mov.category.name}</p>
                        )}
                      </td>

                      <td className="px-5 py-3 align-middle">
                        <EstadoBadge type={mov.type} esCredito={esCredito} />
                      </td>

                      <td className="px-5 py-3 align-middle">
                        {esCredito ? (
                          <span className="text-sm text-stone-400">N/A</span>
                        ) : (
                          <span className="inline-flex border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-semibold text-stone-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-stone-300">
                            {mov.account?.type === 'CASH' ? 'Efectivo' : 'Virtual'}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3 align-middle">
                        {mov.contact?.name
                          ? <span className="text-sm text-stone-600 dark:text-stone-300">{mov.contact.name}</span>
                          : <span className="text-sm text-stone-400">—</span>
                        }
                      </td>

                      <td className="px-5 py-3 text-right align-middle whitespace-nowrap">
                        <span className={`text-sm font-mono font-bold num-tabular ${
                          isIncome ? 'text-[#2D6A4F] dark:text-[#8FD0A7]' : 'text-[#A65D57] dark:text-[#E08580]'
                        }`}>
                          {isIncome ? '+' : '−'}{fmtMoney(mov.amount, mov.currency)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="border-t border-[#ECE7E1] px-5 py-4 flex items-center justify-between dark:border-white/10">
            <p className="text-[11px] text-stone-400">
              {Math.min(paginated.length, filtered.length)} de {filtered.length} movimientos
            </p>
            {hasMore && (
              <button
                type="button"
                onClick={() => setPage(p => p + 1)}
                className="border border-[#E5E7EB] bg-white px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-600 transition hover:border-brand-military hover:text-brand-military dark:border-white/10 dark:bg-[#16181b] dark:text-stone-300"
              >
                Ver más ({filtered.length - paginated.length} restantes)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Columna de grupo (Efectivo o Virtual) ──

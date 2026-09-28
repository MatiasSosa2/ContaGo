'use client'

import { useMemo, useState } from 'react'
import type { PeriodKey } from '@/components/PeriodSelector'
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
  ReferenceLine,
} from 'recharts'

// ── Paleta del gráfico Historial ──────────────────────────────────────────
const CHART_COLORS = {
  ing: '#3A4D39',
  ingSoft: '#9AC7A8',
  egr: '#A65D57',
  egrSoft: '#F2B272',
  saldo: '#C5A065',
  saldoSoft: 'rgba(197,160,101,0.18)',
} as const

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
  subcategory?: { name: string } | null
  account: { name: string; type: string } | null
  contact?: { name: string } | null
  /** Pata de un cambio de caja (sale de una caja / entra en otra) */
  isTransfer?: boolean
  /** "Caja chica → Banco", para mostrar en la lista */
  transferLabel?: string
  /** Parte de una venta con varios productos / pago dividido */
  operacionId?: string | null
  operacion?: { total: number; descuento: number; items: { cantidad: number; producto: { nombre: string } }[] } | null
  cuotaNumero?: number | null
  cuotasTotal?: number | null
}

/** Fila de la lista: un movimiento suelto o una operación con sus partes de pago */
type MovementRow = CajasMovementItem & { parts?: CajasMovementItem[] }

function groupByOperacion(movements: CajasMovementItem[]): MovementRow[] {
  const rows: MovementRow[] = []
  const byOp = new Map<string, MovementRow>()
  for (const mov of movements) {
    if (!mov.operacionId || !mov.operacion) { rows.push(mov); continue }
    const row = byOp.get(mov.operacionId)
    if (row) { row.parts!.push(mov); continue }
    const nueva: MovementRow = { ...mov, id: mov.operacionId, amount: mov.operacion.total, parts: [mov] }
    byOp.set(mov.operacionId, nueva)
    rows.push(nueva)
  }
  return rows
}

/** "Efectivo · Caja Chica $10.000" / "Crédito · 3 cuotas $19.800" */
function describeParts(parts: CajasMovementItem[]) {
  const lines: { label: string; amount: number; currency: string }[] = []
  const credit = parts.filter((p) => p.esCredito)
  for (const p of parts.filter((x) => !x.esCredito)) {
    lines.push({ label: `${p.account?.type === 'CASH' ? 'Efectivo' : 'Virtual'} · ${p.account?.name ?? ''}`, amount: p.amount, currency: p.currency })
  }
  if (credit.length > 0) {
    lines.push({
      label: `Crédito · ${credit.length} cuota${credit.length > 1 ? 's' : ''}`,
      amount: credit.reduce((s, p) => s + p.amount, 0),
      currency: credit[0].currency,
    })
  }
  return lines
}

export type CashFlowSummary = {
  currency: string
  saldoInicial: number
  ingresos: number
  egresos: number
  cambioMoneda: number
  saldoFinal: number
}

type CashFlowByCurrency = { ARS: CashFlowSummary; USD: CashFlowSummary }

const CURRENCY_SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$' }
const CAJA_CURRENCIES = ['ARS', 'USD'] as const

type CajaCurrency = typeof CAJA_CURRENCIES[number]
type ChartPeriod = PeriodKey
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
    SALE_PRODUCT: 'Venta de productos',
    SALE_SERVICE: 'Venta de servicios',
    SALE_BIEN_USO: 'Venta de bien de uso',
    COBRO_CREDITO: 'Cobro de crédito',
    OTHER_INCOME: 'Otros Ingresos',
    PURCHASE_PRODUCT: 'Compra de productos',
    PURCHASE_SERVICE: 'Compra de servicios',
    PURCHASE_BIEN_USO: 'Compra de bien de uso',
    PAGO_DEUDA: 'Pago de deuda',
    DIFERENCIA_CAJA: 'Diferencia de caja',
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


// buildChartData: usa la granularidad del período seleccionado,
// pero el saldo parte del acumulado real (prePeriodBalance)
function buildChartData(
  movements: CajasMovementItem[],
  period: ChartPeriod,
  prePeriodBalance: number,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
  selectedDay?: string,
  selectedWeekStart?: string,
) {
  let rangeFrom: Date | undefined, rangeTo: Date | undefined
  let mode: 'hour' | 'day' | 'month' = 'day'
  const now = new Date()

  if (period === 'diario') {
    if (selectedDay) {
      rangeFrom = new Date(selectedDay + 'T00:00:00')
      rangeTo = new Date(selectedDay + 'T23:59:59.999')
    } else {
      rangeFrom = new Date(now); rangeFrom.setHours(0, 0, 0, 0)
      rangeTo = new Date(now); rangeTo.setHours(23, 59, 59, 999)
    }
    mode = 'hour'
  } else if (period === 'semanal') {
    if (selectedWeekStart) {
      rangeFrom = new Date(selectedWeekStart + 'T00:00:00')
      rangeTo = new Date(rangeFrom)
      rangeTo.setDate(rangeFrom.getDate() + 6)
      rangeTo.setHours(23, 59, 59, 999)
    }
    mode = 'day'
  } else if (period === 'mensual') {
    const y = selectedYear ?? now.getFullYear()
    const m = (selectedMonth ?? (now.getMonth() + 1)) - 1
    rangeFrom = new Date(y, m, 1, 0, 0, 0)
    rangeTo = new Date(y, m + 1, 0, 23, 59, 59, 999)
    mode = 'day'
  } else if (period === 'anual') {
    const y = selectedYear ?? now.getFullYear()
    rangeFrom = new Date(y, 0, 1, 0, 0, 0)
    rangeTo = new Date(y, 11, 31, 23, 59, 59, 999)
    mode = 'month'
  } else if (period === 'custom') {
    if (customFrom) rangeFrom = new Date(customFrom + 'T00:00:00')
    if (customTo) rangeTo = new Date(customTo + 'T23:59:59.999')
    if (rangeFrom && rangeTo) {
      const days = Math.ceil((rangeTo.getTime() - rangeFrom.getTime()) / 86_400_000)
      mode = days > 62 ? 'month' : 'day'
    }
  }

  if (!rangeFrom || !rangeTo) return []

  const sorted = [...movements]
    .filter(m => !m.esCredito)
    .filter(m => { const d = new Date(m.date); return d >= rangeFrom! && d <= rangeTo! })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  type Group = { label: string; ingresos: number; egresos: number; cambios: number; order: number }
  const groups = new Map<string, Group>()
  // Los cambios de caja mueven el saldo pero no son ingreso ni egreso
  const addMov = (g: Group, mov: CajasMovementItem) => {
    if (mov.isTransfer) g.cambios += mov.type === 'INCOME' ? mov.amount : -mov.amount
    else if (mov.type === 'INCOME') g.ingresos += mov.amount
    else g.egresos += mov.amount
  }

  if (mode === 'hour') {
    for (let h = 0; h < 24; h++) {
      groups.set(String(h), { label: `${h}:00`, ingresos: 0, egresos: 0, cambios: 0, order: h })
    }
    for (const mov of sorted) {
      const g = groups.get(String(new Date(mov.date).getHours()))
      if (g) addMov(g, mov)
    }
  } else if (mode === 'day') {
    const cursor = new Date(rangeFrom)
    let order = 0
    while (cursor <= rangeTo) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      groups.set(key, { label: `${cursor.getDate()}/${cursor.getMonth() + 1}`, ingresos: 0, egresos: 0, cambios: 0, order: order++ })
      cursor.setDate(cursor.getDate() + 1)
    }
    for (const mov of sorted) {
      const d = new Date(mov.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const g = groups.get(key)
      if (g) addMov(g, mov)
    }
  } else if (mode === 'month') {
    const startY = rangeFrom.getFullYear(), startM = rangeFrom.getMonth()
    const endY = rangeTo.getFullYear(), endM = rangeTo.getMonth()
    let cy = startY, cm = startM, order = 0
    while (cy < endY || (cy === endY && cm <= endM)) {
      const key = `${cy}-${String(cm + 1).padStart(2, '0')}`
      const lbl = new Date(cy, cm, 1).toLocaleDateString('es-AR', { month: 'short' })
      groups.set(key, { label: lbl, ingresos: 0, egresos: 0, cambios: 0, order: order++ })
      cm++; if (cm > 11) { cm = 0; cy++ }
    }
    for (const mov of sorted) {
      const d = new Date(mov.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const g = groups.get(key)
      if (g) addMov(g, mov)
    }
  }

  // El saldo arranca desde el acumulado real antes del período
  let runSaldo = prePeriodBalance
  return [...groups.values()].sort((a, b) => a.order - b.order).map(e => {
    runSaldo += e.ingresos - e.egresos + e.cambios
    return { label: e.label, ingresos: Math.round(e.ingresos), egresos: Math.round(e.egresos), cambios: Math.round(e.cambios), saldo: Math.round(runSaldo) }
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

// Recuadro del gráfico: ingresos, egresos, cambio de moneda (solo si hubo) y saldo
type HistorialPoint = { label: string; ingresos: number; egresos: number; cambios: number; saldo: number }
function HistorialTooltip({ active, payload, fmt }: { active?: boolean; payload?: readonly { payload?: HistorialPoint }[]; fmt: (v: number) => string }) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  const rows: [string, number, string][] = [
    ['Ingresos', point.ingresos, CHART_COLORS.ing],
    ['Egresos', point.egresos, CHART_COLORS.egr],
    ...(point.cambios !== 0 ? [['Cambio de moneda', point.cambios, '#71717A'] as [string, number, string]] : []),
    ['Saldo', point.saldo, CHART_COLORS.saldo],
  ]
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[11px] shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-[#1C1C1E]">
      <p className="mb-1 text-stone-500 dark:text-stone-400">{point.label}</p>
      {rows.map(([name, value, color]) => (
        <p key={name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            {name}
          </span>
          <span className="font-mono font-semibold text-[#1F2937] tabular-nums dark:text-[#E8E8E8]">{name === 'Cambio de moneda' && value > 0 ? '+' : ''}{fmt(value)}</span>
        </p>
      ))}
    </div>
  )
}

// ── Historial ───────────────────────────────────────────────────────────────
// Los saldos e importes vienen del servidor (src/server/cash/cash-flow.ts), igual
// que en el Estado de flujo de efectivo. El gráfico solo reparte esos movimientos
// en el tiempo, arrancando del saldo inicial.

type HistorialProps = {
  movements: CajasMovementItem[]
  cashFlow: CashFlowByCurrency
  period: ChartPeriod
  customFrom?: string
  customTo?: string
  selectedYear?: number
  selectedMonth?: number
  selectedDay?: string
  selectedWeekStart?: string
}

function useHistorialData(props: HistorialProps, currency: CajaCurrency) {
  const { movements, cashFlow, period, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart } = props
  const summary = cashFlow[currency]
  const chartData = useMemo(
    () => buildChartData(
      movements.filter((m) => (m.currency || 'ARS') === currency),
      period, summary.saldoInicial, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart,
    ),
    [movements, currency, summary.saldoInicial, period, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart],
  )
  return { summary, chartData }
}

function CurrencyToggle({ value, onChange, size = 'sm' }: { value: CajaCurrency; onChange: (c: CajaCurrency) => void; size?: 'xs' | 'sm' }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-[#E5E7EB] dark:border-white/10" role="group" aria-label="Moneda">
      {CAJA_CURRENCIES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(c) }}
          aria-pressed={value === c}
          className={`font-semibold transition ${size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'} ${
            value === c ? 'bg-brand-military text-white' : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-200'
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  )
}

function HistorialModal({
  currency,
  onCurrencyChange,
  onClose,
  ...props
}: HistorialProps & { currency: CajaCurrency; onCurrencyChange: (c: CajaCurrency) => void; onClose: () => void }) {
  const { summary, chartData } = useHistorialData(props, currency)
  const sym = CURRENCY_SYMBOL[currency]

  const fmtAxis = (v: number) => {
    const abs = Math.abs(v)
    if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}K`
    return String(v)
  }
  const fmtSaldo = (v: number) => `${v < 0 ? '− ' : ''}${sym}${Math.abs(Math.round(v)).toLocaleString('es-AR')}`
  const saldoCls = (v: number) => v >= 0 ? 'text-[#1F2937] dark:text-[#E8E8E8]' : 'text-[#A65D57]'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 flex h-[90vh] w-[92vw] max-w-[1600px] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#141414]">
        <div className="flex items-center justify-between border-b border-[#ECE7E1] bg-[#FAFBFC] px-5 py-4 dark:border-white/10 dark:bg-[#171717]">
          <h3 className="text-base font-semibold text-[#1F2937] dark:text-[#E8E8E8]">Historial de caja</h3>
          <div className="flex items-center gap-3">
            <CurrencyToggle value={currency} onChange={onCurrencyChange} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-xl border border-stone-200 bg-white p-2 text-stone-400 transition hover:text-stone-700 dark:border-white/10 dark:bg-[#1B1B1B] dark:hover:text-stone-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-5">
          {chartData.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-stone-400">Sin datos para este período</div>
          ) : (
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 12, right: 16, left: 4, bottom: 4 }} barCategoryGap="22%" barGap={2}>
                  <defs>
                    <linearGradient id="modalIngFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.ing} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={CHART_COLORS.ing} stopOpacity={0.45} />
                    </linearGradient>
                    <linearGradient id="modalEgrFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.egr} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={CHART_COLORS.egr} stopOpacity={0.45} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-stone-200 dark:text-white/10" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tickFormatter={fmtAxis} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={48} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={fmtAxis} tick={{ fontSize: 10, fill: CHART_COLORS.saldo }} axisLine={false} tickLine={false} width={52} />
                  <Tooltip cursor={{ fill: 'rgba(197,160,101,0.08)' }} content={(p) => <HistorialTooltip active={p.active} payload={p.payload as never} fmt={fmtSaldo} />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ paddingBottom: 8 }}
                    formatter={(value) => {
                      const m: Record<string, string> = { ingresos: 'Ingresos', egresos: 'Egresos', saldo: 'Saldo' }
                      return <span style={{ fontSize: 11, color: '#6B7280' }}>{m[String(value)] ?? String(value)}</span>
                    }}
                  />
                  {summary.saldoInicial !== 0 && (
                    <ReferenceLine
                      yAxisId="right"
                      y={summary.saldoInicial}
                      stroke={CHART_COLORS.saldo}
                      strokeDasharray="4 4"
                      strokeOpacity={0.55}
                      label={{ value: 'Saldo inicial', position: 'insideTopRight', fill: CHART_COLORS.saldo, fontSize: 10 }}
                    />
                  )}
                  <Bar yAxisId="left" dataKey="ingresos" fill="url(#modalIngFill)" radius={[4, 4, 0, 0] as [number, number, number, number]} maxBarSize={28} />
                  <Bar yAxisId="left" dataKey="egresos" fill="url(#modalEgrFill)" radius={[4, 4, 0, 0] as [number, number, number, number]} maxBarSize={28} />
                  <Line yAxisId="right" type="monotone" dataKey="saldo" stroke={CHART_COLORS.saldo} strokeWidth={2.25} dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: CHART_COLORS.saldo }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 divide-x divide-[#E5E7EB] border-t border-[#ECE7E1] dark:divide-white/10 dark:border-white/10 sm:grid-cols-4">
          <div className="px-5 py-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Saldo inicial</p>
            <p className={`mt-1 font-mono text-sm font-bold ${saldoCls(summary.saldoInicial)}`}>{fmtSaldo(summary.saldoInicial)}</p>
          </div>
          <div className="px-5 py-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Ingresos</p>
            <p className="mt-1 font-mono text-sm font-bold text-[#3A4D39]">{fmtSaldo(summary.ingresos)}</p>
          </div>
          <div className="px-5 py-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Egresos</p>
            <p className="mt-1 font-mono text-sm font-bold text-[#A65D57]">{fmtSaldo(summary.egresos)}</p>
          </div>
          <div className="px-5 py-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Saldo final</p>
            <p className={`mt-1 font-mono text-sm font-bold ${saldoCls(summary.saldoFinal)}`}>{fmtSaldo(summary.saldoFinal)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function HistorialCard(props: HistorialProps) {
  const [open, setOpen] = useState(false)
  const [currency, setCurrency] = useState<CajaCurrency>('ARS')
  const { summary, chartData } = useHistorialData(props, currency)
  const sym = CURRENCY_SYMBOL[currency]

  const fmtCompact = (v: number) => {
    const abs = Math.abs(v)
    const sign = v < 0 ? '− ' : ''
    if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${sign}${sym}${(abs / 1_000).toFixed(0)}K`
    return `${sign}${sym}${Math.round(abs)}`
  }
  const saldoCls = (v: number) => v >= 0 ? 'text-[#1F2937] dark:text-[#E8E8E8]' : 'text-[#A65D57] dark:text-[#F2B272]'

  return (
    <>
      <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#141414]">
        {/* Sin fila de título: el selector de moneda flota en la esquina y el gráfico usa todo el alto */}
        <div className="absolute right-3 top-3 z-10 bg-white/80 backdrop-blur-sm dark:bg-[#141414]/80">
          <CurrencyToggle value={currency} onChange={setCurrency} size="xs" />
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Ver historial de caja en ${currency} en grande`}
          className="group flex flex-1 flex-col gap-3 px-3 pt-3 pb-3 text-left transition hover:bg-[#FAFBFC] dark:hover:bg-[#171717]"
        >
          {chartData.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-8">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">Sin movimientos</p>
            </div>
          ) : (
            <div className="relative min-h-[180px] w-full flex-1">
              <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 30, right: 6, left: 6, bottom: 0 }} barCategoryGap="22%" barGap={1}>
                  <defs>
                    <linearGradient id="histIngFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.ing} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={CHART_COLORS.ing} stopOpacity={0.35} />
                    </linearGradient>
                    <linearGradient id="histEgrFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.egr} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={CHART_COLORS.egr} stopOpacity={0.35} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={14} height={16} />
                  <YAxis yAxisId="left" hide />
                  <YAxis yAxisId="right" orientation="right" hide />
                  <Tooltip cursor={{ fill: 'rgba(197,160,101,0.08)' }} content={(p) => <HistorialTooltip active={p.active} payload={p.payload as never} fmt={fmtCompact} />} />
                  <Bar yAxisId="left" dataKey="ingresos" fill="url(#histIngFill)" radius={[2, 2, 0, 0] as [number, number, number, number]} maxBarSize={8} />
                  <Bar yAxisId="left" dataKey="egresos" fill="url(#histEgrFill)" radius={[2, 2, 0, 0] as [number, number, number, number]} maxBarSize={8} />
                  <Line yAxisId="right" type="monotone" dataKey="saldo" stroke={CHART_COLORS.saldo} strokeWidth={2.25} dot={false} activeDot={{ r: 3.5, stroke: '#fff', strokeWidth: 1.5, fill: CHART_COLORS.saldo }} />
                </ComposedChart>
              </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 gap-1 pt-1">
            <div className="text-center">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-400">Saldo inicial</p>
              <p className={`mt-0.5 font-mono text-[11px] font-bold ${saldoCls(summary.saldoInicial)}`}>{fmtCompact(summary.saldoInicial)}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-400">Ingresos</p>
              <p className="mt-0.5 font-mono text-[11px] font-bold text-[#3A4D39] dark:text-[#9AC7A8]">{fmtCompact(summary.ingresos)}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-400">Egresos</p>
              <p className="mt-0.5 font-mono text-[11px] font-bold text-[#A65D57] dark:text-[#F2B272]">{fmtCompact(summary.egresos)}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-400">Saldo final</p>
              <p className={`mt-0.5 font-mono text-[11px] font-bold ${saldoCls(summary.saldoFinal)}`}>{fmtCompact(summary.saldoFinal)}</p>
            </div>
          </div>
        </button>
      </div>

      {open && (
        <HistorialModal
          {...props}
          currency={currency}
          onCurrencyChange={setCurrency}
          onClose={() => setOpen(false)}
        />
      )}
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
                  <p className="min-w-0 truncate text-sm font-medium text-[#1F2937] dark:text-[#E8E8E8]">{acc.name}</p>
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

// Búsqueda sin tildes ni mayúsculas
const normalizeSearch = (v: string) => v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Fecha local "yyyy-mm-dd" (la de toISOString es UTC y puede correr el día)
function localDateKey(value: string | Date) {
  const d = new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Todo el texto por el que se puede buscar un movimiento
function searchText(mov: CajasMovementItem) {
  return normalizeSearch([
    mov.description,
    mov.isTransfer ? 'Cambio de caja' : getSubTypeLabel(mov.subType),
    mov.transferLabel,
    mov.category?.name,
    mov.subcategory?.name,
    mov.contact?.name,
    mov.account?.name,
    ...(mov.operacion?.items.map((i) => i.producto.nombre) ?? []),
  ].filter(Boolean).join(' '))
}

function MovementsPanel({ movements }: { movements: CajasMovementItem[] }) {
  const [origins, setOrigins] = useState<Set<OriginKey>>(new Set())
  const [query, setQuery] = useState('')
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

  const terms = useMemo(() => normalizeSearch(query).split(/s+/).filter(Boolean), [query])

  const filtered = useMemo(() => {
    return groupByOperacion(movements).filter(mov => {
      // Una operación entra en el filtro si alguna de sus partes coincide
      if (origins.size > 0 && !(mov.parts ?? [mov]).some((p) => origins.has(getOrigin(p)))) return false
      if (dateFrom && localDateKey(mov.date) < dateFrom) return false
      if (dateTo && localDateKey(mov.date) > dateTo) return false
      if (terms.length > 0) {
        const text = (mov.parts ?? [mov]).map(searchText).join(' ')
        if (!terms.every((t) => text.includes(t))) return false
      }
      return true
    })
  }, [movements, origins, dateFrom, dateTo, terms])

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
          <div className="min-w-[220px] flex-1 basis-[260px]">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400">Buscar</p>
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={e => { setQuery(e.target.value); setPage(1) }}
                placeholder="Descripción, cliente, proveedor, categoría, producto…"
                aria-label="Buscar movimientos"
                className="h-[38px] w-full border border-[#E5E7EB] bg-white pl-9 pr-3 text-sm text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-brand-military dark:border-white/10 dark:bg-[#16181b] dark:text-stone-200"
              />
            </div>
          </div>

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
                      className={`border-b border-[#ECE7E1] transition hover:bg-[#FAFBFA] dark:border-white/5 dark:hover:bg-white/[0.03] border-l-[3px] ${
                        mov.isTransfer ? 'border-l-[#3F3F46]' : isIncome ? 'border-l-[#3A4D39]' : 'border-l-[#A65D57]'
                      }`}
                    >
                      <td className="px-5 py-3 align-middle whitespace-nowrap">
                        <span className="text-sm font-medium text-[#4B5563] dark:text-stone-300">{fmtDate(mov.date)}</span>
                      </td>

                      <td className="px-5 py-3 align-middle">
                        <p className="text-sm font-semibold text-[#1F2937] dark:text-[#E8E8E8]">{mov.isTransfer ? 'Cambio de caja' : getSubTypeLabel(mov.subType)}</p>
                        {mov.parts && mov.operacion && (
                          <p className="mt-0.5 text-[11px] text-stone-400" title={mov.operacion.items.map((i) => `${i.cantidad} × ${i.producto.nombre}`).join('\n')}>
                            {mov.operacion.items.length} producto{mov.operacion.items.length !== 1 ? 's' : ''}
                            {mov.operacion.descuento > 0 ? ` · desc. ${fmtMoney(mov.operacion.descuento, mov.currency)}` : ''}
                          </p>
                        )}
                        {mov.isTransfer && mov.transferLabel && (
                          <p className="mt-0.5 text-[11px] text-stone-400">{mov.transferLabel}</p>
                        )}
                        {mov.category && (
                          <p className="mt-0.5 text-[11px] text-stone-400">{mov.category.name}{mov.subcategory ? ` › ${mov.subcategory.name}` : ''}</p>
                        )}
                      </td>

                      <td className="px-5 py-3 align-middle">
                        {mov.isTransfer
                          ? <span className="inline-flex rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-600 dark:border-white/15 dark:bg-white/5 dark:text-zinc-300">{isIncome ? 'Entra' : 'Sale'}</span>
                          : mov.parts && mov.parts.some((p) => p.esCredito) && mov.parts.some((p) => !p.esCredito)
                            ? <span className={`inline-flex rounded-full border bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide dark:bg-transparent ${
                                isIncome ? 'border-emerald-300 text-emerald-700 dark:text-emerald-400' : 'border-red-300 text-red-600 dark:text-red-400'
                              }`}>Parcial</span>
                            : <EstadoBadge type={mov.type} esCredito={mov.parts ? mov.parts.every((p) => p.esCredito) : esCredito} />}
                      </td>

                      <td className="px-5 py-3 align-middle">
                        {mov.parts ? (
                          // Operación: un renglón chico por cada forma de pago
                          <div className="flex flex-col gap-0.5">
                            {describeParts(mov.parts).map((line) => (
                              <span key={line.label} className="flex items-baseline justify-between gap-3 text-[11px] text-stone-500 dark:text-stone-400">
                                <span className="truncate">{line.label}</span>
                                <span className="font-mono tabular-nums">{fmtMoney(line.amount, line.currency)}</span>
                              </span>
                            ))}
                          </div>
                        ) : esCredito ? (
                          <span className="text-sm text-stone-400">N/A</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex w-fit border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-semibold text-stone-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-stone-300">
                              {mov.account?.type === 'CASH' ? 'Efectivo' : 'Virtual'}
                            </span>
                            {mov.account?.name && (
                              <span className="text-[11px] text-stone-400 dark:text-stone-500">{mov.account.name}</span>
                            )}
                          </div>
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
                          mov.isTransfer ? 'text-zinc-600 dark:text-zinc-300'
                            : isIncome ? 'text-[#2D6A4F] dark:text-[#8FD0A7]' : 'text-[#A65D57] dark:text-[#E08580]'
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
  const isNegative = filteredTotal < 0

  const tone = variant === 'gold'
    ? {
        card: 'border-[#E5E7EB] bg-white dark:border-white/10 dark:bg-[#141414]',
        header: 'bg-[#FAFBFC] border-[#ECE7E1] dark:bg-[#171717] dark:border-white/10',
        iconWrap: 'bg-brand-gold-light text-brand-gold-dark dark:bg-[#3B2E1A] dark:text-[#D7B36B]',
        selectorWrap: 'border-[#E6D6B8] bg-[#FFF8EC] dark:border-[#5B4A2F] dark:bg-[#21180F]',
        selectorActive: 'bg-brand-gold text-white shadow-sm dark:bg-[#7A5821] dark:text-[#FFF6E6]',
        selectorIdle: 'text-[#8A6118] hover:text-[#5C4315] dark:text-[#CBA86B] dark:hover:text-[#F2D59B]',
        button: 'border-[#D9C7A1] bg-white text-[#8A6118] hover:border-[#B88A2E] hover:text-[#6E4E14] dark:border-[#5B4A2F] dark:bg-[#221A10] dark:text-[#D7B36B]',
      }
    : {
        card: 'border-[#E5E7EB] bg-white dark:border-white/10 dark:bg-[#141414]',
        header: 'bg-[#FAFBFC] border-[#ECE7E1] dark:bg-[#171717] dark:border-white/10',
        iconWrap: 'bg-brand-military-light text-[#2D5A41] dark:bg-[#1F3428] dark:text-[#9AC7A8]',
        selectorWrap: 'border-[#D5E3D8] bg-[#F5FAF7] dark:border-[#294235] dark:bg-[#131C16]',
        selectorActive: 'bg-brand-military text-white shadow-sm dark:bg-[#244330] dark:text-[#D7F3DF]',
        selectorIdle: 'text-[#4D6E59] hover:text-[#1F4D36] dark:text-[#8CB299] dark:hover:text-[#D7F3DF]',
        button: 'border-[#C9D8CC] bg-white text-[#2D5A41] hover:border-[#2D6A4F] hover:text-[#1F4D36] dark:border-[#294235] dark:bg-[#152019] dark:text-[#9AC7A8]',
      }

  return (
    <>
      <div className="flex h-full flex-col">
        <div className={`flex h-full flex-col overflow-hidden rounded-2xl border shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-none ${tone.card}`}>

          <div className={`flex-1 px-5 pb-5 pt-6 flex flex-col ${tone.header}`}>
            {/* Fila: icono + título + botón subcajas */}
            <div className="flex items-center gap-2.5 mb-6">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center ${tone.iconWrap}`}>
                {icon}
              </div>
              <h2 className="flex-1 text-base font-semibold text-[#1F2937] dark:text-[#E8E8E8]">{label}</h2>
              <button
                type="button"
                onClick={() => setDetailsOpen(true)}
                className={`shrink-0 border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${tone.button}`}
              >
                Subcajas
              </button>
            </div>

            {/* Saldo — ancho completo sin competencia */}
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-400 mb-2">Saldo</p>
            <p className={`text-[40px] md:text-[44px] font-mono font-bold num-tabular leading-none ${
              isNegative ? 'text-[#B45309] dark:text-[#F2B272]' : 'text-[#1F2937] dark:text-[#E8E8E8]'
            }`}>
              {isNegative ? '− ' : ''}{fmtMoney(Math.abs(filteredTotal), selectedCurrency)}
            </p>

            <div className={`mt-auto inline-flex w-full items-center gap-1 border p-1 ${tone.selectorWrap}`}>
              {CAJA_CURRENCIES.map((currency) => {
                const isActive = selectedCurrency === currency
                const isAvailable = availableCurrencies.has(currency)
                return (
                  <button
                    key={currency}
                    type="button"
                    onClick={() => setSelectedCurrency(currency)}
                    className={`flex-1 px-3 py-2 text-[11px] font-semibold transition ${
                      isActive ? tone.selectorActive : tone.selectorIdle
                    } ${!isAvailable ? 'opacity-55' : ''}`}
                  >
                    {getCurrencyLabel(currency)}
                  </button>
                )
              })}
            </div>
          </div>

        </div>
      </div>

      {detailsOpen && (
        <CajaDetailsModal
          label={label}
          currency={selectedCurrency}
          accounts={filtered}
          total={filteredTotal}
          onClose={() => setDetailsOpen(false)}
        />
      )}
    </>
  )
}

// ── Componente principal ──
interface CajasClientProps {
  data: CajasData
  movements: CajasMovementItem[]
  cashFlow: CashFlowByCurrency
  period: ChartPeriod
  customFrom?: string
  customTo?: string
  selectedYear?: number
  selectedMonth?: number
  selectedDay?: string
  selectedWeekStart?: string
}

export default function CajasClient({
  data,
  movements,
  cashFlow,
  period,
  customFrom,
  customTo,
  selectedYear,
  selectedMonth,
  selectedDay,
  selectedWeekStart,
}: CajasClientProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-stretch">
        <CajaGroupColumn label="Efectivo" icon={<CashIcon />} group={data.efectivo} variant="military" />
        <CajaGroupColumn label="Virtual" icon={<VirtualIcon />} group={data.virtual} variant="gold" />
        <HistorialCard
          cashFlow={cashFlow}
          movements={movements}
          period={period}
          customFrom={customFrom}
          customTo={customTo}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          selectedDay={selectedDay}
          selectedWeekStart={selectedWeekStart}
        />
      </div>
      <MovementsPanel movements={movements} />
    </div>
  )
}

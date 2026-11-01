'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getCajasMovementsPage } from '@/app/actions'
import type { CajasMovementCursor } from '@/lib/cajas-movement-pagination'
import { CalendarPopover, RangeCalendar, rangeLabel } from './ui/IosCalendar'
import MovementDetailSheet from './cajas/MovementDetailSheet'
import { useStoredValue } from '@/lib/useStoredValue'
import { useSearchParams } from 'next/navigation'
import EmptyState from '@/components/ui/EmptyState'
import type { PeriodKey } from '@/components/PeriodSelector'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import { ResponsiveChartContainer } from '@/components/ResponsiveChartContainer'

// ── Paleta del gráfico Historial ──────────────────────────────────────────
const CHART_COLORS = {
  ing: 'var(--income)',
  ingSoft: 'var(--income)',
  egr: 'var(--expense)',
  egrSoft: 'var(--expense)',
} as const

/** Línea de saldo acumulado: azul petróleo (más claro en modo oscuro para que se lea) */
function useSaldoColor() {
  const [theme] = useStoredValue('theme')
  return theme === 'dark' ? '#A8C89C' : '#1E4B1C'
}

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

export interface CajasMovementItem {
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
  operacion?: { total: number; descuento: number; items: { cantidad: number; precioUnitario?: number; subtotal?: number; producto: { nombre: string } }[] } | null
  cuotaNumero?: number | null
  fechaVencimiento?: string | Date | null
  cuotasTotal?: number | null
}

/** Fila de la lista: un movimiento suelto o una operación con sus partes de pago */
export type MovementRow = CajasMovementItem & { parts?: CajasMovementItem[] }

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

/** Circulito de la columna Caja: billete azul pizarra (efectivo), tarjeta marrón cuero (virtual), ⇄ (cambio) o reloj (cuotas) */
function CajaIcon({ kind }: { kind: 'efectivo' | 'virtual' | 'cambio' | 'credito' | 'deuda' }) {
  const cls = {
    efectivo: 'bg-[#6B7280]/15 text-[#4B5563] dark:text-[#9CA3AF]',
    virtual: 'bg-[#E8EFE5] text-[#1E4B1C] dark:bg-[#151515] dark:text-[#A8C89C]',
    cambio: 'bg-black/[0.06] text-[var(--ds-gray-500)] dark:bg-white/10',
    credito: 'bg-[#E8EFE5] text-[#1E4B1C] dark:bg-[#151515] dark:text-[#A8C89C]',
    deuda: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  }[kind]
  const path = {
    efectivo: 'M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    virtual: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z',
    cambio: 'M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
    credito: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    deuda: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  }[kind]
  return (
    <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ${cls}`} aria-hidden>
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
      </svg>
    </span>
  )
}

/**
 * Celda Caja de la tabla: ícono + nombre de la caja en una línea. Pago combinado: nombres unidos
 * y, muy sutil debajo, el monto de cada caja. A crédito: "3 cuotas". Cambio de caja: "Origen → Destino".
 */
function CajaCell({ mov }: { mov: MovementRow }) {
  if (mov.isTransfer) {
    return (
      <span className="flex items-center gap-2 text-[13px] text-[var(--ds-gray-900)] dark:text-white">
        <CajaIcon kind="cambio" />
        <span className="truncate">{mov.transferLabel ?? mov.account?.name}</span>
      </span>
    )
  }
  const partes = mov.parts ?? [mov]
  const contado = partes.filter((p) => !p.esCredito)
  const credito = partes.filter((p) => p.esCredito)
  const cuotas = credito.length > 0 ? (credito[0].cuotasTotal ?? credito.length) : 0
  const cuotasTxt = cuotas > 0 ? `${cuotas} cuota${cuotas > 1 ? 's' : ''}` : null
  const tipos = [...new Set(contado.map((p) => (p.account?.type === 'CASH' ? 'efectivo' : 'virtual') as 'efectivo' | 'virtual'))]
  const nombres = [...new Set(contado.map((p) => p.account?.name ?? ''))].filter(Boolean)

  if (contado.length === 0) {
    return (
      <span className="flex items-center gap-2 text-[13px] text-[var(--ds-gray-500)]">
        <CajaIcon kind={mov.type === 'INCOME' ? 'credito' : 'deuda'} />
        {cuotasTxt ?? 'A crédito'}
      </span>
    )
  }
  return (
    <div className="min-w-0">
      <span className="flex items-center gap-2 text-[13px] text-[var(--ds-gray-900)] dark:text-white">
        <span className="flex shrink-0 -space-x-1.5">
          {tipos.map((t) => <CajaIcon key={t} kind={t} />)}
        </span>
        <span className="truncate">
          {nombres.join(' + ')}
          {cuotasTxt && <span className="text-[var(--ds-gray-500)]"> + {cuotasTxt}</span>}
        </span>
      </span>
      {/* Pago combinado: el monto de cada caja, muy sutil */}
      {partes.length > 1 && (
        <p className="mt-0.5 truncate pl-[30px] text-[11px] tabular-nums text-[var(--ds-gray-400)] dark:text-[var(--ds-gray-600)]">
          {contado.map((p) => `${p.account?.name ?? ''} ${fmtMoney(p.amount, p.currency)}`).join(' · ')}
          {credito.length > 0 && ` · Cuotas ${fmtMoney(credito.reduce((s, p) => s + p.amount, 0), credito[0].currency)}`}
        </p>
      )}
    </div>
  )
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
  return `${sym}${Math.round(Math.abs(v)).toLocaleString('es-AR')}`
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
// ── Ícono Virtual ──
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
    return <span className="inline-flex rounded-full border border-ds-green-200 bg-ds-green-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ds-green-700">Ingreso</span>
  if (type === 'EXPENSE' && !esCredito)
    return <span className="inline-flex rounded-full border border-ds-red-100 bg-ds-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ds-red-600">Egreso</span>
  if (type === 'INCOME' && esCredito)
    return <span className="inline-flex rounded-full border border-ds-green-700 bg-ds-green-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">A cobrar</span>
  return <span className="inline-flex rounded-full border border-ds-red-600 bg-ds-red-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">A pagar</span>
}

// Recuadro del gráfico: ingresos, egresos, cambio de moneda (solo si hubo) y saldo
type HistorialPoint = { label: string; ingresos: number; egresos: number; cambios: number; saldo: number }
function HistorialTooltip({ active, payload, fmt }: { active?: boolean; payload?: readonly { payload?: HistorialPoint }[]; fmt: (v: number) => string }) {
  const saldoColor = useSaldoColor()
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  const rows: [string, number, string][] = [
    ['Ingresos', point.ingresos, CHART_COLORS.ing],
    ['Egresos', point.egresos, CHART_COLORS.egr],
    ...(point.cambios !== 0 ? [['Transferencias', point.cambios, '#71717A'] as [string, number, string]] : []),
    ['Saldo', point.saldo, saldoColor],
  ]
  return (
    <div className="rounded-xl border border-[var(--ds-neutral-200)] bg-white px-3 py-2 text-[11px] shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-[var(--ds-gray-900)]">
      <p className="mb-1 text-gray-500 dark:text-gray-400">{point.label}</p>
      {rows.map(([name, value, color]) => (
        <p key={name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            {name}
          </span>
          <span className="font-mono font-semibold text-[var(--ds-neutral-800)] tabular-nums dark:text-[var(--ds-line)]">{name === 'Transferencias' && value > 0 ? '+' : ''}{fmt(value)}</span>
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

type CashChartView = 'saldo' | 'movimientos'

function CashChartViewToggle({ view, onChange }: { view: CashChartView; onChange: (view: CashChartView) => void }) {
  return (
    <div className="inline-flex shrink-0 rounded-md border border-[var(--border-token)] bg-[var(--surface-muted)] p-0.5" role="group" aria-label="Tipo de gráfico">
      {([['saldo', 'Saldo'], ['movimientos', 'Movimientos']] as const).map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          aria-pressed={view === value}
          className={`min-h-8 rounded px-2.5 text-[11px] font-medium transition ${view === value ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function CashChartLegend({ view }: { view: CashChartView }) {
  const items: { label: string; color: string; line?: boolean }[] = view === 'saldo'
    ? [{ label: 'Saldo acumulado', color: '#1E4B1C', line: true }]
    : [
        { label: 'Ingresos', color: CHART_COLORS.ing },
        { label: 'Egresos', color: CHART_COLORS.egr },
        { label: 'Transferencias', color: '#89938B' },
      ]

  return (
    <div className="cash-chart-legend flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-medium text-[var(--text-secondary)]" aria-label="Referencias del gráfico">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className={item.line ? 'h-[2px] w-3' : 'h-1.5 w-1.5 rounded-full'} style={{ backgroundColor: item.color }} aria-hidden />
          {item.label}
        </span>
      ))}
    </div>
  )
}

function CashFlowPlot({
  data,
  view,
  compact,
  saldoInicial,
  saldoColor,
  format,
}: {
  data: HistorialPoint[]
  view: CashChartView
  compact: boolean
  saldoInicial: number
  saldoColor: string
  format: (value: number) => string
}) {
  const fmtAxis = (value: number) => {
    const abs = Math.abs(value)
    const prefix = value < 0 ? '−' : ''
    if (abs >= 1_000_000) return `${prefix}${(abs / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${prefix}${(abs / 1_000).toFixed(0)}K`
    return `${prefix}${Math.round(abs)}`
  }
  const chartMargin = compact
    ? { top: 6, right: 3, left: 3, bottom: 0 }
    : { top: 8, right: 14, left: 4, bottom: 4 }

  return (
    <ResponsiveChartContainer width="100%" height="100%">
      {view === 'saldo' ? (
        <AreaChart data={data} margin={chartMargin}>
          <CartesianGrid stroke="currentColor" className="text-black/[0.08] dark:text-white/10" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: compact ? 9 : 10, fill: '#737D75' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={compact ? 18 : 12} />
          <YAxis hide={compact} tickFormatter={fmtAxis} tick={{ fontSize: 10, fill: '#737D75' }} axisLine={false} tickLine={false} width={48} />
          <Tooltip cursor={{ stroke: saldoColor, strokeOpacity: 0.18 }} content={(p) => <HistorialTooltip active={p.active} payload={p.payload as never} fmt={format} />} />
          {saldoInicial !== 0 && !compact && <ReferenceLine y={saldoInicial} stroke={saldoColor} strokeDasharray="4 4" strokeOpacity={0.5} />}
          <Area type="linear" dataKey="saldo" name="Saldo" stroke={saldoColor} strokeWidth={2.5} fill={saldoColor} fillOpacity={0.1} dot={false} activeDot={{ r: compact ? 3 : 5, stroke: '#fff', strokeWidth: 2, fill: saldoColor }} />
        </AreaChart>
      ) : (
        <BarChart data={data} margin={chartMargin} barCategoryGap={compact ? '24%' : '28%'} barGap={compact ? 1 : 3}>
          <CartesianGrid stroke="currentColor" className="text-black/[0.08] dark:text-white/10" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: compact ? 9 : 10, fill: '#737D75' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={compact ? 18 : 12} />
          <YAxis hide={compact} tickFormatter={fmtAxis} tick={{ fontSize: 10, fill: '#737D75' }} axisLine={false} tickLine={false} width={48} />
          <Tooltip cursor={{ fill: 'rgba(20, 40, 26, .045)' }} content={(p) => <HistorialTooltip active={p.active} payload={p.payload as never} fmt={format} />} />
          <Bar dataKey="ingresos" name="Ingresos" fill={CHART_COLORS.ing} fillOpacity={0.92} radius={[3, 3, 0, 0] as [number, number, number, number]} maxBarSize={compact ? 12 : 30} />
          <Bar dataKey="egresos" name="Egresos" fill={CHART_COLORS.egr} fillOpacity={0.88} radius={[3, 3, 0, 0] as [number, number, number, number]} maxBarSize={compact ? 12 : 30} />
          <Bar dataKey="cambios" name="Transferencias" fill="#89938B" fillOpacity={0.78} radius={[3, 3, 0, 0] as [number, number, number, number]} maxBarSize={compact ? 12 : 30} />
        </BarChart>
      )}
    </ResponsiveChartContainer>
  )
}

function CurrencyToggle({ value, onChange, size = 'sm' }: { value: CajaCurrency; onChange: (c: CajaCurrency) => void; size?: 'xs' | 'sm' }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-[var(--ds-neutral-200)] dark:border-white/10" role="group" aria-label="Moneda">
      {CAJA_CURRENCIES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(c) }}
          aria-pressed={value === c}
          className={`font-semibold transition ${size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'} ${
            value === c ? 'bg-brand-military text-white' : 'text-[var(--text-tertiary)] hover:text-gray-600 dark:hover:text-gray-200'
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
  view,
  onViewChange,
  onClose,
  ...props
}: HistorialProps & { currency: CajaCurrency; onCurrencyChange: (c: CajaCurrency) => void; view: CashChartView; onViewChange: (view: CashChartView) => void; onClose: () => void }) {
  const { summary, chartData } = useHistorialData(props, currency)
  const saldoColor = useSaldoColor()
  const sym = CURRENCY_SYMBOL[currency]
  const fmtSaldo = (v: number) => `${v < 0 ? '− ' : ''}${sym}${Math.abs(Math.round(v)).toLocaleString('es-AR')}`
  const saldoCls = (v: number) => v >= 0 ? 'text-[var(--ds-neutral-800)] dark:text-[var(--ds-line)]' : 'text-[var(--expense)]'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="section-polish cash-history-modal relative z-10 flex h-[90vh] w-[92vw] max-w-[1440px] flex-col overflow-hidden rounded-2xl border border-[var(--border-token)] bg-[var(--surface)] shadow-2xl">
        <div className="cash-history-heading flex items-center justify-between border-b border-[var(--border-token)] bg-[var(--surface-muted)] px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-[var(--ds-neutral-800)] dark:text-[var(--ds-line)]">Evolución de caja</h3>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">{view === 'saldo' ? 'El saldo acumulado a lo largo del período' : 'Ingresos, egresos y transferencias del período'}</p>
          </div>
          <div className="flex items-center gap-3">
            <CashChartViewToggle view={view} onChange={onViewChange} />
            <CurrencyToggle value={currency} onChange={onCurrencyChange} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-xl border border-gray-200 bg-white p-2 text-[var(--text-tertiary)] transition hover:text-gray-700 dark:border-white/10 dark:bg-[#1B1B1B] dark:hover:text-gray-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="cash-history-plot flex min-h-0 flex-1 flex-col p-5">
          <CashChartLegend view={view} />
          {chartData.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-[var(--text-tertiary)]">Sin datos para este período</div>
          ) : (
            <div className="min-h-0 flex-1">
              <CashFlowPlot data={chartData} view={view} compact={false} saldoInicial={summary.saldoInicial} saldoColor={saldoColor} format={fmtSaldo} />
            </div>
          )}
        </div>

        <div className="cash-history-summary grid grid-cols-2 divide-x divide-[var(--ds-neutral-200)] border-t border-[var(--ds-sand-warm)] dark:divide-white/10 dark:border-white/10 sm:grid-cols-4">
          <div className="cash-history-stat px-5 py-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">Saldo inicial</p>
            <p className={`mt-1 font-mono text-sm font-bold ${saldoCls(summary.saldoInicial)}`}>{fmtSaldo(summary.saldoInicial)}</p>
          </div>
          <div className="cash-history-stat px-5 py-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">Ingresos</p>
            <p className="mt-1 font-mono text-sm font-bold text-[var(--income)]">{fmtSaldo(summary.ingresos)}</p>
          </div>
          <div className="cash-history-stat px-5 py-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">Egresos</p>
            <p className="mt-1 font-mono text-sm font-bold text-[var(--expense)]">{fmtSaldo(summary.egresos)}</p>
          </div>
          <div className="cash-history-stat px-5 py-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">Saldo final</p>
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
  const [view, setView] = useState<CashChartView>('saldo')
  const { summary, chartData } = useHistorialData(props, currency)
  const saldoColor = useSaldoColor()
  const sym = CURRENCY_SYMBOL[currency]

  const fmtCompact = (v: number) => {
    const abs = Math.abs(v)
    const sign = v < 0 ? '− ' : ''
    if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${sign}${sym}${(abs / 1_000).toFixed(0)}K`
    return `${sign}${sym}${Math.round(abs)}`
  }
  const saldoCls = (v: number) => v >= 0 ? 'text-[var(--ds-neutral-800)] dark:text-[var(--ds-line)]' : 'text-[var(--expense)]'

  return (
    <>
      <div className="cash-chart-card flex flex-col overflow-hidden rounded-xl border border-[var(--border-token)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(5,31,32,0.04)]">
        <div className="cash-chart-header flex items-start justify-between gap-3 border-b border-[var(--border-token)] px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-[var(--text)]">Evolución de caja</h2>
            <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">{view === 'saldo' ? 'Saldo acumulado' : 'Movimientos del período'}</p>
          </div>
          <CurrencyToggle value={currency} onChange={setCurrency} size="xs" />
        </div>

        <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
          <CashChartViewToggle view={view} onChange={setView} />
          <button type="button" onClick={() => setOpen(true)} className="cash-chart-expand min-h-8 rounded px-2 text-[11px] font-medium text-[var(--brand-700)] transition hover:bg-[var(--brand-100)] dark:text-[var(--brand-300)] dark:hover:bg-white/[0.06]" aria-label={`Ampliar gráfico de ${view === 'saldo' ? 'saldo' : 'movimientos'} en ${currency}`}>
            Ampliar
          </button>
        </div>
        <div className="px-4 pt-2"><CashChartLegend view={view} /></div>

        {chartData.length === 0 ? (
          <div className="flex h-[142px] items-center justify-center px-4">
            <p className="text-xs text-[var(--text-tertiary)]">Sin movimientos en este período</p>
          </div>
        ) : (
          <div className="cash-chart-content h-[190px] w-full px-4 pb-2 pt-2 sm:h-[220px]">
            <CashFlowPlot data={chartData} view={view} compact saldoInicial={summary.saldoInicial} saldoColor={saldoColor} format={fmtCompact} />
          </div>
        )}

        <div className="cash-chart-summary grid grid-cols-2 gap-x-2 gap-y-2 border-t border-[var(--border-token)] px-4 py-3 sm:grid-cols-4">
          <div className="cash-chart-stat text-left sm:text-center">
            <p className="text-[10px] font-semibold text-[var(--text-tertiary)]">Saldo inicial</p>
            <p className={`mt-0.5 font-mono text-[11px] font-bold ${saldoCls(summary.saldoInicial)}`}>{fmtCompact(summary.saldoInicial)}</p>
          </div>
          <div className="cash-chart-stat text-left sm:text-center">
            <p className="text-[10px] font-semibold text-[var(--text-tertiary)]">Ingresos</p>
            <p className="mt-0.5 font-mono text-[11px] font-bold text-[var(--income)]">{fmtCompact(summary.ingresos)}</p>
          </div>
          <div className="cash-chart-stat text-left sm:text-center">
            <p className="text-[10px] font-semibold text-[var(--text-tertiary)]">Egresos</p>
            <p className="mt-0.5 font-mono text-[11px] font-bold text-[var(--expense)]">{fmtCompact(summary.egresos)}</p>
          </div>
          <div className="cash-chart-stat text-left sm:text-center">
            <p className="text-[10px] font-semibold text-[var(--text-tertiary)]">Saldo final</p>
            <p className={`mt-0.5 font-mono text-[11px] font-bold ${saldoCls(summary.saldoFinal)}`}>{fmtCompact(summary.saldoFinal)}</p>
          </div>
        </div>
      </div>

      {open && (
        <HistorialModal
          {...props}
          currency={currency}
          onCurrencyChange={setCurrency}
          view={view}
          onViewChange={setView}
          onClose={() => setOpen(false)}
        />
      )}
    </>
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

function MovementsPanel({
  movements: initialMovements,
  initialCursor,
}: {
  movements: CajasMovementItem[]
  initialCursor: CajasMovementCursor | null
}) {
  const [movements, setMovements] = useState(initialMovements)
  const [cursor, setCursor] = useState(initialCursor)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [origins, setOrigins] = useState<Set<OriginKey>>(new Set())
  const [query, setQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  // Tocar una subcaja en las tarjetas: filtra por esa caja y lleva a la tabla
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onFiltrar = (e: Event) => {
      setQuery((e as CustomEvent<string>).detail)
      setPage(1)
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    window.addEventListener(EVENTO_FILTRAR_CAJA, onFiltrar)
    return () => window.removeEventListener(EVENTO_FILTRAR_CAJA, onFiltrar)
  }, [])

  // Movimiento abierto en la hoja de detalle
  const [detalle, setDetalle] = useState<MovementRow | null>(null)

  // Calendario de rango del filtro Fecha
  const fechasRef = useRef<HTMLButtonElement>(null)
  const [fechasOpen, setFechasOpen] = useState(false)
  const rangoFechas = dateFrom ? { from: new Date(dateFrom + 'T12:00:00'), to: dateTo ? new Date(dateTo + 'T12:00:00') : undefined } : undefined

  const toggleOrigin = (o: OriginKey) => {
    setOrigins(prev => {
      const next = new Set(prev)
      if (next.has(o)) next.delete(o)
      else next.add(o)
      return next
    })
    setPage(1)
  }

  const terms = useMemo(() => normalizeSearch(query).split(/\s+/).filter(Boolean), [query])
  const filtersActive = terms.length > 0 || origins.size > 0 || Boolean(dateFrom || dateTo)

  const loadNextPage = useCallback(async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const next = await getCajasMovementsPage(cursor)
      setMovements((current) => [...current, ...next.movements])
      setCursor(next.nextCursor)
      setLoadError(null)
    } catch (error) {
      console.error('[Cajas] No se pudo cargar la siguiente página de movimientos', error)
      setLoadError('No pudimos cargar más movimientos. Inténtalo nuevamente.')
    } finally {
      setLoadingMore(false)
    }
  }, [cursor, loadingMore])

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

  // Llegada desde el gráfico del Balance general (?mov=id): se muestra y resalta ese movimiento
  const targetMov = useSearchParams().get('mov')
  const targetIdx = targetMov ? filtered.findIndex((m) => m.id === targetMov || m.parts?.some((p) => p.id === targetMov)) : -1
  const targetRowId = targetIdx >= 0 ? filtered[targetIdx].id : null
  const shouldLoadAll = filtersActive || Boolean(targetMov && targetIdx < 0)
  const inFlightCursor = useRef<string | null>(null)
  useEffect(() => {
    const cursorKey = cursor ? `${cursor.kind}:${cursor.date}:${cursor.id}` : null
    if (!shouldLoadAll || !cursor || inFlightCursor.current === cursorKey) return
    inFlightCursor.current = cursorKey
    const loadRemaining = async () => {
      try {
        const next = await getCajasMovementsPage(cursor)
        setMovements((current) => [...current, ...next.movements])
        setCursor(next.nextCursor)
        setLoadError(null)
      } catch (error) {
        console.error('[Cajas] No se pudieron cargar los movimientos para el filtro', error)
        setLoadError('No pudimos cargar todos los movimientos para aplicar este filtro.')
      } finally {
        inFlightCursor.current = null
      }
    }
    void loadRemaining()
  }, [shouldLoadAll, cursor])
  const [highlight, setHighlight] = useState(true)
  useEffect(() => {
    if (!targetRowId) return
    const rowPrefix = window.matchMedia('(min-width: 1280px)').matches ? 'mov-' : 'mov-mobile-'
    document.getElementById(`${rowPrefix}${targetRowId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => setHighlight(false), 2500)
    return () => clearTimeout(t)
  }, [targetRowId])

  const paginated = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page])
  const hasMoreVisible = paginated.length < filtered.length

  const originOptions: { key: OriginKey; label: string; active: string; idle: string }[] = [
    {
      key: 'efectivo',
      label: 'Efectivo',
      active: 'border-[var(--brand-700)] bg-[var(--brand-700)] text-white',
      idle: 'border-[var(--border-token)] bg-[var(--surface)] text-[var(--text-secondary)]',
    },
    {
      key: 'virtual',
      label: 'Virtual',
      active: 'border-[var(--brand-700)] bg-[var(--brand-700)] text-white',
      idle: 'border-[var(--border-token)] bg-[var(--surface)] text-[var(--brand-700)] dark:text-[var(--brand-300)]',
    },
    {
      key: 'credito',
      label: 'Créditos',
      active: 'border-[var(--brand-700)] bg-[var(--brand-700)] text-white',
      idle: 'border-[var(--income)]/25 bg-[var(--income-soft)] text-[var(--income)]',
    },
    {
      key: 'deuda',
      label: 'Deudas',
      active: 'border-[var(--expense)] bg-[var(--expense)] text-white',
      idle: 'border-[var(--expense)]/25 bg-[var(--expense-soft)] text-[var(--expense)]',
    },
  ]

  return (
    <div ref={panelRef} className="scroll-mt-4 overflow-hidden rounded-2xl border border-[var(--border-token)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(5,31,32,0.04)]">
      <div className="border-b border-[var(--border-token)] bg-[var(--surface-muted)] px-5 pb-4 pt-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-100)] text-[var(--brand-700)] dark:bg-[var(--brand-800)] dark:text-[var(--brand-300)]">
            <MovementIcon />
          </div>
          <h3 className="text-base font-semibold text-[var(--ds-neutral-800)] dark:text-[var(--ds-line)]">Movimientos</h3>
          {detalle && (
          <MovementDetailSheet
            mov={detalle}
            titulo={detalle.isTransfer ? 'Cambio de caja' : getSubTypeLabel(detalle.subType)}
            onClose={() => setDetalle(null)}
          />
        )}

        {loadError && (
          <p role="alert" className="border-t border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {loadError}
          </p>
        )}

        {filtered.length > 0 && (
            <span className="ml-auto text-[11px] font-semibold text-[var(--text-tertiary)]">{filtered.length}{cursor ? '+' : ''} registros cargados</span>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[220px] flex-1 basis-[260px]">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Buscar</p>
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={e => { setQuery(e.target.value); setPage(1) }}
                placeholder="Descripción, cliente, proveedor, categoría, producto…"
                aria-label="Buscar movimientos"
                className="h-11 w-full rounded-xl border border-[var(--border-token)] bg-[var(--surface)] pl-9 pr-3 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-700)]"
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Origen</p>
            <div className="flex flex-wrap gap-2">
              {originOptions.map(({ key, label, active, idle }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleOrigin(key)}
                  className={`min-h-11 rounded-lg border px-3 text-[11px] font-semibold uppercase tracking-[0.08em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-700)] ${origins.has(key) ? active : idle}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Fecha</p>
            {/* Un solo calendario iOS de rango (desde–hasta) */}
            <button
              ref={fechasRef}
              type="button"
              onClick={() => setFechasOpen((v) => !v)}
              aria-expanded={fechasOpen}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-token)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--text)] transition hover:border-[var(--brand-300)] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-700)]"
            >
              <svg className="h-4 w-4 text-[var(--brand-700)] dark:text-[var(--brand-300)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <span className={dateFrom ? '' : 'text-[var(--ds-gray-500)]'}>{rangeLabel(rangoFechas) ?? 'Todas las fechas'}</span>
            </button>
            <CalendarPopover anchorRef={fechasRef} open={fechasOpen} onClose={() => setFechasOpen(false)}>
              <RangeCalendar
                value={rangoFechas}
                onChange={({ from, to }) => { setDateFrom(localDateKey(from)); setDateTo(localDateKey(to)); setPage(1); setFechasOpen(false) }}
                onClear={() => { setDateFrom(''); setDateTo(''); setPage(1); setFechasOpen(false) }}
              />
            </CalendarPopover>
          </div>
        </div>
      </div>

      <div>
        {paginated.length === 0 ? (
          <EmptyState
            compact
            title={shouldLoadAll && cursor ? 'Buscando en el historial completo…' : 'No hay movimientos que coincidan'}
            description={shouldLoadAll && cursor ? undefined : 'Probá con otra búsqueda o cambiá el filtro de fechas.'}
          />
        ) : (
          <>
          <div className="space-y-2 p-3 xl:hidden">
            {paginated.map((mov) => {
              const isIncome = mov.type === 'INCOME'
              const esCredito = mov.esCredito ?? false
              const isPartial = Boolean(mov.parts && mov.parts.some((part) => part.esCredito) && mov.parts.some((part) => !part.esCredito))
              const status = mov.isTransfer
                ? (isIncome ? 'Entra' : 'Sale')
                : isPartial
                  ? 'Parcial'
                  : mov.parts
                    ? (mov.parts.every((part) => part.esCredito) ? (isIncome ? 'A cobrar' : 'A pagar') : (isIncome ? 'Ingreso' : 'Egreso'))
                    : esCredito
                      ? (isIncome ? 'A cobrar' : 'A pagar')
                      : (isIncome ? 'Ingreso' : 'Egreso')
              return (
                <button
                  key={mov.id}
                  id={`mov-mobile-${mov.id}`}
                  type="button"
                  onClick={() => setDetalle(mov)}
                  aria-label={`Ver movimiento: ${mov.isTransfer ? 'Cambio de caja' : mov.category?.name ?? getSubTypeLabel(mov.subType)}, ${fmtMoney(mov.amount, mov.currency)}, ${fmtDate(mov.date)}`}
                  className={`flex min-h-[88px] w-full items-center justify-between gap-3 rounded-xl border border-[var(--border-token)] border-l-4 bg-[var(--surface)] px-3 py-3 text-left transition-colors hover:bg-[var(--surface-muted)] active:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--brand-700)] ${
                    mov.isTransfer ? 'border-l-[#71717A]' : isIncome ? 'border-l-[var(--income)]' : 'border-l-[var(--expense)]'
                  } ${highlight && mov.id === targetRowId ? 'bg-[var(--expense-soft)]' : ''}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] text-[var(--ds-gray-500)]">{fmtDate(mov.date)}</span>
                    <span className="mt-0.5 block truncate text-[14px] font-semibold text-[var(--ds-gray-900)] dark:text-white">
                      {mov.isTransfer ? 'Cambio de caja' : mov.category?.name ?? getSubTypeLabel(mov.subType)}
                    </span>
                    <span className="mt-1 block truncate text-[12px] text-[var(--ds-gray-600)] dark:text-[var(--ds-gray-300)]">
                      {mov.contact?.name || mov.transferLabel || mov.account?.name || mov.subcategory?.name || 'Sin contacto asociado'}
                    </span>
                  </span>
                  <span className="max-w-[42%] shrink-0 text-right [overflow-wrap:anywhere]">
                    <span className={`metric-value block text-[clamp(10px,3vw,14px)] font-bold ${
                      mov.isTransfer ? 'text-gray-600 dark:text-gray-300'
                        : isIncome ? 'text-[var(--income)]' : 'text-[var(--expense)]'
                    }`}>
                      {isIncome ? '+' : '−'}{fmtMoney(mov.amount, mov.currency)}
                    </span>
                    <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--ds-gray-500)]">
                      {status}
                    </span>
                    <span className="mt-1 block max-w-full truncate text-[10px] text-[var(--ds-gray-500)]">
                      {mov.isTransfer ? mov.transferLabel : mov.account?.name ?? 'Ver caja'}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full min-w-[860px] border-collapse text-xs">
              <thead>
                <tr className="border-y border-[var(--border-token)] bg-[var(--surface-muted)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                  <th className="px-5 py-3 text-left">Fecha</th>
                  <th className="px-5 py-3 text-left">Categoría</th>
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
                      id={`mov-${mov.id}`}
                      onClick={() => setDetalle(mov)}
                      title="Ver detalle"
                      className={`cursor-pointer border-b border-[var(--border-token)] border-l-[3px] transition-colors hover:bg-[var(--surface-muted)] ${
                      mov.isTransfer ? 'border-l-[#3F3F46]' : isIncome ? 'border-l-[var(--income)]' : 'border-l-[var(--expense)]'
                      } ${highlight && mov.id === targetRowId ? 'bg-[var(--expense-soft)]' : ''}`}
                    >
                      <td className="px-5 py-3 align-middle whitespace-nowrap">
                        <span className="text-sm font-medium text-[var(--ds-neutral-600)] dark:text-gray-300">{fmtDate(mov.date)}</span>
                      </td>

                      <td className="px-5 py-3 align-middle">
                        {/* Solo la categoría; la subcategoría, si hay, muy sutil debajo */}
                        <p className="whitespace-nowrap text-[13px] font-medium text-[var(--ds-gray-900)] dark:text-white">
                          {mov.isTransfer ? 'Cambio de caja' : mov.category?.name ?? getSubTypeLabel(mov.subType)}
                        </p>
                        {mov.subcategory && (
                          <p className="mt-0.5 whitespace-nowrap text-[11px] text-[var(--ds-gray-400)] dark:text-[var(--ds-gray-600)]">{mov.subcategory.name}</p>
                        )}
                      </td>

                      <td className="px-5 py-3 align-middle">
                        {mov.isTransfer
                          ? <span className="inline-flex rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600 dark:border-white/15 dark:bg-white/5 dark:text-gray-300">{isIncome ? 'Entra' : 'Sale'}</span>
                          : mov.parts && mov.parts.some((p) => p.esCredito) && mov.parts.some((p) => !p.esCredito)
                            ? <span className={`inline-flex rounded-full border bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide dark:bg-transparent ${
                                isIncome ? 'border-ds-green-300 text-ds-green-700 dark:text-ds-green-400' : 'border-ds-red-300 text-ds-red-600 dark:text-ds-red-300'
                              }`}>Parcial</span>
                            : <EstadoBadge type={mov.type} esCredito={mov.parts ? mov.parts.every((p) => p.esCredito) : esCredito} />}
                      </td>

                      <td className="px-5 py-3 align-middle">
                        <CajaCell mov={mov} />
                      </td>

                      <td className="px-5 py-3 align-middle">
                        {mov.contact?.name
                          ? <span className="text-sm text-gray-600 dark:text-gray-300">{mov.contact.name}</span>
                          : <span className="text-sm text-[var(--text-tertiary)]">—</span>
                        }
                      </td>

                      <td className="px-5 py-3 text-right align-middle whitespace-nowrap">
                        <span className={`metric-value text-sm font-bold ${
                          mov.isTransfer ? 'text-gray-600 dark:text-gray-300'
                            : isIncome ? 'text-[var(--income)]' : 'text-[var(--expense)]'
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
          </>
        )}

        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-[var(--border-token)] px-5 py-4">
            <p className="text-[11px] text-[var(--text-tertiary)]">
              {paginated.length} de {filtered.length}{cursor ? '+' : ''} movimientos cargados
            </p>
              {(hasMoreVisible || cursor) && (
              <button
                type="button"
                  disabled={loadingMore || shouldLoadAll}
                  onClick={() => {
                    if (hasMoreVisible) setPage((current) => current + 1)
                    else void loadNextPage()
                  }}
                  className="min-h-11 border border-[var(--ds-neutral-200)] bg-white px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-600 transition hover:border-brand-military hover:text-brand-military focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-military dark:border-white/10 dark:bg-[#16181b] dark:text-gray-300"
                >
                  {loadingMore ? 'Cargando…' : hasMoreVisible ? `Ver más (${filtered.length - paginated.length} cargados)` : 'Cargar más movimientos'}
                </button>
              )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Columna de grupo (Efectivo o Virtual) ──
/** Pide a la tabla de Movimientos que filtre por una caja (al tocar una subcaja) */
const EVENTO_FILTRAR_CAJA = 'cajas:filtrar-caja'

function CajaGroupColumn({
  label,
  group,
  variant = 'efectivo',
}: {
  label: string
  group: CajasGroupData
  variant?: 'efectivo' | 'virtual'
}) {
  const availableCurrencies = new Set(group.accounts.map((a) => a.currency))
  const defaultCurrency: CajaCurrency = availableCurrencies.has('ARS') ? 'ARS' : 'USD'
  const [selectedCurrency, setSelectedCurrency] = useState<CajaCurrency>(defaultCurrency)

  const filtered = group.accounts.filter(a => a.currency === selectedCurrency)
  const filteredTotal = filtered.reduce((s, a) => s + a.currentBalance, 0)
  const isNegative = filteredTotal < 0

  const tone = variant === 'virtual'
    ? {
        // Virtual: verde de marca
        selectorWrap: 'border-[var(--border-token)] bg-[var(--surface-muted)] dark:border-white/10 dark:bg-[var(--surface-muted)]',
        selectorActive: 'bg-[var(--brand-700)] text-white shadow-sm dark:bg-[#151515] dark:text-[#A8C89C] dark:ring-1 dark:ring-[#A8C89C]/35',
        selectorIdle: 'text-[var(--brand-700)] hover:text-[var(--income)] dark:text-[var(--brand-300)] dark:hover:text-[var(--brand-100)]',
      }
    : {
        // Efectivo: gris pizarra (no se confunde con ingresos, egresos ni ganancias)
        selectorWrap: 'border-[var(--border-token)] bg-[var(--surface-muted)] dark:border-white/10 dark:bg-[var(--surface-muted)]',
        selectorActive: 'bg-[var(--text-secondary)] text-white shadow-sm dark:bg-[#374151] dark:text-white',
        selectorIdle: 'text-[var(--text-secondary)] hover:text-[var(--text)] dark:text-[#98A4B8] dark:hover:text-[#D1D5DB]',
      }

  const filtrarPor = (nombre: string) => window.dispatchEvent(new CustomEvent(EVENTO_FILTRAR_CAJA, { detail: nombre }))

  return (
    <div className="cash-account-card flex h-full flex-col ds-panel bg-[var(--surface)] p-4 shadow-[0_1px_2px_rgba(5,31,32,0.04)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">{label}</h2>
        <span className="rounded-md bg-[var(--surface-muted)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Saldo operativo</span>
      </div>
      <p className={`metric-value mt-2 w-full text-[clamp(22px,2vw,30px)] font-semibold ${
        isNegative ? 'text-[var(--ds-red)] dark:text-[var(--ds-red-dark)]' : 'text-[var(--ds-gray-900)] dark:text-white'
      }`}>
        {isNegative ? '−' : ''}{fmtMoney(Math.abs(filteredTotal), selectedCurrency)}
      </p>

      {/* Subcajas adentro de la tarjeta (si hay más de una): tocás una y la tabla se filtra */}
      {filtered.length > 1 && (
        <ul className="mt-3 divide-y divide-[var(--border-token)] border-t border-[var(--border-token)]">
          {filtered.map((acc) => (
            <li key={acc.id}>
              <button
                type="button"
                onClick={() => filtrarPor(acc.name)}
                title={`Ver movimientos de ${acc.name}`}
                className="flex w-full items-center justify-between gap-3 py-3 text-left text-[14px] transition-colors hover:text-[var(--brand-700)] active:opacity-70"
              >
                <span className="min-w-0 truncate font-medium text-[var(--text)]">{acc.name}</span>
                <span className="metric-value flex w-28 shrink-0 items-center justify-end gap-1.5 text-[13px] text-[var(--ds-gray-700)] dark:text-[var(--ds-gray-200)]/80">
                  {fmtMoney(acc.currentBalance, acc.currency)}
                  <svg className="h-3 w-3 text-[var(--ds-gray-300)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-3">
        <div className={`inline-flex w-full items-center gap-1 rounded-lg border p-1 ${tone.selectorWrap}`}>
        {CAJA_CURRENCIES.map((currency) => {
          const isActive = selectedCurrency === currency
          const isAvailable = availableCurrencies.has(currency)
          return (
            <button
              key={currency}
              type="button"
              onClick={() => setSelectedCurrency(currency)}
              className={`min-h-9 flex-1 rounded-lg px-3 py-2 text-[11px] font-semibold transition ${
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
  )
}

// ── Componente principal ──
interface CajasClientProps {
  data: CajasData
  movements: CajasMovementItem[]
  movementCursor: CajasMovementCursor | null
  chartMovements: CajasMovementItem[]
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
  movementCursor,
  chartMovements,
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
      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 lg:gap-5">
        <CajaGroupColumn label="Efectivo" group={data.efectivo} variant="efectivo" />
        <CajaGroupColumn label="Virtual" group={data.virtual} variant="virtual" />
        <div className="md:col-span-2">
        <HistorialCard
          cashFlow={cashFlow}
          movements={chartMovements}
          period={period}
          customFrom={customFrom}
          customTo={customTo}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          selectedDay={selectedDay}
          selectedWeekStart={selectedWeekStart}
        />
        </div>
      </div>
      <MovementsPanel movements={movements} initialCursor={movementCursor} />
    </div>
  )
}

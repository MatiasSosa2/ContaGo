'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarPopover, RangeCalendar, rangeLabel } from './ui/IosCalendar'
import MovementDetailSheet from './cajas/MovementDetailSheet'
import { useStoredValue } from '@/lib/useStoredValue'
import { useSearchParams } from 'next/navigation'
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
} as const

/** Línea de saldo acumulado: azul petróleo (más claro en modo oscuro para que se lea) */
function useSaldoColor() {
  const [theme] = useStoredValue('theme')
  return theme === 'dark' ? '#0EA5E9' : '#075985'
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
    efectivo: 'bg-[#5E6C84]/15 text-[#5E6C84] dark:text-[#98A4B8]',
    virtual: 'bg-[#A2845E]/15 text-[#8A6D49] dark:text-[#C4A57E]',
    cambio: 'bg-black/[0.06] text-[#8E8E93] dark:bg-white/10',
    credito: 'bg-[#5E5CE6]/15 text-[#4B49C8] dark:text-[#9D9BF5]',
    deuda: 'bg-[#FF9F0A]/15 text-[#B86E00] dark:text-[#FFB340]',
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
      <span className="flex items-center gap-2 text-[13px] text-[#1C1C1E] dark:text-white">
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
      <span className="flex items-center gap-2 text-[13px] text-[#8E8E93]">
        <CajaIcon kind={mov.type === 'INCOME' ? 'credito' : 'deuda'} />
        {cuotasTxt ?? 'A crédito'}
      </span>
    )
  }
  return (
    <div className="min-w-0">
      <span className="flex items-center gap-2 text-[13px] text-[#1C1C1E] dark:text-white">
        <span className="flex shrink-0 -space-x-1.5">
          {tipos.map((t) => <CajaIcon key={t} kind={t} />)}
        </span>
        <span className="truncate">
          {nombres.join(' + ')}
          {cuotasTxt && <span className="text-[#8E8E93]"> + {cuotasTxt}</span>}
        </span>
      </span>
      {/* Pago combinado: el monto de cada caja, muy sutil */}
      {partes.length > 1 && (
        <p className="mt-0.5 truncate pl-[30px] text-[11px] tabular-nums text-[#AEAEB2] dark:text-[#636366]">
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
  const saldoColor = useSaldoColor()
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  const rows: [string, number, string][] = [
    ['Ingresos', point.ingresos, CHART_COLORS.ing],
    ['Egresos', point.egresos, CHART_COLORS.egr],
    ...(point.cambios !== 0 ? [['Cambio de moneda', point.cambios, '#71717A'] as [string, number, string]] : []),
    ['Saldo', point.saldo, saldoColor],
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
  const saldoColor = useSaldoColor()
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
                  <YAxis yAxisId="right" orientation="right" tickFormatter={fmtAxis} tick={{ fontSize: 10, fill: saldoColor }} axisLine={false} tickLine={false} width={52} />
                  <Tooltip cursor={{ fill: 'rgba(7,89,133,0.06)' }} content={(p) => <HistorialTooltip active={p.active} payload={p.payload as never} fmt={fmtSaldo} />} />
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
                      stroke={saldoColor}
                      strokeDasharray="4 4"
                      strokeOpacity={0.55}
                      label={{ value: 'Saldo inicial', position: 'insideTopRight', fill: saldoColor, fontSize: 10 }}
                    />
                  )}
                  <Bar yAxisId="left" dataKey="ingresos" fill="url(#modalIngFill)" radius={[4, 4, 0, 0] as [number, number, number, number]} maxBarSize={28} />
                  <Bar yAxisId="left" dataKey="egresos" fill="url(#modalEgrFill)" radius={[4, 4, 0, 0] as [number, number, number, number]} maxBarSize={28} />
                  <Line yAxisId="right" type="monotone" dataKey="saldo" stroke={saldoColor} strokeWidth={2.25} dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: saldoColor }} />
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
            <p className="mt-1 font-mono text-sm font-bold text-[#B42318] dark:text-[#E08580]">{fmtSaldo(summary.egresos)}</p>
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
  const saldoColor = useSaldoColor()
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
                  <Tooltip cursor={{ fill: 'rgba(7,89,133,0.06)' }} content={(p) => <HistorialTooltip active={p.active} payload={p.payload as never} fmt={fmtCompact} />} />
                  <Bar yAxisId="left" dataKey="ingresos" fill="url(#histIngFill)" radius={[2, 2, 0, 0] as [number, number, number, number]} maxBarSize={8} />
                  <Bar yAxisId="left" dataKey="egresos" fill="url(#histEgrFill)" radius={[2, 2, 0, 0] as [number, number, number, number]} maxBarSize={8} />
                  <Line yAxisId="right" type="monotone" dataKey="saldo" stroke={saldoColor} strokeWidth={2.25} dot={false} activeDot={{ r: 3.5, stroke: '#fff', strokeWidth: 1.5, fill: saldoColor }} />
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
              <p className="mt-0.5 font-mono text-[11px] font-bold text-[#B42318] dark:text-[#E08580]">{fmtCompact(summary.egresos)}</p>
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
  const minPage = targetIdx >= 0 ? Math.ceil((targetIdx + 1) / PAGE_SIZE) : 1
  const [highlight, setHighlight] = useState(true)
  useEffect(() => {
    if (!targetRowId) return
    document.getElementById(`mov-${targetRowId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => setHighlight(false), 2500)
    return () => clearTimeout(t)
  }, [targetRowId])

  const paginated = useMemo(() => filtered.slice(0, Math.max(page, minPage) * PAGE_SIZE), [filtered, page, minPage])
  const hasMore = paginated.length < filtered.length

  const originOptions: { key: OriginKey; label: string; active: string; idle: string }[] = [
    {
      key: 'efectivo',
      label: 'Efectivo',
      active: 'border-[#5E6C84] bg-[#5E6C84] text-white',
      idle: 'border-[#D9DEE6] bg-[#F4F6F9] text-[#4B576B] dark:border-[#333B48] dark:bg-[#161A20] dark:text-[#98A4B8]',
    },
    {
      key: 'virtual',
      label: 'Virtual',
      active: 'border-[#A2845E] bg-[#A2845E] text-white',
      idle: 'border-[#E8DDD0] bg-[#FAF6F1] text-[#8A6D49] dark:border-[#4A3D2E] dark:bg-[#1F1912] dark:text-[#C4A57E]',
    },
    {
      key: 'credito',
      label: 'Créditos',
      // Créditos (te deben): índigo
      active: 'border-[#5E5CE6] bg-[#5E5CE6] text-white',
      idle: 'border-[#D9D8F8] bg-[#F4F4FE] text-[#4B49C8] dark:border-[#2F2E5C] dark:bg-[#15142A] dark:text-[#9D9BF5]',
    },
    {
      key: 'deuda',
      label: 'Deudas',
      // Deudas (debés): ámbar
      active: 'border-[#FF9F0A] bg-[#FF9F0A] text-white',
      idle: 'border-[#FFE3B8] bg-[#FFF7EB] text-[#B86E00] dark:border-[#4D3510] dark:bg-[#21180A] dark:text-[#FFB340]',
    },
  ]

  return (
    <div ref={panelRef} className="scroll-mt-4 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
      <div className="border-b border-[#ECE7E1] bg-[#FAFBFC] px-5 pb-4 pt-5 dark:border-white/10 dark:bg-[#171717]">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center bg-brand-military-light text-brand-military dark:bg-[#162019] dark:text-[#9AC7A8]">
            <MovementIcon />
          </div>
          <h3 className="text-base font-semibold text-[#1F2937] dark:text-[#E8E8E8]">Movimientos</h3>
          {detalle && (
          <MovementDetailSheet
            mov={detalle}
            titulo={detalle.isTransfer ? 'Cambio de caja' : getSubTypeLabel(detalle.subType)}
            onClose={() => setDetalle(null)}
          />
        )}

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
            {/* Un solo calendario iOS de rango (desde–hasta) */}
            <button
              ref={fechasRef}
              type="button"
              onClick={() => setFechasOpen((v) => !v)}
              aria-expanded={fechasOpen}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[14px] text-[#1C1C1E] shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04] transition active:scale-[0.99] dark:bg-[#1C1C1E] dark:text-white dark:ring-white/10"
            >
              <svg className="h-4 w-4 text-[#007AFF] dark:text-[#0A84FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <span className={dateFrom ? '' : 'text-[#8E8E93]'}>{rangeLabel(rangoFechas) ?? 'Todas las fechas'}</span>
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
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium text-stone-500 dark:text-stone-400">No hay movimientos que coincidan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-xs">
              <thead>
                <tr className="border-y border-[#ECE7E1] bg-[#FAFBFC] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B7280] dark:border-white/10 dark:bg-[#171717] dark:text-stone-400">
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
                      className={`cursor-pointer border-b border-[#ECE7E1] transition-colors duration-700 hover:bg-[#FAFBFA] dark:border-white/5 dark:hover:bg-white/[0.03] border-l-[3px] ${
                        mov.isTransfer ? 'border-l-[#3F3F46]' : isIncome ? 'border-l-[#3A4D39]' : 'border-l-[#A65D57]'
                      } ${highlight && mov.id === targetRowId ? 'bg-[#FFF4D6] dark:bg-[#3A3220]' : ''}`}
                    >
                      <td className="px-5 py-3 align-middle whitespace-nowrap">
                        <span className="text-sm font-medium text-[#4B5563] dark:text-stone-300">{fmtDate(mov.date)}</span>
                      </td>

                      <td className="px-5 py-3 align-middle">
                        {/* Solo la categoría; la subcategoría, si hay, muy sutil debajo */}
                        <p className="whitespace-nowrap text-[13px] font-medium text-[#1C1C1E] dark:text-white">
                          {mov.isTransfer ? 'Cambio de caja' : mov.category?.name ?? getSubTypeLabel(mov.subType)}
                        </p>
                        {mov.subcategory && (
                          <p className="mt-0.5 whitespace-nowrap text-[11px] text-[#AEAEB2] dark:text-[#636366]">{mov.subcategory.name}</p>
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
                        <CajaCell mov={mov} />
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
/** Pide a la tabla de Movimientos que filtre por una caja (al tocar una subcaja) */
const EVENTO_FILTRAR_CAJA = 'cajas:filtrar-caja'

function CajaGroupColumn({
  label,
  group,
  variant = 'military',
}: {
  label: string
  group: CajasGroupData
  variant?: 'military' | 'gold'
}) {
  const availableCurrencies = new Set(group.accounts.map((a) => a.currency))
  const defaultCurrency: CajaCurrency = availableCurrencies.has('ARS') ? 'ARS' : 'USD'
  const [selectedCurrency, setSelectedCurrency] = useState<CajaCurrency>(defaultCurrency)

  const filtered = group.accounts.filter(a => a.currency === selectedCurrency)
  const filteredTotal = filtered.reduce((s, a) => s + a.currentBalance, 0)
  const isNegative = filteredTotal < 0

  const tone = variant === 'gold'
    ? {
        // Virtual: marrón cuero
        selectorWrap: 'border-[#E8DDD0] bg-[#FAF6F1] dark:border-[#4A3D2E] dark:bg-[#1F1912]',
        selectorActive: 'bg-[#A2845E] text-white shadow-sm dark:bg-[#8A6D49] dark:text-white',
        selectorIdle: 'text-[#8A6D49] hover:text-[#6B5338] dark:text-[#C4A57E] dark:hover:text-[#E3CBA9]',
      }
    : {
        // Efectivo: azul pizarra (no se confunde con ingresos, egresos ni ganancias)
        selectorWrap: 'border-[#D9DEE6] bg-[#F4F6F9] dark:border-[#333B48] dark:bg-[#161A20]',
        selectorActive: 'bg-[#5E6C84] text-white shadow-sm dark:bg-[#4B576B] dark:text-white',
        selectorIdle: 'text-[#4B576B] hover:text-[#38414F] dark:text-[#98A4B8] dark:hover:text-[#C3CCD9]',
      }

  const filtrarPor = (nombre: string) => window.dispatchEvent(new CustomEvent(EVENTO_FILTRAR_CAJA, { detail: nombre }))

  return (
    <div className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.03)] dark:bg-[#1C1C1E] dark:shadow-none">
      {/* Título suave y saldo grande (estilo iOS) */}
      <h2 className="text-[13px] font-medium text-[#8E8E93]">{label}</h2>
      <p className={`mt-1 text-[36px] font-semibold leading-tight tracking-tight tabular-nums ${
        isNegative ? 'text-[#FF3B30] dark:text-[#FF453A]' : 'text-[#1C1C1E] dark:text-white'
      }`}>
        {isNegative ? '−' : ''}{fmtMoney(Math.abs(filteredTotal), selectedCurrency)}
      </p>

      {/* Subcajas adentro de la tarjeta (si hay más de una): tocás una y la tabla se filtra */}
      {filtered.length > 1 && (
        <ul className="mt-4 divide-y divide-black/[0.06] border-t border-black/[0.06] dark:divide-white/[0.08] dark:border-white/[0.08]">
          {filtered.map((acc) => (
            <li key={acc.id}>
              <button
                type="button"
                onClick={() => filtrarPor(acc.name)}
                title={`Ver movimientos de ${acc.name}`}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-[14px] transition-opacity active:opacity-60"
              >
                <span className="min-w-0 truncate text-[#1C1C1E] dark:text-white">{acc.name}</span>
                <span className="flex shrink-0 items-center gap-1.5 tabular-nums text-[#3C3C43] dark:text-[#EBEBF5]/80">
                  {fmtMoney(acc.currentBalance, acc.currency)}
                  <svg className="h-3 w-3 text-[#C7C7CC]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Empuja Pesos/USD al pie: queda a la misma altura en las dos tarjetas, tengan o no subcajas */}
      <div className="min-h-6 flex-1" aria-hidden />
      <div className={`inline-flex w-full items-center gap-1 border p-1 ${tone.selectorWrap}`}>
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
        <CajaGroupColumn label="Efectivo" group={data.efectivo} variant="military" />
        <CajaGroupColumn label="Virtual" group={data.virtual} variant="gold" />
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

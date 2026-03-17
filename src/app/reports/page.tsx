import { getReportDataExtended } from '@/app/actions'
import type { DateRange } from '@/lib/validations'
import ReportTable from '@/components/ReportTable'
import { CashFlowAreaChart, DonutChart, HorizontalBars, Sparkline } from '@/components/ReportCharts'
import PuntoEquilibrio from '@/components/PuntoEquilibrio'
import PrintButton from '@/components/PrintButton'
import PeriodFilter from '@/components/PeriodFilter'
import { requirePageSession } from '@/server/auth/require-page-session'
import Link from 'next/link'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

const CURRENCY_SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$' }
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MILITARY = '#4A6741'
const GOLD = '#C5A065'

function fmt(v: number, cur = 'ARS') {
  return `${CURRENCY_SYMBOL[cur] || '$'}${v.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`
}

function formatMonth(key: string) {
  const [year, month] = key.split('-')
  return `${MONTH_NAMES[parseInt(month) - 1]} ${year.slice(2)}`
}

type PanelAccent = 'military' | 'dark' | 'light'
type PanelVariant = 'hero' | 'stat' | 'standard'

function Panel({
  title, accent = 'military', variant = 'standard', children, className = '', action,
}: {
  title: string; accent?: PanelAccent; variant?: PanelVariant; children: React.ReactNode; className?: string; action?: React.ReactNode
}) {
  const header =
    accent === 'military' ? 'bg-brand-military/90'
    : accent === 'dark'   ? 'bg-brand-carbon'
    :                        'bg-brand-slate'
  const titleColor = accent === 'light' ? 'text-gray-600' : 'text-white'
  const variantClass =
    variant === 'hero' ? 'bg-brand-carbon text-white'
    : variant === 'stat' ? 'bg-white'
    : 'bg-white'
  return (
    <div
      className={`${variantClass} rounded-2xl flex flex-col overflow-hidden ${className}`}
      style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.02)' }}
    >
      <div className={`${header} px-5 py-3.5 flex items-center justify-between shrink-0`}>
        <h2 className={`text-sm font-medium ${titleColor}`}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function KpiTile({
  label, value, sub, trend, delta, highlight = false, dark = false, gold = false,
}: {
  label: string; value: string; sub?: string; trend?: number[]; delta?: number; highlight?: boolean; dark?: boolean; gold?: boolean
}) {
  const bg = dark
    ? 'bg-brand-carbon'
    : gold
    ? 'bg-brand-gold-light'
    : highlight
    ? 'bg-brand-military-light'
    : 'bg-white'
  const labelColor = dark ? 'text-gray-400' : gold ? 'text-gray-500' : highlight ? 'text-gray-500' : 'text-gray-400'
  const valueColor = dark ? 'text-white' : gold ? 'text-[#1A1A1A]' : highlight ? 'text-[#1A1A1A]' : 'text-[#1A1A1A]'
  const subColor = dark ? 'text-gray-500' : 'text-gray-500'
  const deltaPositive = delta !== undefined && delta >= 0
  const deltaColor = dark
    ? (deltaPositive ? 'text-green-300' : 'text-red-300')
    : (deltaPositive ? 'text-brand-military-dark' : 'text-red-500')
  return (
    <div
      className={`${bg} rounded-2xl flex flex-col justify-between min-h-[120px] p-5`}
      style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.02)' }}
    >
      <div>
        <div className="flex items-start justify-between mb-3">
          <p className={`text-xs font-medium leading-relaxed ${labelColor}`}>{label}</p>
          {delta !== undefined && (
            <span className={`text-xs font-medium font-mono ${deltaColor} ml-2 shrink-0 px-2 py-0.5 rounded-full bg-black/[0.04]`}>
              {deltaPositive ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}%
            </span>
          )}
        </div>
        <p className={`font-mono text-3xl font-light tracking-tight leading-none ${valueColor}`}>{value}</p>
        {sub && <p className={`text-xs mt-2 font-normal leading-relaxed ${subColor}`}>{sub}</p>}
      </div>
      {trend && trend.length > 1 && (
        <div className="mt-3 -mx-1">
          <Sparkline data={trend} color={dark ? '#4A6741' : gold ? GOLD : MILITARY} />
        </div>
      )}
    </div>
  )
}

function DonutLegend({ label, color, value, pct }: { label: string; color: string; value: string; pct: number }) {
  return (
    <div className="flex items-center justify-between py-2.5 last:border-0">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-sm font-medium text-gray-600">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-1 w-20 bg-gray-100 rounded-full">
          <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="text-sm font-light font-mono text-[#1A1A1A] w-28 text-right">{value}</span>
      </div>
    </div>
  )
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{ preset?: string; from?: string; to?: string }>
}) {
  await requirePageSession()
  const params = await searchParams
  const range: DateRange | undefined =
    params?.from || params?.to
      ? {
          from: params.from ? new Date(params.from + 'T00:00:00') : undefined,
          to:   params.to   ? new Date(params.to   + 'T23:59:59') : undefined,
        }
      : undefined

  const { allTx, totalsByCurrency, monthlyHistory, topCategories, topContacts, accountTotalByCurrency, topAreas, activosPorMoneda, pasivosPorMoneda, cxcPorMoneda, flujo, anualMap, cmvTotal, valorInventario, valorInventarioVenta, margenBrutoInventario, topProductosPorStock } = await getReportDataExtended(range)

  const now = new Date()
  const cur = 'ARS'
  const sym = CURRENCY_SYMBOL[cur]

  const totals = totalsByCurrency[cur] || { income: 0, expense: 0 }
  const balance = totals.income - totals.expense

  // Margen de utilidad %
  const marginPct = totals.income > 0 ? ((totals.income - totals.expense) / totals.income) * 100 : 0
  const gananciaBruta = totals.income - (cmvTotal || 0)
  const gananciaNeta = gananciaBruta - totals.expense

  // Runway: saldo real de cuentas / promedio mensual de gastos (últimos 3 meses)
  const accountBalance = accountTotalByCurrency[cur] || 0
  const last3Months = monthlyHistory.slice(-3)
  const avgMonthlyExpense = last3Months.length > 0
    ? last3Months.reduce((s, m) => s + (m.byCur[cur]?.expense || 0), 0) / last3Months.length
    : 0
  const runwayMonths = avgMonthlyExpense > 0 ? accountBalance / avgMonthlyExpense : null

  const monthlyData = [...monthlyHistory].reverse().map(({ month, byCur }) => {
    const d = byCur[cur] || { income: 0, expense: 0 }
    return { month, income: d.income, expense: d.expense, label: formatMonth(month) }
  })

  const incomeSpark = monthlyData.slice(-6).map(d => d.income)
  const expenseSpark = monthlyData.slice(-6).map(d => d.expense)
  const balanceSpark = monthlyData.slice(-6).map(d => d.income - d.expense)

  const donutSlices = [
    { name: 'Ingresos', value: totals.income, color: MILITARY },
    { name: 'Gastos',   value: totals.expense, color: '#d1d5db' },
  ]

  const catMax = Math.max(...topCategories.map(c => c.income + c.expense), 1)
  const conMax = Math.max(...topContacts.map(c => c.income + c.expense), 1)

  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const currentMonthData = monthlyHistory.find(m => m.month === currentMonthKey)
  const cmARS = currentMonthData?.byCur[cur] || { income: 0, expense: 0 }

  // Delta vs mes anterior
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const prevMonthData = monthlyHistory.find(m => m.month === prevMonthKey)
  const pmARS = prevMonthData?.byCur[cur] || { income: 0, expense: 0 }
  const deltaIncome = pmARS.income > 0 ? ((cmARS.income - pmARS.income) / pmARS.income) * 100 : undefined
  const deltaExpense = pmARS.expense > 0 ? ((cmARS.expense - pmARS.expense) / pmARS.expense) * 100 : undefined
  const deltaBalance = pmARS.income > 0 || pmARS.expense > 0
    ? (() => { const prev = pmARS.income - pmARS.expense; return prev !== 0 ? (((cmARS.income - cmARS.expense) - prev) / Math.abs(prev)) * 100 : undefined })()
    : undefined
  const deltaTotals = totals
  const deltaTotalsPrev = pmARS
  const deltaIncomeTotal = deltaTotalsPrev.income > 0 ? ((deltaTotals.income - deltaTotalsPrev.income) / deltaTotalsPrev.income) * 100 : undefined
  const deltaExpenseTotal = deltaTotalsPrev.expense > 0 ? ((deltaTotals.expense - deltaTotalsPrev.expense) / deltaTotalsPrev.expense) * 100 : undefined

  // Executive Summary — insights categorizados
  const cxcTotal = Object.values(cxcPorMoneda).reduce((s, v) => s + v, 0)
  const riesgos: string[] = []
  const oportunidades: string[] = []
  const proximosPasos: string[] = []

  if (deltaIncome !== undefined) {
    if (deltaIncome > 10) oportunidades.push(`Ingresos ${deltaIncome.toFixed(0)}% por encima del mes anterior. Tendencia de crecimiento sostenida.`)
    else if (deltaIncome < -10) riesgos.push(`Los ingresos cayeron ${Math.abs(deltaIncome).toFixed(0)}% vs el mes anterior. Revisar pipeline de cobranzas.`)
  }
  if (deltaExpense !== undefined && deltaExpense > 15) {
    riesgos.push(`Gastos del mes crecieron ${deltaExpense.toFixed(0)}% vs el mes anterior. Desvío significativo.`)
    proximosPasos.push('Identificar las categorías de mayor variación en gastos y establecer topes.')
  }
  if (cxcTotal > 0) {
    oportunidades.push(`${fmt(cxcTotal, cur)} en cuentas por cobrar. Cobrar hoy impacta el flujo de caja de inmediato.`)
    proximosPasos.push('Priorizar la gestión de cobranza de las cuentas por cobrar pendientes.')
  }
  if (runwayMonths !== null && runwayMonths < 3) {
    riesgos.push(`Runway crítico: ${runwayMonths.toFixed(1)} meses de cobertura con el ritmo actual de gastos.`)
  } else if (runwayMonths !== null && runwayMonths >= 6) {
    oportunidades.push(`Runway de ${runwayMonths.toFixed(1)} meses. Liquidez suficiente para planificar inversiones.`)
  }
  if (marginPct < 20 && totals.income > 0) {
    riesgos.push(`Margen en ${marginPct.toFixed(1)}%. Solo $${marginPct.toFixed(0)} de ganancia neta por cada $100 de ventas.`)
    proximosPasos.push('Revisar la estructura de costos para elevar el margen por encima del 20%.')
  } else if (marginPct >= 50) {
    oportunidades.push(`Margen saludable del ${marginPct.toFixed(1)}%. La estructura de costos está bien controlada.`)
  }
  if (valorInventario > totals.income * 0.5) {
    proximosPasos.push(`Inventario (${fmt(valorInventario, cur)}) supera el 50% de ingresos. Evaluá la rotación de stock.`)
  }
  if (riesgos.length === 0) riesgos.push('Sin alertas críticas identificadas en el período actual.')
  if (oportunidades.length === 0) oportunidades.push('Registrá más transacciones para identificar oportunidades de optimización.')
  if (proximosPasos.length === 0) proximosPasos.push('Mantener el monitoreo mensual de KPIs para detectar tendencias a tiempo.')

  return (
    <div className="p-8 max-w-[1920px] mx-auto font-sans text-gray-800 min-h-screen">

      <header className="mb-8 flex flex-col md:flex-row justify-between items-end gap-4 pb-6">
        <div>
          <p className="text-xs font-medium text-brand-gold mb-1">Conta Go</p>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Dashboard de Reportes</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            {MONTH_NAMES[now.getMonth()]} {now.getFullYear()} &middot; Moneda base: {cur}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <Suspense fallback={null}>
            <PeriodFilter />
          </Suspense>
          <Link href="/" className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-brand-military transition-colors px-4 py-2.5 bg-white rounded-xl no-print"
            style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.02)' }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            Panel Principal
          </Link>
          <PrintButton />
        </div>
      </header>

      {/* Sección 1: Hook (Atmósfera A) */}
      <section className="mb-6 rounded-2xl bg-brand-carbon text-white p-6"
        style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.02)' }}>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-sm text-gray-400">Resumen ejecutivo</p>
            <h2 className="text-2xl font-medium">Cierre financiero del período</h2>
          </div>
          <p className="text-sm text-gray-400">{MONTH_NAMES[now.getMonth()]} {now.getFullYear()} · {cur}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <div className="rounded-2xl bg-white/[0.04] p-5">
            <p className="text-xs text-gray-400">Ganancia neta</p>
            <p className={`text-4xl font-mono font-light mt-2 ${gananciaNeta >= 0 ? 'text-white' : 'text-red-300'}`}>
              {gananciaNeta >= 0 ? '+' : ''}{fmt(gananciaNeta, cur)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/[0.04] p-5">
            <p className="text-xs text-gray-400">Flujo neto</p>
            <p className={`text-4xl font-mono font-light mt-2 ${balance >= 0 ? 'text-white' : 'text-red-300'}`}>
              {balance >= 0 ? '+' : ''}{fmt(balance, cur)}
            </p>
          </div>
        </div>
      </section>

      {/* EXECUTIVE BRIEFING — 3 columnas */}
      <div className="mb-6 bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.02)' }}>
        {/* Header */}
        <div className="px-6 py-3.5 bg-brand-slate flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-brand-military/70">ContaGo · Informe ejecutivo</p>
            <p className="text-sm font-medium text-gray-700 mt-0.5">
              {MONTH_NAMES[now.getMonth()]} {now.getFullYear()} &middot; {cur}
            </p>
          </div>
          <span className="text-xs font-medium text-gray-500 px-2.5 py-1 rounded-full bg-white">Análisis automático</span>
        </div>
        {/* 3 columnas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-1 bg-gray-50/40 p-1">
          {/* RIESGOS */}
          <div className="px-6 py-5 bg-white rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-3.5 h-3.5 text-brand-gold shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <span className="text-xs font-medium text-gray-500">Riesgos</span>
            </div>
            <ul className="space-y-2.5">
              {riesgos.map((r, i) => (
                <li key={i} className="text-sm text-gray-600 font-normal leading-relaxed">{r}</li>
              ))}
            </ul>
          </div>
          {/* OPORTUNIDADES */}
          <div className="px-6 py-5 bg-white rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-3.5 h-3.5 text-brand-gold shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
              </svg>
              <span className="text-xs font-medium text-gray-500">Oportunidades</span>
            </div>
            <ul className="space-y-2.5">
              {oportunidades.map((o, i) => (
                <li key={i} className="text-sm text-gray-600 font-normal leading-relaxed">{o}</li>
              ))}
            </ul>
          </div>
          {/* PRÓXIMOS PASOS */}
          <div className="px-6 py-5 bg-white rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-3.5 h-3.5 text-brand-military shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <span className="text-xs font-medium text-gray-500">Próximos pasos</span>
            </div>
            <ul className="space-y-2.5">
              {proximosPasos.map((p, i) => (
                <li key={i} className="text-sm text-gray-500 font-normal leading-relaxed">{p}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* KPI TILES — con deltas vs mes anterior */}
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <KpiTile
          label={`Ingresos Totales ${cur}`}
          value={fmt(totals.income, cur)}
          sub={`${allTx.filter(t => t.type === 'INCOME').length} transacciones`}
          trend={incomeSpark}
          delta={deltaIncomeTotal}
          highlight
        />
        <KpiTile
          label={`Gastos Totales ${cur}`}
          value={fmt(totals.expense, cur)}
          sub={`${allTx.filter(t => t.type === 'EXPENSE').length} transacciones`}
          trend={expenseSpark}
          delta={deltaExpenseTotal !== undefined ? -deltaExpenseTotal : undefined}
        />
        <KpiTile
          label={`Balance Neto ${cur}`}
          value={(balance >= 0 ? '+' : '') + fmt(balance, cur)}
          sub={balance >= 0 ? 'Resultado positivo' : 'Resultado negativo'}
          trend={balanceSpark}
          delta={deltaBalance}
        />
        <KpiTile
          label="Margen de Utilidad"
          value={(marginPct >= 0 ? '+' : '') + marginPct.toFixed(1) + '%'}
          sub={marginPct >= 60 ? 'Excelente' : marginPct >= 30 ? 'Saludable' : marginPct >= 0 ? 'Ajustado' : 'En rojo'}
          gold
        />
        <KpiTile
          label="Runway (supervivencia)"
          value={runwayMonths !== null ? `${runwayMonths.toFixed(1)} meses` : 'N/A'}
          sub={runwayMonths !== null ? `Saldo: ${fmt(accountBalance, cur)}` : 'Sin gastos registrados'}
        />
        <KpiTile
          label="Este Mes"
          value={fmt(cmARS.income, cur)}
          sub={`Gastos: ${fmt(cmARS.expense, cur)}`}
          delta={deltaIncome}
        />
      </section>

      {/* TRAYECTORIA — Flujo de Fondos Hero (66%) + Distribución (33%) */}
      <div className="grid grid-cols-1 xl:grid-cols-[7fr_3fr] gap-6 mb-6">
        <Panel title={`Flujo de Fondos · Evolución Mensual (${cur})`} accent="light" variant="hero" className="xl:col-span-2">
          <div className="p-5">
            <div className="flex items-center gap-5 mb-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <span className="w-3 h-1.5 rounded-full inline-block" style={{ background: MILITARY }} /> Ingresos
              </span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                <span className="w-3 h-1.5 rounded-full inline-block bg-gray-300" /> Gastos
              </span>
              <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-brand-gold">
                <span className="w-2.5 h-2.5 rounded-full inline-block bg-brand-gold" />
                Pico máximo de ingresos
              </span>
            </div>
            <CashFlowAreaChart data={monthlyData} symbol={sym} />
          </div>
        </Panel>

        <Panel title="Distribución Total" accent="dark" variant="stat">
          <div className="p-5 flex flex-col gap-4">
            <DonutChart slices={donutSlices} symbol={sym} centerLabel="Total" />
            <div className="px-1">
              <DonutLegend
                label="Ingresos"
                color={MILITARY}
                value={fmt(totals.income, cur)}
                pct={totals.income + totals.expense > 0 ? (totals.income / (totals.income + totals.expense)) * 100 : 0}
              />
              <DonutLegend
                label="Gastos"
                color="#d1d5db"
                value={fmt(totals.expense, cur)}
                pct={totals.income + totals.expense > 0 ? (totals.expense / (totals.income + totals.expense)) * 100 : 0}
              />
              <DonutLegend
                label="Balance"
                color={balance >= 0 ? MILITARY : '#ef4444'}
                value={(balance >= 0 ? '+' : '') + fmt(balance, cur)}
                pct={100}
              />
            </div>
          </div>
        </Panel>
      </div>

      {/* CATEGORÍAS + CONTACTOS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <Panel title="Top Categorías" accent="dark" variant="stat">
          {topCategories.length === 0
            ? <div className="p-8 text-center text-sm text-gray-300 font-medium">Sin datos</div>
            : (
              <>
                <div className="px-5 py-2.5 flex gap-4 bg-gray-50">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                    <span className="w-2 h-2 rounded-full bg-brand-military inline-block" /> Ingresos
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                    <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> Gastos
                  </span>
                </div>
                <HorizontalBars items={topCategories} max={catMax} symbol={sym} />
              </>
            )}
        </Panel>

        <Panel title="Top Contactos" accent="light">
          {topContacts.length === 0
            ? <div className="p-8 text-center text-sm text-gray-300 font-medium">Sin datos</div>
            : (
              <>
                <div className="px-5 py-2.5 flex gap-4 bg-gray-50">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                    <span className="w-2 h-2 rounded-full bg-brand-military inline-block" /> Ingresos
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                    <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> Gastos
                  </span>
                </div>
                <HorizontalBars items={topContacts} max={conMax} symbol={sym} />
              </>
            )}
        </Panel>
      </div>

      {/* TABLA */}
      <Panel title="Movimientos Detallados" accent="military">
        {/* cast: Prisma include types se pierden en el spread de getReportDataExtended */}
        <ReportTable transactions={allTx as unknown as Parameters<typeof ReportTable>[0]['transactions']} />
      </Panel>

      {/* ÁREAS DE NEGOCIO */}
      {topAreas.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
          <Panel title="Top Áreas de Negocio" accent="military" variant="hero">
            <div className="divide-y divide-gray-100">
              {topAreas.map((a, i) => {
                const total = a.income + a.expense
                const maxVal = Math.max(...topAreas.map(x => x.income + x.expense), 1)
                const pct = (total / maxVal) * 100
                return (
                  <div key={i} className="px-5 py-3.5">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-semibold text-gray-700">{a.nombre}</span>
                      <div className="flex gap-4 text-[10px] font-mono">
                        <span className="text-brand-military-dark font-light font-mono">{fmt(a.income, cur)}</span>
                        <span className="text-gray-400">{fmt(a.expense, cur)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className="h-1.5 bg-brand-military rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>

          {/* COMPARATIVA ANUAL */}
          <Panel title="Comparativa Anual" accent="dark" variant="stat">
            <div className="p-5 space-y-4">
              {Object.entries(anualMap).map(([year, byCur]) => (
                <div key={year} className="rounded-2xl overflow-hidden bg-gray-50/60">
                  <div className="bg-gray-50 px-4 py-2.5">
                    <span className="text-sm font-medium text-gray-500">{year}</span>
                  </div>
                  {Object.keys(byCur).length === 0 ? (
                    <div className="px-4 py-3 text-[10px] text-gray-300 font-medium">Sin datos</div>
                  ) : Object.entries(byCur).map(([c, d]) => (
                    <div key={c} className="px-4 py-3 grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">{c} — Ingresos</p>
                        <p className="text-sm font-light font-mono text-brand-military-dark">{fmt(d.income, c)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Gastos</p>
                        <p className="text-sm font-light font-mono text-gray-600">{fmt(d.expense, c)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Balance</p>
                        <p className={`text-sm font-light font-mono ${d.income - d.expense >= 0 ? 'text-brand-military-dark' : 'text-red-500'}`}>
                          {d.income - d.expense >= 0 ? '+' : ''}{fmt(d.income - d.expense, c)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* BENTO NIVEL 4: Patrimonial + Flujo de Fondos */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
        <Panel title="Estado de Situación Patrimonial" accent="military" variant="stat">
          <div className="p-5 space-y-3">
            {Object.keys(activosPorMoneda).length === 0 ? (
              <div className="text-sm text-gray-300 text-center py-6 font-medium">Sin datos de cuentas</div>
            ) : Object.entries(activosPorMoneda).map(([c, activos]) => {
              const pasivos = pasivosPorMoneda[c] || 0
              const cxc = cxcPorMoneda[c] || 0
              const patrimonioNeto = activos + cxc - pasivos
              return (
                <div key={c} className="rounded-2xl overflow-hidden bg-gray-50/60">
                  <div className="bg-gray-50 px-4 py-2.5 flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600">{c}</span>
                  </div>

                  <div className="divide-y divide-gray-50">
                    <div className="px-4 py-3 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-medium text-brand-military mb-0.5">Activos</p>
                        <p className="text-[9px] text-gray-400">Saldo en cuentas bancarias y efectivo</p>
                      </div>
                      <p className="font-light font-mono text-brand-military-dark">{fmt(activos, c)}</p>
                    </div>
                    {cxc > 0 && (
                      <div className="px-4 py-3 flex justify-between items-center">
                        <div>
                          <p className="text-xs font-medium text-brand-military/70 mb-0.5">+ CxC pendiente</p>
                          <p className="text-[9px] text-gray-400">Lo que nos deben cobrar</p>
                        </div>
                        <p className="font-light font-mono text-brand-military/80">{fmt(cxc, c)}</p>
                      </div>
                    )}
                    {pasivos > 0 && (
                      <div className="px-4 py-3 flex justify-between items-center">
                        <div>
                          <p className="text-xs font-medium text-brand-gold-dark mb-0.5">− Pasivos (CxP)</p>
                          <p className="text-[9px] text-gray-400">Lo que debemos pagar</p>
                        </div>
                        <p className="font-light font-mono text-brand-gold-dark">−{fmt(pasivos, c)}</p>
                      </div>
                    )}
                    <div className="px-4 py-4 flex justify-between items-center bg-brand-carbon">
                      <p className="text-sm font-medium text-brand-gold">Patrimonio neto</p>
                      <p className={`font-light font-mono text-lg ${patrimonioNeto >= 0 ? 'text-white' : 'text-red-400'}`}>
                        {patrimonioNeto >= 0 ? '+' : ''}{fmt(patrimonioNeto, c)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>

        {/* FLUJO DE FONDOS */}
        <Panel title="Estado de Flujo de Fondos" accent="dark" variant="stat">
          <div className="p-5 space-y-3">
            {Object.keys(flujo).length === 0 ? (
              <div className="text-sm text-gray-300 text-center py-6 font-medium">Sin transacciones</div>
            ) : Object.entries(flujo).map(([c, { operativo, inversion, financiero }]) => {
              const flujoTotal = operativo + inversion + financiero
              return (
                <div key={c} className="rounded-2xl overflow-hidden bg-gray-50/60">
                  <div className="bg-gray-50 px-4 py-2.5">
                    <span className="text-sm font-medium text-gray-600">{c}</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    <div className="px-4 py-3 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-medium text-brand-military mb-0.5">Actividades operativas</p>
                        <p className="text-[9px] text-gray-400">Ventas, compras, sueldos</p>
                      </div>
                      <p className={`font-light font-mono ${operativo >= 0 ? 'text-brand-military-dark' : 'text-red-500'}`}>
                        {operativo >= 0 ? '+' : ''}{fmt(operativo, c)}
                      </p>
                    </div>
                    <div className="px-4 py-3 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-medium text-brand-gold-dark mb-0.5">Actividades de inversión</p>
                        <p className="text-[9px] text-gray-400">Equipos, activos, infraestructura</p>
                      </div>
                      <p className={`font-light font-mono ${inversion >= 0 ? 'text-brand-military-dark' : 'text-red-500'}`}>
                        {inversion >= 0 ? '+' : ''}{fmt(inversion, c)}
                      </p>
                    </div>
                    <div className="px-4 py-3 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-0.5">Actividades financieras</p>
                        <p className="text-[9px] text-gray-400">Préstamos, créditos, dividendos</p>
                      </div>
                      <p className={`font-light font-mono ${financiero >= 0 ? 'text-brand-military-dark' : 'text-red-500'}`}>
                        {financiero >= 0 ? '+' : ''}{fmt(financiero, c)}
                      </p>
                    </div>
                    <div className="px-4 py-4 flex justify-between items-center bg-brand-carbon">
                      <p className="text-sm font-medium text-brand-gold">Flujo neto total</p>
                      <p className={`font-light font-mono text-lg ${flujoTotal >= 0 ? 'text-white' : 'text-red-400'}`}>
                        {flujoTotal >= 0 ? '+' : ''}{fmt(flujoTotal, c)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>

      {/* BENTO NIVEL 3: Estado de Resultados + Punto de Equilibrio */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">

        {/* ESTADO DE RESULTADOS — hero: col izquierda full height */}
        <Panel title="Estado de Resultados" accent="light" variant="hero">
          <div className="p-5">
            {(() => {
              const ventas = totals.income
              const cmv = cmvTotal || 0
              const gananciaBruta = ventas - cmv
              const gastosOperativos = totals.expense
              const gananciaNeta = gananciaBruta - gastosOperativos
              const margenBrutoPct = ventas > 0 ? (gananciaBruta / ventas) * 100 : 0
              const margenNetoPct = ventas > 0 ? (gananciaNeta / ventas) * 100 : 0
              return (
                <div className="divide-y divide-gray-50">
                  <div className="flex justify-between items-center py-3">
                    <div>
                      <p className="text-xs font-medium text-brand-military">Ventas / ingresos</p>
                      <p className="text-[9px] text-gray-400">Ingresos operativos totales</p>
                    </div>
                    <p className="font-light font-mono text-brand-military-dark">{fmt(ventas, cur)}</p>
                  </div>
                  <div className="flex justify-between items-center py-3">
                    <div>
                      <p className="text-xs font-medium text-brand-gold-dark">− CMV</p>
                      <p className="text-[9px] text-gray-400">Costo de mercadería vendida (salidas de stock)</p>
                    </div>
                    <p className="font-light font-mono text-brand-gold-dark">{cmv > 0 ? `−${fmt(cmv, cur)}` : fmt(0, cur)}</p>
                  </div>
                  <div className="flex justify-between items-center py-3 bg-brand-military-light/30 px-3 -mx-3 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-brand-military-dark">Ganancia bruta</p>
                      <p className="text-[9px] text-brand-military/60">Margen bruto: {margenBrutoPct.toFixed(1)}%</p>
                    </div>
                    <p className={`font-light font-mono text-lg ${gananciaBruta >= 0 ? 'text-brand-military-dark' : 'text-red-500'}`}>
                      {gananciaBruta >= 0 ? '' : '−'}{fmt(Math.abs(gananciaBruta), cur)}
                    </p>
                  </div>
                  <div className="flex justify-between items-center py-3">
                    <div>
                      <p className="text-xs font-medium text-gray-500">− Gastos operativos</p>
                      <p className="text-[9px] text-gray-400">Sueldos, servicios, alquileres, etc.</p>
                    </div>
                    <p className="font-light font-mono text-gray-600">−{fmt(gastosOperativos, cur)}</p>
                  </div>
                  {/* KPIs de margen */}
                  <div className="grid grid-cols-2 gap-3 py-4">
                    <div className="bg-brand-military-light/40 rounded-xl p-3">
                      <p className="text-xs font-medium text-brand-military mb-1">Margen bruto</p>
                      <p className="text-xl font-light font-mono text-brand-military-dark">{margenBrutoPct.toFixed(1)}%</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs font-medium text-gray-400 mb-1">Margen neto</p>
                      <p className={`text-xl font-light font-mono ${margenNetoPct >= 0 ? 'text-brand-military-dark' : 'text-red-500'}`}>{margenNetoPct.toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-4 bg-brand-carbon px-4 -mx-5 -mb-5 rounded-b-2xl mt-1">
                    <div>
                      <p className="text-sm font-medium text-brand-gold">Ganancia neta</p>
                      <p className="text-[9px] text-gray-500">Margen neto: {margenNetoPct.toFixed(1)}%</p>
                    </div>
                    <p className={`font-light font-mono text-xl ${gananciaNeta >= 0 ? 'text-white' : 'text-red-400'}`}>
                      {gananciaNeta >= 0 ? '+' : ''}{fmt(gananciaNeta, cur)}
                    </p>
                  </div>
                </div>
              )
            })()}
          </div>
        </Panel>

        {/* PUNTO DE EQUILIBRIO — ancho: 2 columnas, bg slate para efecto overlap */}
        <div className="xl:col-span-2 bg-brand-slate rounded-2xl overflow-hidden" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.02)' }}>
          <PuntoEquilibrio ventas={totals.income} cmv={cmvTotal || 0} cur={cur} />
        </div>
      </div>

      {/* STOCK EN REPORTES */}
      {(valorInventario > 0 || topProductosPorStock.length > 0) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
          <Panel title="Inventario en Reportes" accent="dark">
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3 bg-brand-military-light/40">
                  <p className="text-xs font-medium text-brand-military mb-1">Valor al costo</p>
                  <p className="text-lg font-light font-mono text-brand-military-dark">{fmt(valorInventario, cur)}</p>
                  <p className="text-[9px] text-gray-400">Precio costo × stock</p>
                </div>
                <div className="rounded-xl p-3 bg-brand-gold-light/60">
                  <p className="text-xs font-medium text-brand-gold-dark mb-1">Valor a venta</p>
                  <p className="text-lg font-light font-mono text-brand-gold-dark">{fmt(valorInventarioVenta, cur)}</p>
                  <p className="text-[9px] text-gray-400">Precio venta × stock</p>
                </div>
              </div>
              <div className="rounded-xl p-3 flex justify-between items-center bg-gray-50">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-0.5">Margen potencial</p>
                  <p className="text-[9px] text-gray-400">Si se vende todo el inventario</p>
                </div>
                <p className={`font-light font-mono ${margenBrutoInventario >= 0 ? 'text-brand-military-dark' : 'text-red-500'}`}>
                  {margenBrutoInventario >= 0 ? '+' : ''}{fmt(margenBrutoInventario, cur)}
                </p>
              </div>
              <div className="rounded-xl p-3 flex justify-between items-center bg-gray-50">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-0.5">CMV acumulado</p>
                  <p className="text-[9px] text-gray-400">Costo de lo vendido (salidas registradas)</p>
                </div>
                <p className="font-light font-mono text-brand-gold-dark">{fmt(cmvTotal || 0, cur)}</p>
              </div>
            </div>
          </Panel>

          <Panel title="Top Productos por Valor de Stock" accent="light">
            {topProductosPorStock.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-300 font-medium">Sin productos registrados</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {topProductosPorStock.map((p, i) => {
                  const maxVal = Math.max(...topProductosPorStock.map(x => x.valorTotal), 1)
                  const pct = (p.valorTotal / maxVal) * 100
                  return (
                    <div key={i} className="px-5 py-3.5">
                      <div className="flex justify-between items-start mb-1.5">
                        <div>
                          <span className="text-xs font-semibold text-gray-700">{p.nombre}</span>
                          {p.marca && <span className="ml-2 text-xs text-gray-400">{p.marca}</span>}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-light font-mono text-brand-military-dark">{fmt(p.valorTotal, cur)}</p>
                          <p className="text-[9px] text-gray-400">{p.stockActual} u × {fmt(p.precioCosto, cur)}</p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div className="h-1.5 bg-brand-military rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Panel>
        </div>
      )}

    </div>
  )
}

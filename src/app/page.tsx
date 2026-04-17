import { getAvailableDashboardMonths, getDashboardStats, getCajasData } from '@/app/actions'
import { FinancialOverviewChart, ProfitabilityDonut, EvolutionTabs } from '@/components/DashboardCharts'
import AppHeader from '@/components/AppHeader'
import PeriodTabs from '@/components/PeriodTabs'
import type { PeriodKey } from '@/components/PeriodTabs'
import { requireBusinessContext } from '@/server/auth/require-business-context'
import { Suspense } from 'react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const PERIOD_DISPLAY: Record<string, string> = {
  diario: 'Hoy', ayer: 'Ayer', semanal: 'Esta semana', mensual: 'Este mes',
  trimestral: 'Este trimestre', semestral: 'Este semestre', anual: 'Este año', custom: 'Período personalizado',
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <>
      <section className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-[140px] animate-pulse rounded-2xl border border-stone-200 bg-white dark:border-white/10 dark:bg-[#141414]" />
        ))}
      </section>
      <div className="mb-5 h-[380px] animate-pulse rounded-2xl border border-stone-200 bg-white dark:border-white/10 dark:bg-[#141414]" />
      <section className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-[110px] animate-pulse rounded-2xl border border-stone-200 bg-white dark:border-white/10 dark:bg-[#141414]" />
        ))}
      </section>
      <section className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-[110px] animate-pulse rounded-2xl border border-stone-200 bg-white dark:border-white/10 dark:bg-[#141414]" />
        ))}
      </section>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-[62px] animate-pulse rounded-2xl border border-stone-200 bg-white dark:border-white/10 dark:bg-[#141414]" />
        ))}
      </div>
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(v: number) {
  return '$' + Math.abs(v).toLocaleString('es-AR', { minimumFractionDigits: 0 })
}

function variationState(value: number | null, trend: 'direct' | 'inverse' = 'direct') {
  if (value === null) return { label: '—', positive: null, favorable: null }
  const positive = value >= 0
  const favorable = trend === 'inverse' ? !positive : positive
  return {
    label: `${positive ? '▲ +' : '▼ '}${Math.abs(value).toFixed(1)}% vs ant.`,
    positive,
    favorable,
  }
}

function variationClass(state: ReturnType<typeof variationState>) {
  if (state.favorable === null) return 'text-stone-400'
  return state.favorable ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
}

// ── AI Insight generator ───────────────────────────────────────────────────────
function generateInsights(
  kpis: { income: number; expense: number; gain: number; marginPct: number },
  prevKpis: { income: number; expense: number; gain: number },
  periodLabel: string,
) {
  const expenseShare = kpis.income > 0 ? (kpis.expense / kpis.income) * 100 : 0

  const insights: { icon: 'income' | 'expense' | 'margin'; label: string; text: string }[] = []

  if (prevKpis.income > 0) {
    const pct = ((kpis.income - prevKpis.income) / prevKpis.income) * 100
    if (pct > 10) insights.push({ icon: 'income', label: 'Ingresos', text: `Tus ingresos crecieron un ${pct.toFixed(0)}% vs el período anterior. Buen ritmo.` })
    else if (pct < -10) insights.push({ icon: 'income', label: 'Ingresos', text: `Tus ingresos bajaron un ${Math.abs(pct).toFixed(0)}% vs el período anterior. Revisá las fuentes de ingreso.` })
    else insights.push({ icon: 'income', label: 'Ingresos', text: `Tus ingresos se mantuvieron estables en ${periodLabel}.` })
  } else {
    insights.push({ icon: 'income', label: 'Ingresos', text: 'Registrá tus primeras ventas para ver la evolución aquí.' })
  }

  if (prevKpis.expense > 0) {
    const pct = ((kpis.expense - prevKpis.expense) / prevKpis.expense) * 100
    if (pct > 15) insights.push({ icon: 'expense', label: 'Egresos', text: `Los egresos subieron un ${pct.toFixed(0)}%. Revisá qué categoría impactó más.` })
    else insights.push({ icon: 'expense', label: 'Egresos', text: `Los egresos representan el ${kpis.income > 0 ? expenseShare.toFixed(0) : '—'}% de tus ingresos.` })
  } else {
    insights.push({ icon: 'expense', label: 'Egresos', text: `Sin egresos registrados en ${periodLabel}.` })
  }

  insights.push({
    icon: 'margin',
    label: 'Rentabilidad',
    text: kpis.marginPct > 0
      ? `Margen del ${kpis.marginPct.toFixed(1)}% en ${periodLabel}. ${kpis.marginPct >= 20 ? 'Muy saludable.' : kpis.marginPct >= 10 ? 'Aceptable.' : 'Considerá optimizar costos.'}`
      : `Sin rentabilidad positiva en ${periodLabel}. Revisá la estructura de costos.`,
  })

  return insights
}

// ── Async content component ────────────────────────────────────────────────────
async function DashboardContent({
  businessId, periodo, customFrom, customTo, selectedYear, selectedMonth,
}: {
  businessId: string
  periodo: PeriodKey
  customFrom?: string
  customTo?: string
  selectedYear?: number
  selectedMonth?: number
}) {
  const [stats, cajasData] = await Promise.all([
    getDashboardStats(periodo, customFrom, customTo, businessId, selectedYear, selectedMonth),
    getCajasData(),
  ])

  const { kpis, prevKpis, chartData, categoryBreakdown, incomeCategoryBreakdown, periodLabel, debtStatus, alerts } = stats

  const incomeGrowth = prevKpis.income > 0 ? ((kpis.income - prevKpis.income) / prevKpis.income) * 100 : null
  const expenseGrowth = prevKpis.expense > 0 ? ((kpis.expense - prevKpis.expense) / prevKpis.expense) * 100 : null
  const gainGrowth = prevKpis.gain !== 0 ? ((kpis.gain - prevKpis.gain) / Math.abs(prevKpis.gain)) * 100 : null

  const gainIsPositive = kpis.gain >= 0
  const expenseShare = kpis.income > 0 ? Math.min(100, (kpis.expense / kpis.income) * 100) : 0
  const gainShare = kpis.income > 0 ? Math.min(100, Math.abs(kpis.gain) / kpis.income * 100) : 0

  const incomeV = variationState(incomeGrowth)
  const expenseV = variationState(expenseGrowth, 'inverse')
  const gainV = variationState(gainGrowth)

  const cajaTotal = (cajasData.efectivo?.total ?? 0) + (cajasData.virtual?.total ?? 0)
  const creditosDeudas: { esCredito?: boolean; amount: number }[] = debtStatus.creditosDeudas ?? []
  const totalACobrar = creditosDeudas.filter(c => c.esCredito).reduce((s, c) => s + c.amount, 0)
  const totalAPagar = creditosDeudas.filter(c => !c.esCredito).reduce((s, c) => s + c.amount, 0)

  const insights = generateInsights(kpis, prevKpis, periodLabel)

  return (
    <>
      {/* ── Alertas ─────────────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="mb-4 space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
              a.severity === 'danger'
                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400'
                : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400'
            }`}>
              <span className="mt-0.5 shrink-0">⚠️</span>
              <div><span className="font-semibold">{a.title}: </span><span>{a.message}</span></div>
            </div>
          ))}
        </div>
      )}

      {/* ══ SECCIÓN 1 — KPIs (3/4) + Donut rentabilidad (1/4) ══════════════ */}
      <section className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1fr_minmax(240px,0.8fr)]">

        {/* KPI Ingresos — verde */}
        <div className="flex flex-col justify-between rounded-2xl border border-[#D5E3D8] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-[#1E3627] dark:bg-[#141414] dark:shadow-none">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2D6A4F] dark:text-[#8FD0A7]">Ingresos</span>
            <span className={`text-[11px] font-semibold ${variationClass(incomeV)}`}>{incomeV.label}</span>
          </div>
          <p className="mt-3 font-mono text-[34px] font-bold leading-none tracking-[-0.03em] text-[#1F2937] dark:text-[#E8E8E8] num-tabular">
            {fmt(kpis.income)}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#ECF5EF] dark:bg-[#1E3627]">
              <div className="h-full rounded-full bg-[#2D6A4F]" style={{ width: '100%' }} />
            </div>
            <span className="text-[11px] text-stone-400">100%</span>
          </div>
        </div>

        {/* KPI Egresos — rojo */}
        <div className="flex flex-col justify-between rounded-2xl border border-[#F3D6D6] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-[#2E1919] dark:bg-[#141414] dark:shadow-none">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#B91C1C] dark:text-[#F87171]">Egresos</span>
            <span className={`text-[11px] font-semibold ${variationClass(expenseV)}`}>{expenseV.label}</span>
          </div>
          <p className="mt-3 font-mono text-[34px] font-bold leading-none tracking-[-0.03em] text-[#1F2937] dark:text-[#E8E8E8] num-tabular">
            {fmt(kpis.expense)}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#FDEDED] dark:bg-[#2E1919]">
              <div className="h-full rounded-full bg-[#B91C1C]" style={{ width: `${expenseShare.toFixed(0)}%` }} />
            </div>
            <span className="text-[11px] text-stone-400">{expenseShare.toFixed(0)}%</span>
          </div>
        </div>

        {/* KPI Ganancia Neta — celeste */}
        <div className={`flex flex-col justify-between rounded-2xl border p-5 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-none ${
          gainIsPositive ? 'border-[#BAE6FD] bg-white dark:border-[#0C3450] dark:bg-[#141414]' : 'border-[#F3D6D6] bg-white dark:border-[#2E1919] dark:bg-[#141414]'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${gainIsPositive ? 'text-[#0369A1] dark:text-[#38BDF8]' : 'text-[#B91C1C] dark:text-[#F87171]'}`}>
              Ganancia Neta
            </span>
            <span className={`text-[11px] font-semibold ${variationClass(gainV)}`}>{gainV.label}</span>
          </div>
          <p className={`mt-3 font-mono text-[34px] font-bold leading-none tracking-[-0.03em] num-tabular ${
            gainIsPositive ? 'text-[#0369A1] dark:text-[#38BDF8]' : 'text-[#B91C1C] dark:text-[#F87171]'
          }`}>
            {gainIsPositive ? '' : '−'}{fmt(kpis.gain)}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className={`h-1.5 flex-1 overflow-hidden rounded-full ${gainIsPositive ? 'bg-[#E0F2FE] dark:bg-[#0C3450]' : 'bg-[#FDEDED] dark:bg-[#2E1919]'}`}>
              <div className={`h-full rounded-full ${gainIsPositive ? 'bg-[#0369A1]' : 'bg-[#B91C1C]'}`} style={{ width: `${gainShare.toFixed(0)}%` }} />
            </div>
            <span className="text-[11px] text-stone-400">{kpis.income > 0 ? `${gainShare.toFixed(0)}%` : '—'}</span>
          </div>
        </div>

        {/* Donut de rentabilidad */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
          <div className="border-b border-[#ECE7E1] bg-[#FAFBFC] px-4 py-3 dark:border-white/10 dark:bg-[#171717]">
            <h2 className="text-sm font-semibold text-[#1F2937] dark:text-[#E8E8E8]">Rentabilidad</h2>
            <p className="text-[11px] text-[#9CA3AF]">
              {kpis.income > 0 ? `Margen ${kpis.marginPct.toFixed(1)}%` : 'Sin ventas registradas'}
            </p>
          </div>
          <div className="flex flex-1 items-center justify-center p-3">
            <div className="w-full max-w-[240px]">
              <ProfitabilityDonut expense={kpis.expense} gain={Math.max(kpis.gain, 0)} height={170} />
            </div>
          </div>
        </div>
      </section>

      {/* ══ SECCIÓN 2 — EVOLUCIÓN FINANCIERA (full width + tabs) ════════════ */}
      <div className="mb-5">
        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#ECE7E1] bg-[#FAFBFC] px-5 py-4 dark:border-white/10 dark:bg-[#171717]">
            <div>
              <h2 className="text-sm font-semibold text-[#1F2937] dark:text-[#E8E8E8]">Evolución financiera</h2>
              <p className="text-xs text-[#9CA3AF] dark:text-stone-500">{periodLabel}</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-[#9CA3AF] dark:text-stone-500">
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#2D6A4F]" />Ingresos</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#B91C1C]" />Egresos</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-1 w-2.5 rounded-full bg-[#38BDF8]" />Ganancia</span>
            </div>
          </div>
          <EvolutionTabs chartData={chartData} categoryBreakdown={categoryBreakdown} incomeCategoryBreakdown={incomeCategoryBreakdown} />
        </div>
      </div>

      {/* ══ SECCIÓN 3 — RESUMEN OPERATIVO 2×2 ══════════════════════════════ */}
      <section className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">

        {/* Caja */}
        <div className="flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-military-light text-[#2D5A41] dark:bg-[#1F3428] dark:text-[#9AC7A8]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Caja</span>
          </div>
          <p className="font-mono text-2xl font-bold leading-none num-tabular text-[#1F2937] dark:text-[#E8E8E8]">{fmt(cajaTotal)}</p>
          <Link href="/cajas" className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#2D5A41] hover:underline dark:text-[#9AC7A8]">Ver cajas →</Link>
        </div>

        {/* Créditos / Deudas */}
        <div className="flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFF7ED] text-[#C2410C] dark:bg-[#2A1810] dark:text-[#F97316]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Créditos / Deudas</span>
          </div>
          <div className="flex gap-4">
            <div>
              <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">A cobrar</p>
              <p className="font-mono text-lg font-bold leading-none num-tabular text-[#1F2937] dark:text-[#E8E8E8]">{fmt(totalACobrar)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-red-600 dark:text-red-400">A pagar</p>
              <p className="font-mono text-lg font-bold leading-none num-tabular text-[#1F2937] dark:text-[#E8E8E8]">{fmt(totalAPagar)}</p>
            </div>
          </div>
          <Link href="/creditos" className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#C2410C] hover:underline dark:text-[#F97316]">Ver créditos →</Link>
        </div>

        {/* Stock */}
        <div className="flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F5F3FF] text-[#7C3AED] dark:bg-[#1E1830] dark:text-[#A78BFA]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Stock</span>
          </div>
          <p className="text-sm text-stone-400 dark:text-stone-500">Valor de inventario</p>
          <Link href="/stock" className="mt-auto pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7C3AED] hover:underline dark:text-[#A78BFA]">Ver stock →</Link>
        </div>

        {/* Bienes de Uso */}
        <div className="flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFFBEB] text-[#92400E] dark:bg-[#2A1810] dark:text-[#D97706]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Bienes de Uso</span>
          </div>
          <p className="text-sm text-stone-400 dark:text-stone-500">Activos fijos</p>
          <Link href="/bienes" className="mt-auto pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#92400E] hover:underline dark:text-[#D97706]">Ver bienes →</Link>
        </div>
      </section>

      {/* ══ SECCIÓN 4 — INDICADORES CLAVE ══════════════════════════════════ */}
      <section className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">

        {/* Margen de Rentabilidad */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Margen de Rentabilidad</p>
          <p className="mt-2 font-mono text-3xl font-bold leading-none num-tabular text-[#0369A1] dark:text-[#38BDF8]">
            {kpis.income > 0 ? `${kpis.marginPct.toFixed(1)}%` : '—'}
          </p>
          <p className="mt-1 text-xs text-stone-400">(Ganancia / Ingresos) × 100</p>
        </div>

        {/* Punto de Equilibrio */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Punto de Equilibrio</p>
          <p className="mt-2 font-mono text-3xl font-bold leading-none num-tabular text-[#1F2937] dark:text-[#E8E8E8]">
            {kpis.expense > 0 ? fmt(kpis.expense) : '—'}
          </p>
          <p className="mt-1 text-xs text-stone-400">Mínimo de ventas para no perder</p>
        </div>

        {/* Ratio Egresos / Ingresos */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Ratio Egresos / Ingresos</p>
          <p className={`mt-2 font-mono text-3xl font-bold leading-none num-tabular ${
            expenseShare <= 70 ? 'text-emerald-600 dark:text-emerald-400' : expenseShare <= 90 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {kpis.income > 0 ? `${expenseShare.toFixed(1)}%` : '—'}
          </p>
          <p className="mt-1 text-xs text-stone-400">
            {expenseShare <= 70 ? 'Estructura de costos saludable' : expenseShare <= 90 ? 'Cuidado con los costos' : 'Egresos muy altos'}
          </p>
        </div>
      </section>

      {/* ══ SECCIÓN 5 — ANÁLISIS IA ════════════════════════════════════════ */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {insights.map((insight, i) => (
          <div key={i} className="flex items-start gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
              insight.icon === 'income' ? 'bg-[#F5FAF7] text-[#2D5A41] dark:bg-[#173326] dark:text-[#9AC7A8]'
              : insight.icon === 'expense' ? 'bg-[#FFF5F5] text-[#B91C1C] dark:bg-[#241818] dark:text-[#F87171]'
              : 'bg-[#EFF6FF] text-[#1D4ED8] dark:bg-[#1E2D3D] dark:text-[#60A5FA]'
            }`}>
              {insight.icon === 'income' && <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" /></svg>}
              {insight.icon === 'expense' && <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" /></svg>}
              {insight.icon === 'margin' && <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09ZM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456Z" /></svg>}
            </div>
            <div className="min-w-0">
              <p className="mb-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-[#9CA3AF] dark:text-stone-500">{insight.label}</p>
              <p className="text-[11px] leading-snug text-[#4B5563] dark:text-stone-300">{insight.text}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; from?: string; to?: string; year?: string; month?: string }>
}) {
  const [sessionContext, sp] = await Promise.all([requireBusinessContext(), searchParams])
  const businessId = sessionContext.activeBusiness.id
  const availableMonths = await getAvailableDashboardMonths(businessId)

  const periodo = (sp.periodo ?? 'mensual') as PeriodKey
  const customFrom = sp.from
  const customTo = sp.to
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1
  const selectedYear = sp.year ? Number.parseInt(sp.year, 10) : (periodo === 'mensual' ? currentYear : undefined)
  const selectedMonth = sp.month ? Number.parseInt(sp.month, 10) : (periodo === 'mensual' ? currentMonth : undefined)

  const firstName = sessionContext.user.name?.split(' ')[0] ?? 'Hola'

  return (
    <div className="mx-auto min-h-screen max-w-[1920px] bg-[#F7F9FB] p-4 font-sans text-[#1F2937] dark:bg-black dark:text-gray-100 sm:p-6 lg:p-8">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <AppHeader
        title="Balance General"
        sessionContext={sessionContext}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        }
      />

      {/* ── Saludo + Selector de período ────────────────────────────────────── */}
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between md:mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937] dark:text-[#E8E8E8]">
            Hola, {firstName} 👋
          </h1>
          <p className="mt-0.5 text-sm text-stone-400 dark:text-stone-500">
            {PERIOD_DISPLAY[periodo] ?? 'Período personalizado'}
          </p>
        </div>
        <Suspense fallback={null}>
          <PeriodTabs
            active={periodo}
            customFrom={customFrom}
            customTo={customTo}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            availableMonths={availableMonths}
          />
        </Suspense>
      </div>

      {/* ── Dashboard streaming ──────────────────────────────────────────────── */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent
          businessId={businessId}
          periodo={periodo}
          customFrom={customFrom}
          customTo={customTo}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
        />
      </Suspense>
    </div>
  )
}


export const dynamic = 'force-dynamic'

// ── Skeleton loader that shows immediately while data streams in ──
function DashboardSkeleton() {
  return (
    <>
      <section className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)] lg:items-stretch">
        <div className="flex flex-col gap-4">
          <div className="h-[176px] rounded-2xl border border-stone-200 bg-white animate-pulse dark:border-white/10 dark:bg-[#141414]" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[0, 1].map(i => (
              <div key={i} className="h-[132px] rounded-2xl border border-stone-200 bg-white animate-pulse dark:border-white/10 dark:bg-[#141414]" />
            ))}
          </div>
        </div>
        <div className="h-[320px] rounded-2xl border border-stone-200 bg-white animate-pulse dark:border-white/10 dark:bg-[#141414]" />
      </section>
      <div className="mb-4 md:mb-5">
        <div className="h-[340px] animate-pulse rounded-2xl border border-stone-200 bg-white dark:border-white/10 dark:bg-[#141414]" />
      </div>
    </>
  )
}

function formatCompactCurrency(value: number) {
  return '$' + Math.abs(value).toLocaleString('es-AR', { minimumFractionDigits: 0 })
}

function formatVariation(value: number | null, trend: 'direct' | 'inverse' = 'direct') {
  if (value === null) {
    return {
      label: 'Sin datos anteriores',
      state: 'neutral' as const,
    }
  }

  const positive = value >= 0
  const favorable = trend === 'inverse' ? !positive : positive
  return {
    label: `${positive ? '▲' : '▼'} ${positive ? '+' : '-'}${Math.abs(value).toFixed(1)}% vs período anterior`,
    state: favorable ? 'positive' as const : 'negative' as const,
  }
}

function SummaryRowContent({
  label,
  amount,
  variation,
  tone,
  prominent = false,
}: {
  label: string
  amount: string
  variation: { label: string; state: 'positive' | 'negative' | 'neutral' }
  tone: 'profit-positive' | 'profit-negative' | 'income' | 'expense'
  prominent?: boolean
}) {
  return (
    <div
      className={`kpi-card kpi-card-${tone} h-full rounded-2xl border shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition-all duration-200 dark:shadow-none ${prominent ? 'p-7 ring-1 ring-black/[0.02] dark:ring-white/[0.04]' : 'p-5'}`}
    >
      <div className="flex h-full flex-col justify-between gap-4">
        <div>
          <p className="kpi-card-label text-[13px] font-medium">{label}</p>
          <p className={`kpi-card-value kpi-card-value-${tone} ${prominent ? 'mt-3 text-[36px] md:text-[40px]' : 'mt-2 text-[28px] md:text-[32px]'} font-mono font-bold num-tabular leading-none tracking-[-0.04em]`}>
            {amount}
          </p>
        </div>

        <p className={`kpi-card-variation kpi-card-variation-${variation.state} text-[13px] font-medium`}>
          {variation.label}
        </p>
      </div>
    </div>
  )
}

// ── Async server component: fetches data and renders KPIs + charts ──
async function DashboardContent({
  businessId,
  periodo,
  customFrom,
  customTo,
  selectedYear,
  selectedMonth,
}: {
  businessId: string
  periodo: PeriodKey
  customFrom?: string
  customTo?: string
  selectedYear?: number
  selectedMonth?: number
}) {
  const stats = await getDashboardStats(periodo, customFrom, customTo, businessId, selectedYear, selectedMonth)
  const { kpis, prevKpis, chartData, categoryBreakdown, incomeCategoryBreakdown, periodLabel } = stats

  const incomeGrowth = prevKpis.income > 0 ? ((kpis.income - prevKpis.income) / prevKpis.income) * 100 : null
  const expenseGrowth = prevKpis.expense > 0 ? ((kpis.expense - prevKpis.expense) / prevKpis.expense) * 100 : null
  const gainGrowth = prevKpis.gain !== 0 ? ((kpis.gain - prevKpis.gain) / Math.abs(prevKpis.gain)) * 100 : null

  const gainIsPositive = kpis.gain >= 0

  return (
    <>
      <section className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)] lg:items-stretch">
        <div className="flex h-full flex-col gap-4 lg:min-w-0">
          <div className="min-h-[176px]">
            <SummaryRowContent
              label="Ganancia"
              amount={`${gainIsPositive ? '' : '−'}${formatCompactCurrency(kpis.gain)}`}
              variation={formatVariation(gainGrowth)}
              tone={gainIsPositive ? 'profit-positive' : 'profit-negative'}
              prominent
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <KpiCardWithModal title="Detalle de ingresos" categories={incomeCategoryBreakdown} total={kpis.income}>
              <SummaryRowContent
                label="Ingreso"
                amount={formatCompactCurrency(kpis.income)}
                variation={formatVariation(incomeGrowth)}
                tone="income"
              />
            </KpiCardWithModal>

            <KpiCardWithModal title="Detalle de egresos" categories={categoryBreakdown} total={kpis.expense}>
              <SummaryRowContent
                label="Egreso"
                amount={formatCompactCurrency(kpis.expense)}
                variation={formatVariation(expenseGrowth, 'inverse')}
                tone="expense"
              />
            </KpiCardWithModal>
          </div>
        </div>

        <div className="home-dashboard-panel flex h-full min-h-[320px] flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
          <div className="border-b border-[#ECE7E1] bg-[#FAFBFC] px-5 py-4 dark:border-white/10 dark:bg-[#171717]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[#1F2937] dark:text-[#E8E8E8]">Rentabilidad</h2>
                <p className="text-xs text-[#9CA3AF] dark:text-stone-500">Distribución entre egresos y ganancia del período</p>
              </div>
              <span className="rounded-full border border-[#D5E3D8] bg-[#F5FAF7] px-2.5 py-1 text-[10px] font-semibold text-[#2D5A41] dark:border-[#294235] dark:bg-[#162019] dark:text-[#9AC7A8]">
                {kpis.income > 0 ? `${Math.max(0, (kpis.gain / kpis.income) * 100).toFixed(1)}% margen` : 'Sin ventas'}
              </span>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center p-5 sm:p-6">
            <div className="flex flex-1 items-center justify-center">
              <div className="w-full max-w-[420px]">
                <ProfitabilityDonut expense={kpis.expense} gain={Math.max(kpis.gain, 0)} height={220} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FILA 2 — GRÁFICO PRINCIPAL (ancho completo) ══════════════════════ */}
      <div className="mb-5">
        <div className="home-dashboard-panel flex flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
          <div className="flex items-center justify-between gap-2 border-b border-[#ECE7E1] bg-[#FAFBFC] px-5 py-4 flex-wrap dark:border-white/10 dark:bg-[#171717]">
            <div>
              <h2 className="text-sm font-semibold text-[#1F2937] dark:text-[#E8E8E8]">Resumen financiero</h2>
              <p className="text-xs text-[#9CA3AF] dark:text-stone-500">Ingresos · Egresos · Ganancia — {periodLabel}</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-[#9CA3AF] dark:text-stone-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#7A9485] inline-block" />Ingresos
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#B91C1C] inline-block" />Egresos
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-1 rounded-full bg-[#38BDF8] inline-block" />Ganancia
              </span>
            </div>
          </div>
          <div className="flex-1 p-4 dark:bg-[#141414]">
            {chartData.some(d => d.income > 0 || d.expense > 0) ? (
              <FinancialOverviewChart data={chartData} height={280} />
            ) : (
              <div className="h-[280px] flex items-center justify-center">
                <p className="text-sm text-gray-300">Sin datos históricos aún</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ INSIGHTS IA — 3 tarjetas preparadas para mensajes inteligentes ══ */}
      <div className="mb-4 md:mb-5 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        <div className="flex h-[58px] items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-4 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F5FAF7] text-[#2D5A41] shrink-0 dark:bg-[#173326] dark:text-[#9AC7A8]">
            <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF] leading-none dark:text-stone-500">Ingresos</p>
            <p className="truncate text-[11px] leading-tight text-[#4B5563] dark:text-stone-300">Análisis disponible próximamente</p>
          </div>
        </div>
        <div className="flex h-[58px] items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-4 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FAF6EE] text-[#8A6118] shrink-0 dark:bg-[#241818] dark:text-[#F2B272]">
            <svg className="w-3.5 h-3.5 text-gray-500 dark:text-rose-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF] leading-none dark:text-stone-500">Egresos</p>
            <p className="truncate text-[11px] leading-tight text-[#4B5563] dark:text-stone-300">Análisis disponible próximamente</p>
          </div>
        </div>
        <div className="flex h-[58px] items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-4 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F3F6F4] text-[#3A4D39] shrink-0 dark:bg-[#222016] dark:text-[#D7F3DF]">
            <svg className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09ZM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456Z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF] leading-none dark:text-stone-500">Rentabilidad</p>
            <p className="truncate text-[11px] leading-tight text-[#4B5563] dark:text-stone-300">Análisis disponible próximamente</p>
          </div>
        </div>
      </div>
    </>
  )
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; from?: string; to?: string; year?: string; month?: string; monthOffset?: string }>
}) {
  const [sessionContext, sp] = await Promise.all([
    requireBusinessContext(),
    searchParams,
  ])
  const businessId = sessionContext.activeBusiness.id
  const availableMonths = await getAvailableDashboardMonths(businessId)
  const periodo = (sp.periodo ?? 'mensual') as PeriodKey
  const customFrom = sp.from
  const customTo = sp.to
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1
  const selectedYear = sp.year ? Number.parseInt(sp.year, 10) : (periodo === 'mensual' ? currentYear : undefined)
  const selectedMonth = sp.month ? Number.parseInt(sp.month, 10) : (periodo === 'mensual' ? currentMonth : undefined)

  return (
    <div className="mx-auto min-h-screen max-w-[1920px] bg-[#F7F9FB] p-4 font-sans text-[#1F2937] dark:bg-black dark:text-gray-100 sm:p-6 lg:p-8">

      {/* ══ FILA 0 — HEADER ══════════════════════════════════════════════════ */}
      <AppHeader
        title="Inicio"
        sessionContext={sessionContext}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        }
      />

      <div className="mb-5 flex items-center justify-between gap-3 md:mb-6">
        <Suspense fallback={null}>
          <PeriodTabs
            active={periodo}
            customFrom={customFrom}
            customTo={customTo}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            availableMonths={availableMonths}
          />
        </Suspense>
      </div>

      {/* ══ DASHBOARD DATA — streams in via Suspense ══════════════════════════ */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent
          businessId={businessId}
          periodo={periodo}
          customFrom={customFrom}
          customTo={customTo}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
        />
      </Suspense>

    </div>
  )
}

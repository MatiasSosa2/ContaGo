import { getDashboardStats } from '@/app/actions'
import { FinancialOverviewChart, ProfitabilityDonut } from '@/components/DashboardCharts'
import KpiCardWithModal from '@/components/KpiCardWithModal'
import AppHeader from '@/components/AppHeader'
import PeriodTabs from '@/components/PeriodTabs'
import type { PeriodKey } from '@/components/PeriodTabs'
import { requireBusinessContext } from '@/server/auth/require-business-context'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

// ── Skeleton loader that shows immediately while data streams in ──
function DashboardSkeleton() {
  return (
    <>
      <section className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)] lg:items-stretch">
        <div className="flex flex-col gap-4">
          <div className="h-[176px] rounded-[20px] bg-gray-200 animate-pulse" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[0, 1].map(i => (
              <div key={i} className="h-[132px] rounded-[20px] bg-gray-200 animate-pulse" />
            ))}
          </div>
        </div>
        <div className="h-[320px] rounded-[20px] bg-gray-100 animate-pulse" />
      </section>
      <div className="mb-4 md:mb-5">
        <div className="executive-card h-[340px] animate-pulse bg-gray-100 rounded-2xl" />
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
      className={`kpi-card kpi-card-${tone} h-full rounded-[14px] border transition-all duration-200 ${prominent ? 'p-7 shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_14px_36px_rgba(0,0,0,0.34)] -translate-y-[2px]' : 'p-5'}`}
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

        <div className="executive-card home-dashboard-panel flex h-full min-h-[320px] flex-col overflow-hidden rounded-[20px] dark:bg-[#111315]">
          <div className="border-b border-black/[0.05] bg-slate-50 px-5 py-4 dark:border-white/[0.05] dark:bg-[#181a1d]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-stone-300">Rentabilidad</h2>
                <p className="text-xs text-gray-400 dark:text-stone-500">Distribución entre egresos y ganancia del período</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:border dark:border-emerald-400/10 dark:bg-[#13251d] dark:text-emerald-300">
                {kpis.income > 0 ? `${Math.max(0, (kpis.gain / kpis.income) * 100).toFixed(1)}% margen` : 'Sin ventas'}
              </span>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center p-4 sm:p-5">
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
        <div className="executive-card home-dashboard-panel flex flex-col overflow-hidden dark:bg-[#111315]">
          <div className="px-5 py-4 border-b border-black/[0.05] dark:border-white/[0.05] flex justify-between items-center flex-wrap gap-2 bg-slate-50 dark:bg-[#181a1d]">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-stone-300">Resumen financiero</h2>
              <p className="text-xs text-gray-400 dark:text-stone-500">Ingresos · Egresos · Ganancia — {periodLabel}</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-stone-500">
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
          <div className="p-4 flex-1 dark:bg-[#111315]">
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
        <div className="h-[52px] flex items-center gap-3 px-4 rounded-xl border border-black/[0.04] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-white/[0.05] dark:bg-[#121416] dark:shadow-none">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 dark:bg-[#173326]">
            <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 leading-none dark:text-stone-500">Ingresos</p>
            <p className="truncate text-[11px] leading-tight text-gray-600 dark:text-stone-300">Análisis disponible próximamente</p>
          </div>
        </div>
        <div className="h-[52px] flex items-center gap-3 px-4 rounded-xl border border-black/[0.04] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-white/[0.05] dark:bg-[#121416] dark:shadow-none">
          <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 dark:bg-[#241818]">
            <svg className="w-3.5 h-3.5 text-gray-500 dark:text-rose-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 leading-none dark:text-stone-500">Egresos</p>
            <p className="truncate text-[11px] leading-tight text-gray-600 dark:text-stone-300">Análisis disponible próximamente</p>
          </div>
        </div>
        <div className="h-[52px] flex items-center gap-3 px-4 rounded-xl border border-black/[0.04] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-white/[0.05] dark:bg-[#121416] dark:shadow-none">
          <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 dark:bg-[#222016]">
            <svg className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09ZM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456Z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 leading-none dark:text-stone-500">Rentabilidad</p>
            <p className="truncate text-[11px] leading-tight text-gray-600 dark:text-stone-300">Análisis disponible próximamente</p>
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
  const periodo = (sp.periodo ?? 'mensual') as PeriodKey
  const customFrom = sp.from
  const customTo = sp.to
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1
  const selectedYear = sp.year ? Number.parseInt(sp.year, 10) : (periodo === 'mensual' ? currentYear : undefined)
  const selectedMonth = sp.month ? Number.parseInt(sp.month, 10) : (periodo === 'mensual' ? currentMonth : undefined)

  return (
    <div className="p-3 sm:p-5 lg:p-6 max-w-[1920px] mx-auto font-sans text-[#1F2937] dark:text-gray-100 min-h-screen bg-[#F7F9FB] dark:bg-[#0a0b0d]">

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

      <div className="mb-3 md:mb-4 flex items-center justify-between gap-3">
        <Suspense fallback={null}>
          <PeriodTabs
            active={periodo}
            customFrom={customFrom}
            customTo={customTo}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
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

import { getDashboardStats } from '@/app/actions'
import { KpiSparkline, FinancialOverviewChart, ProfitabilityDonut } from '@/components/DashboardCharts'
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
      <section className="mb-4 md:mb-5 grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-[180px] rounded-2xl bg-gray-200 animate-pulse" />
        ))}
      </section>
      <div className="mb-4 md:mb-5">
        <div className="executive-card h-[340px] animate-pulse bg-gray-100 rounded-2xl" />
      </div>
    </>
  )
}

// ── Async server component: fetches data and renders KPIs + charts ──
async function DashboardContent({
  businessId,
  periodo,
  customFrom,
  customTo,
}: {
  businessId: string
  periodo: PeriodKey
  customFrom?: string
  customTo?: string
}) {
  const stats = await getDashboardStats(periodo, customFrom, customTo, businessId)
  const { kpis, prevKpis, chartData, categoryBreakdown, incomeCategoryBreakdown, sparklines, periodLabel } = stats

  const incomeGrowth = prevKpis.income > 0 ? ((kpis.income - prevKpis.income) / prevKpis.income) * 100 : null
  const expenseGrowth = prevKpis.expense > 0 ? ((kpis.expense - prevKpis.expense) / prevKpis.expense) * 100 : null
  const gainGrowth = prevKpis.gain !== 0 ? ((kpis.gain - prevKpis.gain) / Math.abs(prevKpis.gain)) * 100 : null

  const fmtARS = (v: number) => '$' + Math.abs(v).toLocaleString('es-AR', { minimumFractionDigits: 0 })

  return (
    <>
      {/* ══ FILA 1 — 4 KPI CARDS PROTAGONISTAS ══════════════════════════════ */}
      <section className="mb-4 md:mb-5 grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3 md:gap-4">

        {/* Card 1 — Ingresos del período */}
        <KpiCardWithModal title="Detalle de ingresos" categories={incomeCategoryBreakdown} total={kpis.income}>
          <div className="h-full rounded-2xl p-2.5 sm:p-4 flex flex-col gap-1.5" style={{ background: 'linear-gradient(135deg, #1B4332 0%, #0F2419 100%)' }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-emerald-200">Ingresos</p>
              {incomeGrowth !== null && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/15 text-white">
                  {incomeGrowth >= 0 ? '▲' : '▼'} {Math.abs(incomeGrowth).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-2xl sm:text-3xl md:text-[2.5rem] font-mono font-normal text-white num-tabular leading-none">
              {fmtARS(kpis.income)}
            </p>
            <p className="text-xs text-emerald-300">{periodLabel}</p>
            <div className="my-auto">
              <KpiSparkline data={sparklines.income} color="#6ee7b7" height={38} />
            </div>
          </div>
        </KpiCardWithModal>

        {/* Card 2 — Egresos del período */}
        <KpiCardWithModal title="Detalle de egresos" categories={categoryBreakdown} total={kpis.expense}>
          <div className="h-full rounded-2xl p-1 sm:p-4 flex flex-col gap-1.5" style={{ background: 'linear-gradient(135deg, #7C2D2D 0%, #4C1616 100%)' }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-red-200">Egresos</p>
              {expenseGrowth !== null && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/15 text-white">
                  {expenseGrowth >= 0 ? '▲' : '▼'} {Math.abs(expenseGrowth).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-2xl sm:text-3xl md:text-[2.5rem] font-mono font-normal text-white num-tabular leading-none">
              {fmtARS(kpis.expense)}
            </p>
            <p className="text-xs text-red-300">{periodLabel}</p>
            <div className="my-auto">
              <KpiSparkline data={sparklines.expense} color="#fca5a5" height={38} />
            </div>
          </div>
        </KpiCardWithModal>

        {/* Card 3 — Ganancia del período */}
        <div className="rounded-2xl p-2.5 sm:p-4 flex flex-col gap-1.5" style={{ background: 'linear-gradient(135deg, #52A875 0%, #3A7D5A 100%)' }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-emerald-100">Ganancia</p>
            {gainGrowth !== null && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/15 text-white">
                {gainGrowth >= 0 ? '▲' : '▼'} {Math.abs(gainGrowth).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-2xl sm:text-3xl md:text-[2.5rem] font-mono font-normal text-white num-tabular leading-none">
            {kpis.gain >= 0 ? '' : '−'}{fmtARS(kpis.gain)}
          </p>
          <p className="text-xs text-emerald-100">{periodLabel}</p>
          <div className="my-auto">
            <KpiSparkline data={sparklines.balance} color="#bbf7d0" height={38} />
          </div>
        </div>

        {/* Card 4 — Rentabilidad (donut egresos vs ganancia) */}
        <div className="executive-card rounded-2xl p-2.5 sm:p-4 flex flex-col items-center">
          <p className="text-xs font-semibold text-stone-500 mb-0.5 self-start">Rentabilidad</p>
          <div className="w-full flex-1 flex items-center justify-center">
            <ProfitabilityDonut expense={kpis.expense} gain={kpis.gain} height={140} />
          </div>
          <p className="text-[10px] text-stone-400 leading-none">Ingresos totales</p>
          <p className="text-lg font-mono font-semibold text-stone-800 dark:text-white leading-tight mt-0.5">
            {fmtARS(kpis.income)}
          </p>
        </div>

      </section>

      {/* ══ FILA 2 — GRÁFICO PRINCIPAL (ancho completo) ══════════════════════ */}
      <div className="mb-4 md:mb-5">
        <div className="executive-card flex flex-col overflow-hidden">
          <div className="px-5 py-3.5 border-b border-black/[0.05] dark:border-white/[0.06] flex justify-between items-center flex-wrap gap-2 bg-slate-50 dark:bg-[#1a1a1a]">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-stone-300">Resumen financiero</h2>
              <p className="text-xs text-gray-400 dark:text-stone-500">Ingresos · Egresos · Ganancia — {periodLabel}</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-stone-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#2D6A4F] inline-block" />Ingresos
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#B91C1C] inline-block" />Egresos
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-1 rounded-full bg-[#38BDF8] inline-block" />Ganancia
              </span>
            </div>
          </div>
          <div className="p-4 flex-1">
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
        <div className="h-[52px] flex items-center gap-3 px-4 rounded-xl bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] border border-black/[0.04]">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 leading-none mb-0.5">Ingresos</p>
            <p className="text-[11px] text-gray-600 truncate leading-tight">Análisis disponible próximamente</p>
          </div>
        </div>
        <div className="h-[52px] flex items-center gap-3 px-4 rounded-xl bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] border border-black/[0.04]">
          <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 leading-none mb-0.5">Egresos</p>
            <p className="text-[11px] text-gray-600 truncate leading-tight">Análisis disponible próximamente</p>
          </div>
        </div>
        <div className="h-[52px] flex items-center gap-3 px-4 rounded-xl bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] border border-black/[0.04]">
          <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09ZM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456Z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 leading-none mb-0.5">Rentabilidad</p>
            <p className="text-[11px] text-gray-600 truncate leading-tight">Análisis disponible próximamente</p>
          </div>
        </div>
      </div>
    </>
  )
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; from?: string; to?: string }>
}) {
  // Auth + searchParams resolve in parallel — both are needed for the shell
  const [sessionContext, sp] = await Promise.all([
    requireBusinessContext(),
    searchParams,
  ])
  const periodo = (sp.periodo ?? 'mensual') as PeriodKey
  const customFrom = sp.from
  const customTo = sp.to
  const businessId = sessionContext.activeBusiness.id

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto font-sans text-[#1F2937] dark:text-gray-100 min-h-screen bg-[#F7F9FB] dark:bg-black">

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

      {/* FILTRO DE PERÍODO (renders immediately) */}
      <div className="mb-3 md:mb-4 flex items-center justify-between gap-3">
        <Suspense fallback={null}>
          <PeriodTabs active={periodo} customFrom={customFrom} customTo={customTo} />
        </Suspense>
      </div>

      {/* ══ DASHBOARD DATA — streams in via Suspense ══════════════════════════ */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent
          businessId={businessId}
          periodo={periodo}
          customFrom={customFrom}
          customTo={customTo}
        />
      </Suspense>

    </div>
  )
}

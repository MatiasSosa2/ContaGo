import { getDashboardStats } from '@/app/actions'
import { KpiSparkline, FinancialOverviewChart, ProfitabilityDonut } from '@/components/DashboardCharts'
import KpiCardWithModal from '@/components/KpiCardWithModal'
import DashboardUserMenu from '@/components/DashboardUserMenu'
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
          <div className="h-full rounded-2xl p-2.5 sm:p-4 flex flex-col gap-1.5" style={{ background: 'linear-gradient(135deg, #2D6A4F 0%, #1B4332 100%)' }}>
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
          <div className="h-full rounded-2xl p-1 sm:p-4 flex flex-col gap-1.5" style={{ background: 'linear-gradient(135deg, #B91C1C 0%, #7F1D1D 100%)' }}>
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
        <div className="rounded-2xl p-2.5 sm:p-4 flex flex-col gap-1.5" style={{ background: 'linear-gradient(135deg, #1E40AF 0%, #1E3A5F 100%)' }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-blue-200">Ganancia</p>
            {gainGrowth !== null && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/15 text-white">
                {gainGrowth >= 0 ? '▲' : '▼'} {Math.abs(gainGrowth).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-2xl sm:text-3xl md:text-[2.5rem] font-mono font-normal text-white num-tabular leading-none">
            {kpis.gain >= 0 ? '' : '−'}{fmtARS(kpis.gain)}
          </p>
          <p className="text-xs text-blue-300">{periodLabel}</p>
          <div className="my-auto">
            <KpiSparkline data={sparklines.balance} color="#93c5fd" height={38} />
          </div>
        </div>

        {/* Card 4 — Rentabilidad (donut egresos vs ganancia) */}
        <div className="executive-card p-2.5 sm:p-4 flex flex-col items-center">
          <p className="text-xs font-semibold text-gray-800 mb-0.5 self-start">Rentabilidad</p>
          <div className="w-full flex-1 flex items-center justify-center">
            <ProfitabilityDonut expense={kpis.expense} gain={kpis.gain} height={140} />
          </div>
          <p className="text-[10px] text-gray-400 leading-none">Ingresos totales</p>
          <p className="text-lg font-mono font-semibold text-gray-800 leading-tight mt-0.5">
            {fmtARS(kpis.income)}
          </p>
        </div>

      </section>

      {/* ══ FILA 2 — GRÁFICO PRINCIPAL (ancho completo) ══════════════════════ */}
      <div className="mb-4 md:mb-5">
        <div className="executive-card flex flex-col overflow-hidden">
          <div className="px-5 py-3.5 border-b border-black/[0.05] flex justify-between items-center flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Resumen financiero</h2>
              <p className="text-xs text-gray-400">Ingresos · Egresos · Ganancia — {periodLabel}</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400">
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
    <div className="p-3 sm:p-5 lg:p-6 max-w-[1920px] mx-auto font-sans text-gray-800 min-h-screen bg-gray-50">

      {/* ══ FILA 0 — HEADER EJECUTIVO (renders immediately) ══════════════════ */}
      <header className="mb-4 border border-stone-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:mb-6 lg:-mx-6 lg:-mt-6 lg:mb-6 lg:border-x-0 lg:border-t-0 lg:shadow-none">
        <div className="px-4 py-4 sm:px-5 lg:min-h-[88px] lg:px-6 lg:py-0">
          <div className="flex flex-col gap-4 lg:h-full lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
              <span>Inicio</span>
              <span className="h-1 w-1 rounded-full bg-stone-300" />
              <span>{sessionContext.activeBusiness.name}</span>
              <span className="inline-flex items-center border border-[#d9cfba] bg-[#f6efe2] px-2 py-1 text-[10px] font-medium normal-case tracking-normal text-[#7a6850]">
                {sessionContext.activeBusiness.role === 'ADMIN' ? 'Administrador' : sessionContext.activeBusiness.role === 'COLLABORATOR' ? 'Colaborador' : 'Visualizador'}
              </span>
            </div>

            <DashboardUserMenu
              user={sessionContext.user}
              business={{
                name: sessionContext.activeBusiness.name,
                role: sessionContext.activeBusiness.role,
              }}
              authProvider={sessionContext.auth.provider}
            />
          </div>
        </div>
      </header>

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

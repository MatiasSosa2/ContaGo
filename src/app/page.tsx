import { getDashboardStats, getAssetSnapshotAsOf, getCashFlowKpis } from '@/app/actions'
import { EvolutionTabs } from '@/components/DashboardCharts'
import AppHeader from '@/components/AppHeader'
import PeriodSelector from '@/components/PeriodSelector'
import type { PeriodKey } from '@/components/PeriodSelector'
import { requireBusinessContext } from '@/server/auth/require-business-context'
import { Suspense } from 'react'
import KpiNumber from '@/components/dashboard/KpiNumber'
import Link from 'next/link'
import BienesDeUsoModal from '@/components/BienesDeUsoModal'

export const dynamic = 'force-dynamic'

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
  return '$' + Math.round(Math.abs(v)).toLocaleString('es-AR')
}

/** Un decimal con coma (es-AR): 22,1 */
function dec1(v: number) {
  return v.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function variationState(value: number | null, trend: 'direct' | 'inverse' = 'direct') {
  if (value === null) return { label: 'Sin comparación', positive: null, favorable: null }
  const positive = value >= 0
  const favorable = trend === 'inverse' ? !positive : positive
  return {
    label: `${positive ? '▲ +' : '▼ '}${dec1(Math.abs(value))}%`,
    positive,
    favorable,
  }
}

/** Pastilla iOS: fondo suave verde (favorable), rojo (desfavorable) o gris (sin comparación) */
function variationClass(state: ReturnType<typeof variationState>) {
  if (state.favorable === null) return 'bg-black/[0.04] text-stone-400 dark:bg-white/[0.06] dark:text-stone-500'
  return state.favorable
    ? 'bg-[#34C759]/[0.12] text-[#248A3D] dark:bg-[#30D158]/[0.16] dark:text-[#30D158]'
    : 'bg-[#FF3B30]/[0.10] text-[#D70015] dark:bg-[#FF453A]/[0.16] dark:text-[#FF6961]'
}

// ── Async content component ────────────────────────────────────────────────────
async function DashboardContent({
  businessId, periodo, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart,
}: {
  businessId: string
  periodo: PeriodKey
  customFrom?: string
  customTo?: string
  selectedYear?: number
  selectedMonth?: number
  selectedDay?: string
  selectedWeekStart?: string
}) {
  const [stats, snapshot, cashFlow] = await Promise.all([
    getDashboardStats(periodo, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart),
    getAssetSnapshotAsOf(periodo, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart),
    getCashFlowKpis(periodo, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart),
  ])

  const { chartData, chartTx, categoryBreakdown, incomeCategoryBreakdown } = stats
  // Ingresos, egresos y variación neta = Estado de flujo de efectivo (pesos), igual que Informes:
  // la variación incluye el cambio de moneda. Rentabilidad y ROA salen de la ganancia neta del
  // Estado de resultados (no de la caja).
  const toKpis = (f: { ingresos: number; egresos: number; cambioMoneda: number }, er: { ingresos: number; gananciaNeta: number }) => ({
    income: f.ingresos,
    expense: f.egresos,
    gain: f.ingresos - f.egresos + f.cambioMoneda,
    cambioMoneda: f.cambioMoneda,
    netProfit: er.gananciaNeta,
    marginPct: er.ingresos > 0 ? (er.gananciaNeta / er.ingresos) * 100 : 0,
    hasSales: er.ingresos > 0,
  })
  const kpis = toKpis(cashFlow.current, cashFlow.resultados)
  const prevKpis = toKpis(cashFlow.prev, cashFlow.prevResultados)
  // Si el negocio empezó a cargar a mitad del período anterior, no se compara
  const comparable = cashFlow.prevComparable

  const incomeGrowth = comparable && prevKpis.income > 0 ? ((kpis.income - prevKpis.income) / prevKpis.income) * 100 : null
  const expenseGrowth = comparable && prevKpis.expense > 0 ? ((kpis.expense - prevKpis.expense) / prevKpis.expense) * 100 : null
  const gainGrowth = comparable && prevKpis.gain !== 0 ? ((kpis.gain - prevKpis.gain) / Math.abs(prevKpis.gain)) * 100 : null

  const gainIsPositive = kpis.gain >= 0

  const incomeV = variationState(incomeGrowth)
  const expenseV = variationState(expenseGrowth, 'inverse')
  const gainV = variationState(gainGrowth)

  const { totalACobrar, totalAPagar, stockTotal, bienesTotal, cmvPeriod, prev } = snapshot
  // Caja = saldo real de las cajas en pesos al cierre del período (igual que la pestaña Cajas)
  const cajaTotal = cashFlow.current.saldoFinal
  const cajaUsd = cashFlow.usdSaldoFinal

  // Total de activos al cierre del período (para ROA)
  const activosTotal = cajaTotal + totalACobrar + stockTotal + bienesTotal
  const roaPct = activosTotal > 0 ? (kpis.netProfit / activosTotal) * 100 : 0
  const rotacionInventario = stockTotal > 0 ? cmvPeriod / stockTotal : 0

  // Variaciones vs período anterior
  const prevActivosTotal = cashFlow.prev.saldoFinal + prev.totalACobrar + prev.stockTotal + prev.bienesTotal
  const prevRoaPct = prevActivosTotal > 0 ? (prevKpis.netProfit / prevActivosTotal) * 100 : 0
  const prevRotacion = prev.stockTotal > 0 ? prev.cmvPeriod / prev.stockTotal : 0

  const rentDelta = comparable && kpis.hasSales && prevKpis.hasSales ? kpis.marginPct - prevKpis.marginPct : null
  const roaDelta = comparable && activosTotal > 0 && prevActivosTotal > 0 ? roaPct - prevRoaPct : null
  const rotDelta = comparable && stockTotal > 0 && prev.stockTotal > 0 ? rotacionInventario - prevRotacion : null

  const deltaClass = (d: number | null) =>
    d === null ? 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'
    : d >= 0 ? 'bg-[#E8F5EC] text-[#15803D] dark:bg-[#15321F] dark:text-[#86EFAC]'
    : 'bg-[#FDECEC] text-[#B91C1C] dark:bg-[#3A1717] dark:text-[#FCA5A5]'
  const deltaArrow = (d: number | null) => (d === null ? '' : d >= 0 ? '▲' : '▼')


  return (
    <>
      {/* ══ SECCIÓN 1 — KPIs principales (3 columnas) ════════════════ */}
      <section className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">

        {/* KPI Ingresos — verde */}
        <div className="flex flex-col gap-3 rounded-2xl border border-[#D5E3D8] bg-white p-7 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-[#1E3627] dark:bg-[#141414] dark:shadow-none">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2D6A4F] dark:text-[#8FD0A7]">Ingresos</span>
            <span title={incomeV.positive === null ? undefined : 'vs el período anterior'} className={`rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums transition-colors ${variationClass(incomeV)}`}>{incomeV.label}</span>
          </div>
          <p className="mt-3 font-mono text-[34px] font-bold leading-none tracking-[-0.03em] text-[#1F2937] dark:text-[#E8E8E8] num-tabular">
            <KpiNumber id="ingresos" value={kpis.income} />
          </p>
        </div>

        {/* KPI Egresos — rojo */}
        <div className="flex flex-col gap-3 rounded-2xl border border-[#F3D6D6] bg-white p-7 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-[#2E1919] dark:bg-[#141414] dark:shadow-none">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#B91C1C] dark:text-[#F87171]">Egresos</span>
            <span title={expenseV.positive === null ? undefined : 'vs el período anterior'} className={`rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums transition-colors ${variationClass(expenseV)}`}>{expenseV.label}</span>
          </div>
          <p className="mt-3 font-mono text-[34px] font-bold leading-none tracking-[-0.03em] text-[#1F2937] dark:text-[#E8E8E8] num-tabular">
            <KpiNumber id="egresos" value={kpis.expense} />
          </p>
        </div>

        {/* KPI Variación neta de caja (entró − salió ± cambio de moneda) — celeste */}
        <div className={`flex flex-col gap-3 rounded-2xl border p-7 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-none ${
          gainIsPositive ? 'border-[#BAE6FD] bg-white dark:border-[#0C3450] dark:bg-[#141414]' : 'border-[#F3D6D6] bg-white dark:border-[#2E1919] dark:bg-[#141414]'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${gainIsPositive ? 'text-[#0369A1] dark:text-[#38BDF8]' : 'text-[#B91C1C] dark:text-[#F87171]'}`}>
              Variación neta
            </span>
            <span title={gainV.positive === null ? undefined : 'vs el período anterior'} className={`rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums transition-colors ${variationClass(gainV)}`}>{gainV.label}</span>
          </div>
          <p className={`mt-3 font-mono text-[34px] font-bold leading-none tracking-[-0.03em] num-tabular ${
            gainIsPositive ? 'text-[#0369A1] dark:text-[#38BDF8]' : 'text-[#B91C1C] dark:text-[#F87171]'
          }`}>
            <KpiNumber id="variacion" value={kpis.gain} conSigno />
          </p>
          {/* Mismo número que la Variación neta de Informes: aclara el cambio de moneda si lo hubo */}
          {kpis.cambioMoneda !== 0 && (
            <p className="mt-3 text-[11px] text-stone-400">
              Incluye cambio de moneda {kpis.cambioMoneda < 0 ? '−' : '+'}{fmt(kpis.cambioMoneda)}
            </p>
          )}
        </div>
      </section>
      <div className="mb-5">
        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
          {/* Título solo, sobre blanco (sin franja) */}
          <h2 className="px-5 pt-4 text-[15px] font-semibold tracking-[-0.01em] text-[#1F2937] dark:text-[#E8E8E8]">
            Evolución financiera
          </h2>
          <EvolutionTabs chartData={chartData} chartTx={chartTx} categoryBreakdown={categoryBreakdown} incomeCategoryBreakdown={incomeCategoryBreakdown} />
        </div>
      </div>

      {/* ══ SECCIÓN 3 — RESUMEN OPERATIVO 2×2 ══════════════════════════════ */}
      <section className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">

        {/* Caja */}
        <Link
          href="/cajas"
          className="group flex flex-col rounded-2xl border-2 border-[#2D5A41]/20 bg-[#FFFFFF] p-7 min-h-[180px] shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition duration-200 hover:-translate-y-1 hover:border-[#2D5A41]/50 hover:shadow-[0_10px_24px_rgba(15,23,42,0.10)] dark:border-[#9AC7A8]/40 dark:hover:border-[#9AC7A8]/80 dark:bg-[#141414] dark:shadow-none"
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F0F5F2] text-[#4F7A63] dark:bg-[#1F3428] dark:text-[#9AC7A8]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Caja</span>
          </div>
          {/* Monto centrado en el espacio que queda debajo del título */}
          <div className="flex flex-1 flex-col justify-center">
          <p className="font-mono text-[2.025rem] font-bold leading-tight num-tabular text-[#1F2937] dark:text-[#E8E8E8]">{cajaTotal < 0 ? '−' : ''}{fmt(cajaTotal)}</p>
          {cajaUsd !== 0 && (
            <p className="mt-1 font-mono text-sm font-semibold num-tabular text-stone-500 dark:text-stone-400">
              {cajaUsd < 0 ? '− ' : '+ '}US${Math.abs(cajaUsd).toLocaleString('es-AR', { maximumFractionDigits: 2 })}
            </p>
          )}
          </div>
        </Link>

        {/* Créditos / Deudas */}
        <Link
          href="/creditos"
          className="group flex flex-col rounded-2xl border-2 border-[#C2410C]/20 bg-[#FFFFFF] p-7 min-h-[180px] shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition duration-200 hover:-translate-y-1 hover:border-[#C2410C]/50 hover:shadow-[0_10px_24px_rgba(15,23,42,0.10)] dark:border-[#F97316]/40 dark:hover:border-[#F97316]/80 dark:bg-[#141414] dark:shadow-none"
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFF7EF] text-[#D97757] dark:bg-[#2A1810] dark:text-[#F97316]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Créditos / Deudas</span>
          </div>
          {/* Monto centrado en el espacio que queda debajo del título */}
          <div className="flex flex-1 flex-col justify-center">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[10px] font-semibold text-emerald-500/80 dark:text-emerald-400">A cobrar</p>
              <p className="font-mono text-[1.15rem] font-bold leading-tight num-tabular text-[#1F2937] dark:text-[#E8E8E8] whitespace-nowrap">{fmt(totalACobrar)}</p>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[10px] font-semibold text-red-500/80 dark:text-red-400">A pagar</p>
              <p className="font-mono text-[1.15rem] font-bold leading-tight num-tabular text-[#1F2937] dark:text-[#E8E8E8] whitespace-nowrap">{fmt(totalAPagar)}</p>
            </div>
          </div>
          </div>
        </Link>

        {/* Stock */}
        <Link
          href="/stock"
          className="group flex flex-col rounded-2xl border-2 border-[#7C3AED]/20 bg-[#FFFFFF] p-7 min-h-[180px] shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition duration-200 hover:-translate-y-1 hover:border-[#7C3AED]/50 hover:shadow-[0_10px_24px_rgba(15,23,42,0.10)] dark:border-[#A78BFA]/40 dark:hover:border-[#A78BFA]/80 dark:bg-[#141414] dark:shadow-none"
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F7F4FE] text-[#9B7BD8] dark:bg-[#1E1830] dark:text-[#A78BFA]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Stock</span>
          </div>
          {/* Monto centrado en el espacio que queda debajo del título */}
          <div className="flex flex-1 flex-col justify-center">
          <p className="font-mono text-[2.025rem] font-bold leading-tight num-tabular text-[#1F2937] dark:text-[#E8E8E8]">{fmt(stockTotal)}</p>
          </div>
        </Link>

        {/* Bienes de Uso */}
        <BienesDeUsoModal bienesTotal={bienesTotal} />
      </section>

      {/* ══ SECCIÓN 4 — INDICADORES CLAVE ══════════════════════════════════ */}
      <section className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">

        {/* Rentabilidad */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
          <div className="flex flex-1 flex-col p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E0F2FE] text-[#0369A1] dark:bg-[#0C2A3E] dark:text-[#38BDF8]">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941" /></svg>
                </span>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-stone-400">Rentabilidad</p>
              </div>
              <span className={`flex flex-col items-end rounded-md px-2 py-1 text-[10px] font-semibold leading-tight ${deltaClass(rentDelta)}`}>
                <span>{deltaArrow(rentDelta)} {rentDelta === null ? '—' : `${rentDelta >= 0 ? '+' : ''}${dec1(rentDelta)} pp`}</span>
                <span className="text-[9px] font-medium opacity-80">vs anterior</span>
              </span>
            </div>
            <p className="font-mono text-3xl font-bold leading-none num-tabular text-[#0369A1] dark:text-[#38BDF8]">
              {kpis.hasSales ? `${dec1(kpis.marginPct)}%` : '—'}
            </p>
            <p className="mt-2 text-[11px] text-stone-400 dark:text-stone-500">Ganancia neta / Ingresos</p>
          </div>
          <div className="h-1.5 bg-[#E0F2FE] dark:bg-[#0C2A3E]">
            <div className="h-full bg-gradient-to-r from-[#0369A1] to-[#38BDF8]" style={{ width: `${Math.min(100, Math.max(0, kpis.marginPct))}%` }} />
          </div>
        </div>

        {/* ROA — Rentabilidad sobre Activos */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
          <div className="flex flex-1 flex-col p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#CCFBF1] text-[#0D9488] dark:bg-[#0C2E2A] dark:text-[#5EEAD4]">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </span>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-stone-400">ROA</p>
              </div>
              <span className={`flex flex-col items-end rounded-md px-2 py-1 text-[10px] font-semibold leading-tight ${deltaClass(roaDelta)}`}>
                <span>{deltaArrow(roaDelta)} {roaDelta === null ? '—' : `${roaDelta >= 0 ? '+' : ''}${dec1(roaDelta)} pp`}</span>
                <span className="text-[9px] font-medium opacity-80">vs anterior</span>
              </span>
            </div>
            <p className="font-mono text-3xl font-bold leading-none num-tabular text-[#0D9488] dark:text-[#5EEAD4]">
              {activosTotal > 0 ? `${dec1(roaPct)}%` : '—'}
            </p>
            <p className="mt-2 text-[11px] text-stone-400 dark:text-stone-500">Ganancia neta / Activos</p>
          </div>
          <div className="h-1.5 bg-[#CCFBF1] dark:bg-[#0C2E2A]">
            <div className="h-full bg-gradient-to-r from-[#0D9488] to-[#5EEAD4]" style={{ width: `${Math.min(100, Math.max(0, roaPct))}%` }} />
          </div>
        </div>

        {/* Rotación de Inventario */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
          <div className="flex flex-1 flex-col p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EFEAFB] text-[#7C3AED] dark:bg-[#1E1830] dark:text-[#A78BFA]">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                </span>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-stone-400">Rotación de Inventario</p>
              </div>
              <span className={`flex flex-col items-end rounded-md px-2 py-1 text-[10px] font-semibold leading-tight ${deltaClass(rotDelta)}`}>
                <span>{deltaArrow(rotDelta)} {rotDelta === null ? '—' : `${rotDelta >= 0 ? '+' : ''}${dec1(rotDelta)}×`}</span>
                <span className="text-[9px] font-medium opacity-80">vs anterior</span>
              </span>
            </div>
            <p className="font-mono text-3xl font-bold leading-none num-tabular text-[#7C3AED] dark:text-[#A78BFA]">
              {stockTotal > 0 ? `${dec1(rotacionInventario)}×` : '—'}
            </p>
            <p className="mt-2 text-[11px] text-stone-400 dark:text-stone-500">Costo de mercadería vendida / Inventario</p>
          </div>
          <div className="h-1.5 bg-[#EFEAFB] dark:bg-[#1E1830]">
            <div className="h-full bg-gradient-to-r from-[#7C3AED] to-[#A78BFA]" style={{ width: `${Math.min(100, (rotacionInventario / 12) * 100)}%` }} />
          </div>
        </div>
      </section>


    </>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; from?: string; to?: string; year?: string; month?: string; day?: string; weekStart?: string }>
}) {
  const [sessionContext, sp] = await Promise.all([requireBusinessContext(), searchParams])
  const businessId = sessionContext.activeBusiness.id

  const periodo = (sp.periodo ?? 'mensual') as PeriodKey
  const customFrom = sp.from
  const customTo = sp.to
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1
  const selectedYear = sp.year
    ? Number.parseInt(sp.year, 10)
    : (periodo === 'mensual' || periodo === 'anual' ? currentYear : undefined)
  const selectedMonth = sp.month
    ? Number.parseInt(sp.month, 10)
    : (periodo === 'mensual' ? currentMonth : undefined)
  const selectedDay = sp.day
  const selectedWeekStart = sp.weekStart

  return (
    <div className="mx-auto min-h-screen max-w-[1920px] bg-[#F7F9FB] p-4 font-sans text-[#1F2937] dark:bg-black dark:text-gray-100 sm:p-6 lg:p-8">


      {/* ── Header con selector de período moderno ───────────────────────────── */}
      <AppHeader
        title="Balance General"
        sessionContext={sessionContext}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        }
        actions={
          <Suspense fallback={null}>
            <PeriodSelector
              active={periodo}
              customFrom={customFrom}
              customTo={customTo}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              selectedDay={selectedDay}
              selectedWeekStart={selectedWeekStart}
            />
          </Suspense>
        }
      />

      {/* ── Dashboard streaming ──────────────────────────────────────────────── */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent
          businessId={businessId}
          periodo={periodo}
          customFrom={customFrom}
          customTo={customTo}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          selectedDay={selectedDay}
          selectedWeekStart={selectedWeekStart}
        />
      </Suspense>
    </div>
  )
}


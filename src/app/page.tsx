import { getDashboardStats, getAssetSnapshotAsOf, getCashFlowKpis } from '@/app/actions'
import { EvolutionTabs } from '@/components/DashboardCharts'
import AppHeader from '@/components/AppHeader'
import PeriodSelector from '@/components/PeriodSelector'
import type { PeriodKey } from '@/components/PeriodSelector'
import { requireBusinessContext } from '@/server/auth/require-business-context'
import { getArtCalendarParts, sanitizePeriodParams } from '@/lib/art-calendar'
import { Suspense } from 'react'
import KpiNumber from '@/components/dashboard/KpiNumber'
import Link from 'next/link'
import BienesDeUsoModal from '@/components/BienesDeUsoModal'
import { periodQueryFrom } from '@/lib/period-navigation'
import { CARD_CLS, CARD_LINK_CLS, CardHeader, SUMMARY_VALUE_CLS } from '@/components/dashboard/cards'

export const dynamic = 'force-dynamic'

// -- Skeleton ------------------------------------------------------------------
function DashboardSkeleton() {
  const bloque = `${CARD_CLS} animate-pulse`
  return (
    <>
      <div className={`mb-5 h-[148px] ${bloque}`} />
      <div className={`mb-5 h-[380px] ${bloque}`} />
      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map(i => <div key={i} className={`h-[132px] ${bloque}`} />)}
      </section>
      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map(i => <div key={i} className={`h-[140px] ${bloque}`} />)}
      </section>
    </>
  )
}

// -- Helpers --------------------------------------------------------------------
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
  if (state.favorable === null) return 'bg-black/[0.04] text-[var(--text-tertiary)] dark:bg-white/[0.06] dark:text-[var(--text-tertiary)]'
  return state.favorable
    ? 'bg-[var(--ds-green)]/[0.12] text-[var(--ds-green-strong)] dark:bg-[var(--ds-green-dark)]/[0.16] dark:text-[var(--ds-green-dark)]'
    : 'bg-[var(--ds-red)]/[0.10] text-[var(--ds-red-strong)] dark:bg-[var(--ds-red-dark)]/[0.16] dark:text-[var(--ds-coral)]'
}

// -- Async content component ----------------------------------------------------
async function DashboardContent({
  periodo, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart, periodQuery,
}: {
  periodo: PeriodKey
  customFrom?: string
  customTo?: string
  selectedYear?: number
  selectedMonth?: number
  selectedDay?: string
  selectedWeekStart?: string
  periodQuery: string
}) {
  const sectionHref = (path: string) => `${path}${periodQuery ? `?${periodQuery}` : ''}`
  const [stats, snapshot, cashFlow] = await Promise.all([
    getDashboardStats(periodo, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart),
    getAssetSnapshotAsOf(periodo, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart),
    getCashFlowKpis(periodo, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart),
  ])

  const { chartData, chartTx, categoryBreakdown, incomeCategoryBreakdown, debtStatus } = stats
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

  const { totalACobrar, totalAPagar, stockTotal, bienesTotal, cmvPeriod, prev, fxRate, fxSource } = snapshot
  // Caja = saldo real de las cajas en pesos al cierre del período (igual que la pestaña Cajas)
  const cajaTotal = cashFlow.current.saldoFinal
  const cajaUsd = cashFlow.usdSaldoFinal

  // Disponible para usar = caja al cierre del período menos las deudas urgentes
  // (vencidas + las que vencen en las próximas 48 hs). Las deudas futuras se informan aparte.
  const deudasUrgentes = debtStatus.vencidos.total + debtStatus.en48hs.total
  const deudasFuturas = debtStatus.futuros.total
  const disponible = cajaTotal - deudasUrgentes
  const disponibleOk = disponible >= 0

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
    d === null ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
    : d >= 0 ? 'bg-[var(--income-soft)] text-[var(--income)]'
    : 'bg-[var(--expense-soft)] text-[var(--expense)]'
  const deltaArrow = (d: number | null) => (d === null ? '' : d > 0 ? '↑' : d < 0 ? '↓' : '→')


  return (
    <>
      {/* -- SECCIÓN 1 — KPIs principales: 3 tarjetas separadas ----------------- */}
      <section className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className={`${CARD_CLS} flex min-h-[156px] min-w-0 flex-col p-5 sm:p-6`}>
          <CardHeader label="Ingresos" tone={'income'} icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 4.5l-15 15m0 0h11.25m-11.25 0V8.25" /></svg>} />
          <p className={`mt-auto text-[clamp(26px,2.4vw,36px)] font-semibold leading-none tracking-[-0.04em] tabular-nums ${'text-[#1C1C1E] dark:text-white'}`}>
            <KpiNumber id="ingresos" value={kpis.income} />
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold tabular-nums transition-colors ${variationClass(incomeV)}`}>{incomeV.label}</span>
            {incomeV.positive !== null && <span className="text-[12px] text-[#8E8E93]">vs período anterior</span>}
          </div>
        </div>
        <div className={`${CARD_CLS} flex min-h-[156px] min-w-0 flex-col p-5 sm:p-6`}>
          <CardHeader label="Egresos" tone={'expense'} icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg>} />
          <p className={`mt-auto text-[clamp(26px,2.4vw,36px)] font-semibold leading-none tracking-[-0.04em] tabular-nums ${'text-[#1C1C1E] dark:text-white'}`}>
            <KpiNumber id="egresos" value={kpis.expense} />
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold tabular-nums transition-colors ${variationClass(expenseV)}`}>{expenseV.label}</span>
            {expenseV.positive !== null && <span className="text-[12px] text-[#8E8E93]">vs período anterior</span>}
          </div>
        </div>
        <div className={`${CARD_CLS} flex min-h-[156px] min-w-0 flex-col p-5 sm:p-6`}>
          <CardHeader label="Variación neta" tone={gainIsPositive ? 'income' : 'expense'} icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" /></svg>} />
          <p className={`mt-auto text-[clamp(26px,2.4vw,36px)] font-semibold leading-none tracking-[-0.04em] tabular-nums ${gainIsPositive ? 'text-[var(--income)]' : 'text-[var(--expense)]'}`}>
            <KpiNumber id="variacion" value={kpis.gain} conSigno />
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold tabular-nums transition-colors ${variationClass(gainV)}`}>{gainV.label}</span>
            {gainV.positive !== null && <span className="text-[12px] text-[#8E8E93]">vs período anterior</span>}
          </div>
          {/* Mismo número que la Variación neta de Informes: aclara el cambio de moneda si lo hubo */}
          {kpis.cambioMoneda !== 0 && (
            <p className="mt-2 text-[11px] text-[#8E8E93]">
              Incluye cambio de moneda {kpis.cambioMoneda < 0 ? '-' : '+'}{fmt(kpis.cambioMoneda)}
            </p>
          )}
        </div>
      </section>

      {/* Evolución: sin título; arriba el selector y la leyenda en una sola fila */}
      <div className={`mb-5 overflow-hidden ${CARD_CLS}`}>
        <EvolutionTabs chartData={chartData} chartTx={chartTx} categoryBreakdown={categoryBreakdown} incomeCategoryBreakdown={incomeCategoryBreakdown} />
      </div>

      {/* -- SECCIÓN 3 — RESUMEN OPERATIVO ----------------------------------- */}
      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">

        {/* Caja */}
        <Link href={sectionHref('/cajas')} className={CARD_LINK_CLS}>
          <CardHeader
            label="Caja"
            icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
          />
          <div className="flex flex-1 flex-col justify-end">
            <p className={SUMMARY_VALUE_CLS}>{cajaTotal < 0 ? '-' : ''}{fmt(cajaTotal)}</p>
            {cajaUsd !== 0 && (
              <p className="mt-1.5 w-fit rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[#636366] dark:bg-white/[0.08] dark:text-[#AEAEB2]">
                {cajaUsd < 0 ? '- ' : '+ '}US${Math.abs(cajaUsd).toLocaleString('es-AR', { maximumFractionDigits: 2 })}
              </p>
            )}
          </div>
        </Link>

        {/* Disponible para usar: caja menos deudas urgentes (vencidas + 48 hs) */}
        <Link
          href={sectionHref('/creditos')}
          title={`Caja ${fmt(cajaTotal)} menos compromisos urgentes ${fmt(deudasUrgentes)}${deudasFuturas > 0 ? `; futuras ${fmt(deudasFuturas)}` : ''}${fxRate !== null ? `; dólar ${fxSource === 'dolarapi' ? 'oficial' : 'registrado'} $${Math.round(fxRate).toLocaleString('es-AR')}` : ''}`}
          className={CARD_LINK_CLS}
        >
          <CardHeader
            label="Disponible"
            tone={disponibleOk ? 'income' : 'expense'}
            icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" /></svg>}
          />
          <div className="flex flex-1 flex-col justify-end">
            <p className={`${SUMMARY_VALUE_CLS} ${disponibleOk ? '!text-[var(--income)]' : '!text-[var(--expense)]'}`}>{disponible < 0 ? '-' : ''}{fmt(disponible)}</p>
            <p className="mt-1.5 text-[11px] leading-4 text-[#8E8E93]">Neto de deudas urgentes</p>
          </div>
        </Link>

        {/* Créditos / Deudas */}
        <Link href={sectionHref('/creditos')} className={CARD_LINK_CLS}>
          <CardHeader
            label="Créditos / Deudas"
            icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>}
          />
          <div className="flex flex-1 flex-col justify-end gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="shrink-0 text-[11px] text-[#8E8E93]">A cobrar</p>
              <p className="min-w-0 truncate text-right text-[15px] font-semibold tabular-nums text-[var(--income)]">{fmt(totalACobrar)}</p>
            </div>
            <div className="flex items-baseline justify-between gap-2 border-t border-black/[0.06] pt-1.5 dark:border-white/[0.08]">
              <p className="shrink-0 text-[11px] text-[#8E8E93]">A pagar</p>
              <p className="min-w-0 truncate text-right text-[15px] font-semibold tabular-nums text-[var(--expense)]">{fmt(totalAPagar)}</p>
            </div>
          </div>
        </Link>

        {/* Stock */}
        <Link href={sectionHref('/stock')} className={CARD_LINK_CLS}>
          <CardHeader
            label="Stock"
            icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
          />
          <div className="flex flex-1 flex-col justify-end">
            <p className={SUMMARY_VALUE_CLS}>{fmt(stockTotal)}</p>
          </div>
        </Link>

        {/* Bienes de Uso */}
        <BienesDeUsoModal bienesTotal={bienesTotal} />
      </section>

      {/* -- SECCIÓN 4 — INDICADORES CLAVE ---------------------------------- */}
      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">

        {/* Rentabilidad */}
        <div className={`${CARD_CLS} flex min-w-0 flex-col overflow-hidden`}>
          <div className="flex flex-1 flex-col p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--income-soft)] text-[var(--income)]">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941" /></svg>
                </span>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">Rentabilidad</p>
              </div>
              <span className={`flex flex-col items-end rounded-md px-2 py-1 text-[10px] font-semibold leading-tight ${deltaClass(rentDelta)}`}>
                <span>{deltaArrow(rentDelta)} {rentDelta === null ? '—' : `${rentDelta >= 0 ? '+' : ''}${dec1(rentDelta)} pp`}</span>
                <span className="text-[11px] font-medium opacity-80">vs anterior</span>
              </span>
            </div>
            <p className="font-mono text-3xl font-bold leading-none num-tabular text-[var(--income)]">
              {kpis.hasSales ? `${dec1(kpis.marginPct)}%` : '—'}
            </p>
            <p className="mt-2 text-[11px] text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)]">Ganancia neta / Ingresos</p>
          </div>
          <div className="h-1.5 bg-[var(--income-soft)]">
            <div className="h-full bg-[var(--income)]" style={{ width: `${Math.min(100, Math.max(0, kpis.marginPct))}%` }} />
          </div>
        </div>

        {/* ROA — Rentabilidad sobre Activos */}
        <div className={`${CARD_CLS} flex min-w-0 flex-col overflow-hidden`}>
          <div className="flex flex-1 flex-col p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--income-soft)] text-[var(--income)]">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </span>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">ROA</p>
              </div>
              <span className={`flex flex-col items-end rounded-md px-2 py-1 text-[10px] font-semibold leading-tight ${deltaClass(roaDelta)}`}>
                <span>{deltaArrow(roaDelta)} {roaDelta === null ? '—' : `${roaDelta >= 0 ? '+' : ''}${dec1(roaDelta)} pp`}</span>
                <span className="text-[11px] font-medium opacity-80">vs anterior</span>
              </span>
            </div>
            <p className="font-mono text-3xl font-bold leading-none num-tabular text-[var(--income)]">
              {activosTotal > 0 ? `${dec1(roaPct)}%` : '—'}
            </p>
            <p className="mt-2 text-[11px] text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)]">Ganancia neta / Activos</p>
          </div>
          <div className="h-1.5 bg-[var(--income-soft)]">
            <div className="h-full bg-[var(--income)]" style={{ width: `${Math.min(100, Math.max(0, roaPct))}%` }} />
          </div>
        </div>

        {/* Rotación de Inventario */}
        <div className={`${CARD_CLS} flex min-w-0 flex-col overflow-hidden`}>
          <div className="flex flex-1 flex-col p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand-100)] text-[var(--brand-700)] dark:bg-[var(--brand-800)] dark:text-[var(--brand-300)]">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                </span>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">Rotación de Inventario</p>
              </div>
              <span className={`flex flex-col items-end rounded-md px-2 py-1 text-[10px] font-semibold leading-tight ${deltaClass(rotDelta)}`}>
                <span>{deltaArrow(rotDelta)} {rotDelta === null ? '—' : `${rotDelta >= 0 ? '+' : ''}${dec1(rotDelta)}×`}</span>
                <span className="text-[11px] font-medium opacity-80">vs anterior</span>
              </span>
            </div>
            <p className="font-mono text-3xl font-bold leading-none num-tabular text-[var(--ds-violet)] dark:text-[var(--ds-violet-light)]">
              {stockTotal > 0 ? `${dec1(rotacionInventario)}×` : '—'}
            </p>
            <p className="mt-2 text-[11px] text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)]">Costo de mercadería vendida / Inventario</p>
          </div>
          <div className="h-1.5 bg-[var(--brand-100)] dark:bg-[var(--brand-800)]">
            <div className="h-full bg-[var(--brand-700)] dark:bg-[var(--brand-300)]" style={{ width: `${Math.min(100, (rotacionInventario / 12) * 100)}%` }} />
          </div>
        </div>
      </section>


    </>
  )
}

// -- Página principal ----------------------------------------------------------
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; from?: string; to?: string; year?: string; month?: string; day?: string; weekStart?: string }>
}) {
  const [sessionContext, sp] = await Promise.all([requireBusinessContext(), searchParams])
  // La URL se valida antes de usarla: lo inválido (período desconocido, año "abc", fechas
  // que no existen) vuelve al valor por defecto en vez de romper la página
  const clean = sanitizePeriodParams({
    period: sp.periodo, customFrom: sp.from, customTo: sp.to,
    selectedYear: sp.year, selectedMonth: sp.month, selectedDay: sp.day, selectedWeekStart: sp.weekStart,
  })
  const periodo: PeriodKey = clean.period
  const { customFrom, customTo, selectedDay, selectedWeekStart } = clean
  const today = getArtCalendarParts()
  const currentYear = today.year
  const currentMonth = today.monthIndex + 1
  const selectedYear = clean.selectedYear
    ?? (periodo === 'mensual' || periodo === 'anual' ? currentYear : undefined)
  const selectedMonth = clean.selectedMonth
    ?? (periodo === 'mensual' ? currentMonth : undefined)

  return (
    <div className="premium-page dashboard-polish mx-auto min-h-screen max-w-[1920px] bg-[var(--surface-muted)] p-4 font-sans text-[var(--text)] sm:p-6 lg:p-8">


      {/* -- Header con selector de período moderno ----------------------------- */}
      <AppHeader
        title="Inicio"
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

      {/* -- Dashboard streaming ------------------------------------------------ */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent
          periodo={periodo}
          customFrom={customFrom}
          customTo={customTo}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          selectedDay={selectedDay}
          selectedWeekStart={selectedWeekStart}
          periodQuery={periodQueryFrom(sp)}
        />
      </Suspense>
    </div>
  )
}

import ResultadosDetail, { type ResultsTrends } from '@/components/financial-statements/ResultadosDetail'
import FlujoDetail, { type CashTrends } from '@/components/financial-statements/FlujoDetail'
import PatrimonioDetail, { type BalanceTrends } from '@/components/financial-statements/PatrimonioDetail'
import AutoPrint from '@/components/financial-statements/AutoPrint'
import { SF_FONT } from '@/components/financial-statements/modern'
import { getBalanceSheet, getCashStatement, getYearlySeries } from '@/app/actions'
import { getReportsViewData, previousPeriodArgs, type ReportsSearchParams } from '../reportsData'
import { Suspense, type ReactNode } from 'react'

export const dynamic = 'force-dynamic'

function Seccion({ titulo, children, salto }: { titulo: string; children: ReactNode; salto?: boolean }) {
  return (
    <section className={salto ? 'print-page-break' : ''}>
      <h2 className="mb-3 text-[20px] font-bold tracking-tight text-[#1C1C1E] dark:text-white">{titulo}</h2>
      {children}
    </section>
  )
}

/** Informe completo para exportar: los 3 estados uno debajo del otro, listo para imprimir / PDF */
export default async function InformeCompletoPage({ searchParams }: { searchParams?: Promise<ReportsSearchParams> }) {
  const {
    sessionContext,
    periodo,
    params,
    selectedYear,
    selectedMonth,
    selectedDay,
    selectedWeekStart,
    periodLabel,
    results,
    seriesYear,
    seriesActiveMonth,
  } = await getReportsViewData(searchParams)

  const periodArgs = [periodo, params?.from, params?.to, selectedYear, selectedMonth, selectedDay, selectedWeekStart] as const
  const [series, statement, balance] = await Promise.all([
    getYearlySeries(seriesYear, 'ARS'),
    getCashStatement(...periodArgs, 'ARS', null),
    getBalanceSheet(...periodArgs),
  ])

  const upTo = seriesActiveMonth ?? 11
  const hasta = <T,>(arr: (T | null)[]) => arr.slice(0, upTo + 1).filter((m): m is T => m !== null)
  const er = hasta(series.resultados)
  const resultsTrends: ResultsTrends = {
    ventas: er.map((m) => m.ventas),
    cmv: er.map((m) => m.ventas - m.gananciaBruta),
    bruta: er.map((m) => m.gananciaBruta),
    neta: er.map((m) => m.gananciaNeta),
  }
  const cashTrends: CashTrends = { saldo: hasta(series.flujo).map((m) => m.saldoFinal) }
  const pat = hasta(series.patrimonio)
  const balanceTrends: BalanceTrends = { activo: pat.map((m) => m.activos), pasivo: pat.map((m) => m.pasivos) }
  const prevLabel = previousPeriodArgs(periodo, selectedYear, selectedMonth)?.label ?? 'anterior'

  return (
    <div className="mx-auto min-h-screen max-w-[1100px] space-y-8 bg-[#F2F2F7] p-6 dark:bg-black" style={{ fontFamily: SF_FONT }}>
      <AutoPrint />
      <header>
        <p className="text-[13px] text-[#8E8E93]">{sessionContext.activeBusiness.name}</p>
        <h1 className="text-[28px] font-bold tracking-tight text-[#1C1C1E] dark:text-white">Informe · {periodLabel}</h1>
      </header>

      <Seccion titulo="Estado de resultados">
        <ResultadosDetail data={results} trends={resultsTrends} previous={null} />
      </Seccion>
      <Seccion titulo="Flujo de efectivo" salto>
        <Suspense fallback={null}>
          <FlujoDetail data={statement} trends={cashTrends} />
        </Suspense>
      </Seccion>
      <Seccion titulo="Estado patrimonial" salto>
        <PatrimonioDetail data={balance.current} previous={balance.previous} currency="ARS" trends={balanceTrends} prevLabel={prevLabel} />
      </Seccion>
    </div>
  )
}

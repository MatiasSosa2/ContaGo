import { MetricChip, StatementRow, StatementLineRow, fmtAmount, type ResultsData, type StatementLine } from './shared'

function fmtMargin(value: number) {
  return `${value.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

// Los gastos restan: se muestran con "−"
function asOutflow(line: StatementLine): StatementLine {
  return { ...line, amount: -Math.abs(line.amount), children: line.children?.map(asOutflow) }
}

function SectionTitle({ label, total, currency, outflow }: { label: string; total: number; currency: string; outflow?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">{label}</p>
      <p className="font-mono text-xs font-light text-[#6B7280] num-tabular dark:text-[#A3A3A3]">
        {fmtAmount(outflow ? -total : total, currency, total !== 0)}
      </p>
    </div>
  )
}

export default function ResultadosDetail({ data }: { data: ResultsData }) {
  const pctOfSales = (v: number) => (data.sales > 0 ? (v / data.sales) * 100 : 0)
  const pctOfIncome = (v: number) => (data.income > 0 ? (v / data.income) * 100 : 0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricChip
          label="Ingresos"
          value={fmtAmount(data.income, data.currency)}
          tone="green"
          note={data.otherIncomeTotal !== 0 ? `Ventas ${fmtAmount(data.sales, data.currency)}` : undefined}
        />
        <MetricChip
          label="CMV"
          value={fmtAmount(data.cogs, data.currency)}
          tone="sand"
          note={`${fmtMargin(pctOfSales(data.cogs))} de las ventas`}
        />
        <MetricChip
          label="Ganancia bruta"
          value={fmtAmount(data.grossProfit, data.currency)}
          tone="ink"
          note={`Margen ${fmtMargin(data.grossMargin)}`}
        />
        <MetricChip
          label="Ganancia neta"
          value={fmtAmount(data.netProfit, data.currency)}
          tone="ink"
          note={`Margen ${fmtMargin(data.netMargin)}`}
        />
      </div>

      <div
        className="border border-[#E5E7EB] bg-white p-5 dark:border-white/10 dark:bg-[#141414]"
        style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}
      >
        <StatementRow label="Ventas" amount={data.sales} pct={100} currency={data.currency} variant="positive" />
        <StatementRow label="Costo de mercadería vendida" amount={-data.cogs} pct={pctOfSales(data.cogs)} currency={data.currency} variant="negative" />
        <StatementRow label="Ganancia bruta" amount={data.grossProfit} pct={data.grossMargin} currency={data.currency} variant="highlight" />

        <div className="pt-4">
          <SectionTitle label="Otros ingresos" total={data.otherIncomeTotal} currency={data.currency} />
          <div className="mt-2">
            {data.otherIncome.length === 0 ? (
              <div className="border border-dashed border-[#E5E7EB] px-4 py-5 text-sm text-[#9CA3AF] dark:border-white/10 dark:text-[#737373]">
                Sin otros ingresos en el período.
              </div>
            ) : (
              data.otherIncome.map((line) => (
                <StatementLineRow key={line.label} line={{ ...line, pct: pctOfIncome(line.amount) }} currency={data.currency} variant="positive" />
              ))
            )}
          </div>
        </div>

        <div className="pt-4">
          <SectionTitle label="Otros gastos operativos" total={data.operatingExpensesTotal} currency={data.currency} outflow />
          <div className="mt-2">
            {data.operatingExpenses.length === 0 ? (
              <div className="border border-dashed border-[#E5E7EB] px-4 py-5 text-sm text-[#9CA3AF] dark:border-white/10 dark:text-[#737373]">
                Sin otros gastos en el período.
              </div>
            ) : (
              data.operatingExpenses.map((line) => (
                <StatementLineRow key={line.label} line={asOutflow(line)} currency={data.currency} variant="negative" />
              ))
            )}
          </div>
        </div>

        <div className="mt-4 bg-brand-military px-4 py-4 text-white">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-military-light/80">Ganancia neta</p>
              <p className="mt-1 text-sm text-brand-military-light/80">Ganancia bruta + otros ingresos − gastos</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-xl font-light num-tabular">{fmtAmount(data.netProfit, data.currency, true)}</p>
              <p className="mt-1 text-sm text-brand-gold">{fmtMargin(data.netMargin)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

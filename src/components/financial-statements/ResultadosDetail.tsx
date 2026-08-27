import { MetricChip, StatementRow, fmtAmount, fmtPct, type ResultsData } from './shared'

export default function ResultadosDetail({ data }: { data: ResultsData }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricChip label="Ingresos" value={fmtAmount(data.income, data.currency)} tone="green" />
        <MetricChip label="Ganancia bruta" value={`${fmtAmount(data.grossProfit, data.currency, true)} · ${fmtPct(data.grossMargin)}`} tone="sand" />
        <MetricChip label="Ganancia neta" value={`${fmtAmount(data.netProfit, data.currency, true)} · ${fmtPct(data.netMargin)}`} tone="ink" />
      </div>

      <div
        className="border border-[#E5E7EB] bg-white p-5 dark:border-white/10 dark:bg-[#141414]"
        style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}
      >
        <StatementRow label="Ingresos" amount={data.income} pct={100} currency={data.currency} variant="positive" />
        <StatementRow label="Costo de mercadería vendida" amount={data.cogs} pct={data.income > 0 ? (data.cogs / data.income) * 100 : 0} currency={data.currency} variant="negative" />
        <StatementRow label="Ganancia bruta" amount={data.grossProfit} pct={data.grossMargin} currency={data.currency} variant="highlight" />

        <div className="pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">Otros gastos operativos</p>
          <div className="mt-2">
            {data.operatingExpenses.length === 0 ? (
              <div className="border border-dashed border-[#E5E7EB] px-4 py-5 text-sm text-[#9CA3AF] dark:border-white/10 dark:text-[#737373]">
                Sin otros gastos clasificados en el período.
              </div>
            ) : (
              data.operatingExpenses.map((line) => (
                <StatementRow key={line.label} label={line.label} amount={line.amount} pct={line.pct} currency={data.currency} variant="negative" />
              ))
            )}
          </div>
        </div>

        <div className="mt-4 bg-brand-military px-4 py-4 text-white">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-military-light/80">Ganancia neta</p>
              <p className="mt-1 text-sm text-brand-military-light/80">Después de CMV y gastos operativos</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-xl font-light num-tabular">{fmtAmount(data.netProfit, data.currency, true)}</p>
              <p className="mt-1 text-sm text-brand-gold">{fmtPct(data.netMargin)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

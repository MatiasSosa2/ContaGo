import { MetricChip, StatementRow, fmtAmount, type CashFlowData } from './shared'

export default function FlujoDetail({ data }: { data: CashFlowData }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricChip label="Saldo inicial" value={fmtAmount(data.openingBalance, data.currency)} tone="ink" />
        <MetricChip label="Variación neta" value={fmtAmount(data.netVariation, data.currency, true)} tone="sand" />
        <MetricChip label="Saldo final" value={fmtAmount(data.closingBalance, data.currency)} tone="green" />
      </div>

      <div
        className="border border-[#E5E7EB] bg-white p-5 dark:border-white/10 dark:bg-[#141414]"
        style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}
      >
        <StatementRow label="Saldo inicial" amount={data.openingBalance} pct={0} currency={data.currency} />
        <StatementRow label="Ingresos cobrados" amount={data.collectedIncome} pct={data.openingBalance !== 0 ? (data.collectedIncome / Math.max(Math.abs(data.openingBalance), 1)) * 100 : 100} currency={data.currency} variant="positive" />

        <div className="pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">Egresos clasificados</p>
          <div className="mt-2">
            {data.expenseLines.length === 0 ? (
              <div className="border border-dashed border-[#E5E7EB] px-4 py-5 text-sm text-[#9CA3AF] dark:border-white/10 dark:text-[#737373]">
                No se registran egresos cobrados o pagados en el período.
              </div>
            ) : (
              data.expenseLines.map((line) => (
                <StatementRow key={line.label} label={line.label} amount={line.amount} pct={line.pct} currency={data.currency} variant="negative" />
              ))
            )}
          </div>
        </div>

        <StatementRow label="Variación neta del mes" amount={data.netVariation} pct={data.openingBalance !== 0 ? (data.netVariation / Math.max(Math.abs(data.openingBalance), 1)) * 100 : 100} currency={data.currency} variant="highlight" />

        <div className="mt-4 border border-[#D5E3D8] bg-[#F5FAF7] px-4 py-4 dark:border-[#294235] dark:bg-[#162019]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5A7A57] dark:text-[#9AC7A8]">Saldo final</p>
              <p className="mt-1 text-sm text-[#6B7280] dark:text-[#A3A3A3]">Caja y bancos al cierre del período</p>
            </div>
            <p className="font-mono text-xl font-light text-[#1F2937] num-tabular dark:text-[#E8E8E8]">{fmtAmount(data.closingBalance, data.currency)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

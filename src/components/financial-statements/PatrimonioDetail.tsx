import { MetricChip, StatementRow, fmtAmount, type BalanceSheetData } from './shared'

export default function PatrimonioDetail({ data }: { data: BalanceSheetData }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricChip label="Activos" value={fmtAmount(data.totalAssets, data.currency)} tone="green" />
        <MetricChip label="Pasivos" value={fmtAmount(data.totalLiabilities, data.currency)} tone="sand" />
        <MetricChip label="Patrimonio neto" value={fmtAmount(data.equity, data.currency, true)} tone="ink" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div
          className="border border-[#D5E3D8] bg-[#F5FAF7] p-5 dark:border-[#294235] dark:bg-[#162019]"
          style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5A7A57] dark:text-[#9AC7A8]">Activos</p>
          <div className="mt-3 space-y-1">
            {data.assets.map((line) => (
              <StatementRow key={line.label} label={line.label} amount={line.amount} pct={line.pct} currency={data.currency} />
            ))}
          </div>
        </div>

        <div
          className="border border-[#E6D6B8] bg-[#FFF8EC] p-5 dark:border-[#5B4A2F] dark:bg-[#21180F]"
          style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8A6118] dark:text-[#D7B36B]">Pasivos</p>
          <div className="mt-3 space-y-1">
            {data.liabilities.length === 0 ? (
              <div className="border border-dashed border-[#E6D6B8] px-4 py-5 text-sm text-[#8A6118] dark:border-[#5B4A2F] dark:text-[#D7B36B]">
                No hay deudas a pagar registradas.
              </div>
            ) : (
              data.liabilities.map((line) => (
                <StatementRow key={line.label} label={line.label} amount={line.amount} pct={line.pct} currency={data.currency} variant="negative" />
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-brand-military px-5 py-5 text-white">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-military-light/80">Patrimonio neto</p>
            <p className="mt-1 text-sm text-brand-military-light/80">Activos menos pasivos del negocio</p>
          </div>
          <p className="font-mono text-2xl font-light num-tabular">{fmtAmount(data.equity, data.currency, true)}</p>
        </div>
      </div>
    </div>
  )
}

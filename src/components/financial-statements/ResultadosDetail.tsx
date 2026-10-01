import { type ResultsData, type StatementLine } from './shared'
import { Card, IOS, KpiCard, SF_FONT, TableRow, TableSection, TableSubRow, fmtFull, fmtPctEs } from './modern'

export type ResultsTrends = { ventas: number[]; cmv: number[]; bruta: number[]; neta: number[] }

function Lines({ lines, currency, base, negative }: { lines: StatementLine[]; currency: string; base: number; negative?: boolean }) {
  const pct = (v: number) => (base > 0 ? (v / base) * 100 : undefined)
  return (
    <>
      {lines.map((line) => (
        <TableRow
          key={line.label}
          label={line.label}
          amount={negative ? -line.amount : line.amount}
          pct={pct(line.amount)}
          currency={currency}
          level={1}
          tone={negative ? 'negative' : undefined}
        >
          {line.children?.length
            ? line.children.map((c) => (
                <TableSubRow key={c.label} label={c.label} amount={negative ? -c.amount : c.amount} pct={pct(c.amount)} currency={currency} />
              ))
            : undefined}
        </TableRow>
      ))}
    </>
  )
}

/** Período anterior para comparar (mes o año anterior); null si no aplica */
export type ResultsPrevious = { ventas: number; neta: number; label: string } | null

const variacion = (actual: number, anterior: number) => (anterior !== 0 ? ((actual - anterior) / Math.abs(anterior)) * 100 : null)

export default function ResultadosDetail({ data, trends, previous }: { data: ResultsData; trends: ResultsTrends; previous: ResultsPrevious }) {
  const cur = data.currency
  const pctVentas = (v: number) => (data.sales > 0 ? (v / data.sales) * 100 : undefined)

  return (
    <div className="space-y-4" style={{ fontFamily: SF_FONT }}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiCard
          label="Ventas"
          value={fmtFull(data.sales, cur)}
          note={`Margen bruto ${fmtPctEs(data.grossMargin)}`}
          trend={trends.ventas}
          color={IOS.green}
          delta={previous ? { pct: variacion(data.sales, previous.ventas), vs: previous.label } : undefined}
        />
        <KpiCard
          label="Ganancia neta"
          value={fmtFull(data.netProfit, cur)}
          note={`Margen ${fmtPctEs(data.netMargin)}`}
          trend={trends.neta}
          color={data.netProfit >= 0 ? IOS.cyan : IOS.red}
          delta={previous ? { pct: variacion(data.netProfit, previous.neta), vs: previous.label } : undefined}
        />
      </div>

      <Card className="overflow-hidden py-2">
        <TableRow label="Ventas" amount={data.sales} pct={data.sales > 0 ? 100 : undefined} currency={cur} strong />
        <TableRow label="Costo de mercadería vendida" amount={-data.cogs} pct={pctVentas(data.cogs)} currency={cur} level={1} tone="negative" />
        <TableRow label="Ganancia bruta" amount={data.grossProfit} pct={data.grossMargin} currency={cur} strong />

        {/* Las secciones sin movimientos no se muestran */}
        {data.otherIncome.length > 0 && (
          <>
            <TableSection title="Otros ingresos" />
            <Lines lines={data.otherIncome} currency={cur} base={data.sales} />
          </>
        )}
        {data.operatingExpenses.length > 0 && (
          <>
            <TableSection title="Gastos" />
            <Lines lines={data.operatingExpenses} currency={cur} base={data.sales} negative />
          </>
        )}

        {/* Ganancia neta: cierre del cuadro, por peso de letra y no por fondo de color */}
        <div className="mx-4 mt-3 flex items-baseline sm:mx-5 justify-between border-t border-black/10 pb-2 pt-4 dark:border-white/15">
          <p className="text-[17px] font-semibold text-[#1C1C1E] dark:text-white">Ganancia neta</p>
          <div className="text-right">
            <p className={`text-[22px] font-semibold tracking-tight tabular-nums ${data.netProfit >= 0 ? 'text-[#0071A4] dark:text-[#64D2FF]' : 'text-[#D70015] dark:text-[#FF453A]'}`}>
              {fmtFull(data.netProfit, cur)}
            </p>
            <p className="text-[12px] tabular-nums text-[#8E8E93]">Margen {fmtPctEs(data.netMargin)}</p>
          </div>
        </div>
      </Card>
    </div>
  )
}

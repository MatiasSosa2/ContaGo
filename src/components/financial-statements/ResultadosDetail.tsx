import { type ResultsData, type StatementLine } from './shared'
import { EncabezadoVariacion, ModoVariacion } from './VariacionCol'
import { Card, IOS, KpiCard, SF_FONT, TONO_MONTO, TableRow, TableSection, TableSubRow, Variacion, fmtFull, fmtPctEs, type TonoMonto } from './modern'

export type ResultsTrends = { ventas: number[]; cmv: number[]; bruta: number[]; neta: number[] }

/** Período anterior para comparar (mes o año anterior); null si no aplica */
export type ResultsPrevious = {
  ventas: number
  cmv: number
  bruta: number
  neta: number
  /** Montos por línea y por "línea›subcategoría" */
  otros: Record<string, number>
  gastos: Record<string, number>
  /** Ventas y costo de lo vendido por categoría de inventario */
  ventasCat: Record<string, number>
  cmvCat: Record<string, number>
  label: string
} | null

/** Líneas de otros ingresos o gastos (con su detalle por subcategoría) */
function Lines({ lines, currency, base, tono, anteriores, vs }: {
  lines: StatementLine[]
  currency: string
  base: number
  tono: TonoMonto
  /** Montos del período anterior por línea (null = sin comparación) */
  anteriores: Record<string, number> | null
  vs?: string
}) {
  const pct = (v: number) => (base > 0 ? (v / base) * 100 : undefined)
  // En gastos, que suban es malo
  const inverse = tono === 'egreso'
  const variacion = (key: string, actual: number) =>
    anteriores ? <Variacion actual={actual} anterior={anteriores[key]} inverse={inverse} vs={vs} /> : undefined
  return (
    <>
      {lines.map((line) => (
        <TableRow
          key={line.label}
          label={line.label}
          amount={line.amount}
          pct={pct(line.amount)}
          currency={currency}
          level={1}
          tono={tono}
          variacion={variacion(line.label, line.amount)}
        >
          {line.children?.length
            ? line.children.map((c) => (
                <TableSubRow
                  key={c.label}
                  label={c.label}
                  amount={c.amount}
                  pct={pct(c.amount)}
                  currency={currency}
                  tono={tono}
                  variacion={variacion(`${line.label}›${c.label}`, c.amount)}
                />
              ))
            : undefined}
        </TableRow>
      ))}
    </>
  )
}

/** Detalle por categoría de inventario (ventas, costo o ganancia bruta) */
function Categorias({ lines, currency, tono, anteriores, inverse = false, vs }: {
  lines?: StatementLine[]
  currency: string
  tono: TonoMonto
  anteriores: Record<string, number> | null
  inverse?: boolean
  vs?: string
}) {
  if (!lines?.length) return undefined
  return lines.map((c) => (
    <TableSubRow
      key={c.label}
      label={c.label}
      amount={Math.abs(c.amount)}
      pct={c.pct}
      currency={currency}
      tono={c.amount < 0 ? 'perdida' : tono}
      variacion={anteriores ? <Variacion actual={c.amount} anterior={anteriores[c.label]} inverse={inverse} vs={vs} /> : undefined}
    />
  ))
}

const variacion = (actual: number, anterior: number) => (anterior !== 0 ? ((actual - anterior) / Math.abs(anterior)) * 100 : null)

export default function ResultadosDetail({ data, trends, previous }: { data: ResultsData; trends: ResultsTrends; previous: ResultsPrevious }) {
  const cur = data.currency
  const pctVentas = (v: number) => (data.sales > 0 ? (v / data.sales) * 100 : undefined)
  const vs = previous?.label
  // Columna de variación solo si hay período anterior para comparar
  const comparar = (actual: number, anterior: number | undefined, inverse = false) =>
    previous ? <Variacion actual={actual} anterior={anterior} inverse={inverse} vs={vs} /> : undefined
  const perdida = data.netProfit < 0

  return (
    <ModoVariacion>
    <div className="space-y-4" style={{ fontFamily: SF_FONT }}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiCard
          label="Ventas"
          value={fmtFull(data.sales, cur)}
          trend={trends.ventas}
          color={IOS.green}
          delta={previous ? { pct: variacion(data.sales, previous.ventas), vs: previous.label } : undefined}
        />
        <KpiCard
          label="Ganancia neta"
          value={fmtFull(data.netProfit, cur)}
          trend={trends.neta}
          color={data.netProfit >= 0 ? IOS.neta : IOS.red}
          delta={previous ? { pct: variacion(data.netProfit, previous.neta), vs: previous.label } : undefined}
        />
      </div>

      <Card className="overflow-hidden py-2">
        {/* Encabezado: solo la columna de variación lleva título */}
        {previous && (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 pb-0.5 pt-2 text-[11px] text-[#AEAEB2] sm:gap-4 sm:px-5 dark:text-[#636366]">
            <span />
            <EncabezadoVariacion vs={previous.label} />
          </div>
        )}

        {/* Tocar la fila despliega el detalle por categoría de inventario */}
        <TableRow label="Ventas" amount={data.sales} pct={data.sales > 0 ? 100 : undefined} currency={cur} strong tono="ingreso" variacion={comparar(data.sales, previous?.ventas)}>
          {Categorias({ lines: data.salesLines, currency: cur, tono: 'ingreso', anteriores: previous?.ventasCat ?? null, vs })}
        </TableRow>
        <TableRow label="Costo de mercadería vendida" amount={data.cogs} pct={pctVentas(data.cogs)} currency={cur} level={1} tono="egreso" variacion={comparar(data.cogs, previous?.cmv, true)}>
          {Categorias({ lines: data.cogsLines, currency: cur, tono: 'egreso', anteriores: previous?.cmvCat ?? null, inverse: true, vs })}
        </TableRow>
        <TableRow label="Ganancia bruta" amount={data.grossProfit} pct={data.grossMargin} currency={cur} strong tono={data.grossProfit < 0 ? 'perdida' : 'ganancia'} variacion={comparar(data.grossProfit, previous?.bruta)}>
          {Categorias({
            lines: data.grossLines,
            currency: cur,
            tono: 'ganancia',
            anteriores: previous
              ? Object.fromEntries(Array.from(new Set([...Object.keys(previous.ventasCat), ...Object.keys(previous.cmvCat)]))
                  .map((k) => [k, (previous.ventasCat[k] ?? 0) - (previous.cmvCat[k] ?? 0)]))
              : null,
            vs,
          })}
        </TableRow>

        {/* Las secciones sin movimientos no se muestran */}
        {data.otherIncome.length > 0 && (
          <>
            <TableSection title="Otros ingresos" />
            <Lines lines={data.otherIncome} currency={cur} base={data.sales} tono="ingreso" anteriores={previous?.otros ?? null} vs={vs} />
          </>
        )}
        {data.operatingExpenses.length > 0 && (
          <>
            <TableSection title="Gastos" />
            <Lines lines={data.operatingExpenses} currency={cur} base={data.sales} tono="egreso" anteriores={previous?.gastos ?? null} vs={vs} />
          </>
        )}

        {/* Ganancia (o pérdida) neta: misma estructura que las líneas (monto, margen abajo, variación) */}
        <div className={`mx-4 mt-3 grid items-center gap-3 border-t border-black/10 pb-4 pt-4 sm:mx-5 sm:gap-4 dark:border-white/15 ${previous ? 'grid-cols-[minmax(0,1fr)_auto_auto]' : 'grid-cols-[minmax(0,1fr)_auto]'}`}>
          <p className="text-[17px] font-semibold text-[#1C1C1E] dark:text-white">{perdida ? 'Pérdida neta' : 'Ganancia neta'}</p>
          <div className="relative text-right">
            <p className={`text-[22px] font-semibold tracking-tight tabular-nums ${TONO_MONTO[perdida ? 'perdida' : 'neta']}`}>
              {fmtFull(Math.abs(data.netProfit), cur)}
            </p>
            <p className="absolute right-0 top-full -mt-0.5 text-[10px] leading-none tabular-nums text-[#C7C7CC] dark:text-[#5A5A5E]">Margen {fmtPctEs(data.netMargin)}</p>
          </div>
          {previous && <Variacion actual={data.netProfit} anterior={previous.neta} vs={vs} />}
        </div>
      </Card>
    </div>
    </ModoVariacion>
  )
}

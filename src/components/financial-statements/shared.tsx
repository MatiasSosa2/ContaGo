export type StatementLine = {
  label: string
  amount: number
  pct: number
  /** Desglose por subcategoría, si la categoría tiene */
  children?: StatementLine[]
}

export type ResultsData = {
  currency: string
  /** Ingresos totales = ventas + otros ingresos */
  income: number
  /** Ventas de productos (cobradas o no) */
  sales: number
  otherIncome: StatementLine[]
  otherIncomeTotal: number
  /** CMV: unidades vendidas × CPP del momento de la venta */
  cogs: number
  /** Ventas − CMV */
  grossProfit: number
  /** Ganancia bruta sobre ventas */
  grossMargin: number
  operatingExpenses: StatementLine[]
  operatingExpensesTotal: number
  operatingExpensePct: number
  netProfit: number
  netMargin: number
}

export type CashFlowData = {
  currency: string
  openingBalance: number
  collectedIncome: number
  /** Ingresos cobrados por categoría (ventas cobradas, cobros de créditos...) */
  incomeLines: StatementLine[]
  expenseLines: StatementLine[]
  totalExpenses: number
  /** Neto de cambios de caja con otra moneda (+ entró, − salió) */
  currencyExchange: number
  netVariation: number
  closingBalance: number
  /** Saldo de cada caja al inicio y al cierre */
  accounts: { name: string; type: string; inicio: number; cierre: number }[]
  /** Detalle de los cambios de moneda del período (ej. "Compra de US$1.000") */
  exchangeNotes: string[]
}

export type BalanceSheetData = {
  currency: string
  assets: StatementLine[]
  totalAssets: number
  liabilities: StatementLine[]
  totalLiabilities: number
  equity: number
}

const CURRENCY_SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$' }

export function fmtAmount(value: number, currency: string, signed = false) {
  const formatted = `${CURRENCY_SYMBOL[currency] || '$'}${Math.abs(value).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`

  if (!signed) {
    // Un saldo negativo nunca pierde el signo
    return value < 0 ? `−${formatted}` : formatted
  }

  return `${value >= 0 ? '+' : '−'}${formatted}`
}

export function fmtPct(value: number) {
  return `${value.toFixed(1)}%`
}

export function MetricChip({ label, value, tone, note }: {
  label: string
  value: string
  tone: 'green' | 'sand' | 'ink'
  /** Dato secundario chico debajo del monto (ej. "Margen 35,0%") */
  note?: string
}) {
  const valueClass =
    tone === 'green'
      ? 'text-[#2D5A41] dark:text-[#9AC7A8]'
      : tone === 'sand'
      ? 'text-[#B42318] dark:text-[#F97066]'
      : 'text-[#111827] dark:text-white'

  return (
    <div className="border border-[var(--ds-neutral-200)] bg-white px-5 py-4 dark:border-white/10 dark:bg-[var(--ds-ink)]">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--ds-neutral-400)]">{label}</p>
      <p className={`font-mono text-xl font-bold num-tabular ${valueClass}`}>{value}</p>
      {note && <p className="mt-1 text-[11px] font-medium text-[var(--ds-neutral-400)] num-tabular">{note}</p>}
    </div>
  )
}

type StatementVariant = 'neutral' | 'positive' | 'negative' | 'highlight'

function rowAmountClass(variant: StatementVariant) {
  return variant === 'positive'
    ? 'text-[#2D5A41] dark:text-[#9AC7A8]'
    : variant === 'negative'
    ? 'text-[#B42318] dark:text-[#F97066]'
    : variant === 'highlight'
    ? 'text-[var(--ds-neutral-800)] dark:text-[#F3F4F6]'
    : 'text-[var(--ds-neutral-700)] dark:text-[var(--ds-neutral-300)]'
}

function rowChipClass(variant: StatementVariant) {
  return variant === 'positive'
    ? 'border-[#D5E3D8] bg-[#F5FAF7] text-[#2D5A41] dark:border-[#294235] dark:bg-[#162019] dark:text-[#9AC7A8]'
    : variant === 'negative'
    ? 'border-[#FEE4E2] bg-[#FEF3F2] text-[#B42318] dark:border-[#5A2A24] dark:bg-[#1F1514] dark:text-[#F97066]'
    : 'border-[var(--ds-neutral-200)] bg-[#FCFDFC] text-[var(--ds-neutral-500)] dark:border-white/10 dark:bg-[#171717] dark:text-[#A3A3A3]'
}

export function StatementRow({
  label,
  amount,
  pct,
  currency,
  variant = 'neutral',
}: {
  label: string
  amount: number
  pct: number
  currency: string
  variant?: StatementVariant
}) {
  const amountClass = rowAmountClass(variant)
  const chipClass = rowChipClass(variant)

  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-[var(--ds-neutral-200)] py-3 last:border-b-0 dark:border-white/10 ${variant === 'highlight' ? 'bg-[#FCFDFC] px-3 dark:bg-[#171717]' : ''}`}>
      <p className="min-w-0 text-sm font-medium text-[var(--ds-neutral-800)] dark:text-[var(--ds-line)]">{label}</p>
      <p className={`text-right text-sm font-mono font-light num-tabular ${amountClass}`}>{fmtAmount(amount, currency, variant === 'positive' || variant === 'negative')}</p>
      <span className={`border px-2.5 py-1 text-[10px] font-semibold ${chipClass}`}>{fmtPct(pct)}</span>
    </div>
  )
}

/** Fila de un estado; si la línea tiene subcategorías se despliega para verlas. */
export function StatementLineRow({
  line,
  currency,
  variant = 'neutral',
}: {
  line: StatementLine
  currency: string
  variant?: StatementVariant
}) {
  if (!line.children?.length) {
    return <StatementRow label={line.label} amount={line.amount} pct={line.pct} currency={currency} variant={variant} />
  }

  return (
    <details className="group border-b border-[var(--ds-neutral-200)] last:border-b-0 dark:border-white/10">
      <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-[var(--ds-neutral-800)] dark:text-[var(--ds-line)]">
          <svg className="h-3 w-3 shrink-0 text-[var(--ds-neutral-400)] transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          {line.label}
        </p>
        <StatementRowValues amount={line.amount} pct={line.pct} currency={currency} variant={variant} />
      </summary>
      <div className="pb-2 pl-5">
        {line.children.map((child) => (
          <div key={child.label} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-1.5">
            <p className="min-w-0 truncate text-[13px] text-[var(--ds-neutral-500)] dark:text-[#A3A3A3]">{child.label}</p>
            <StatementRowValues amount={child.amount} pct={child.pct} currency={currency} variant={variant} small />
          </div>
        ))}
      </div>
    </details>
  )
}

function StatementRowValues({ amount, pct, currency, variant, small }: {
  amount: number
  pct: number
  currency: string
  variant: StatementVariant
  small?: boolean
}) {
  return (
    <>
      <p className={`text-right font-mono font-light num-tabular ${small ? 'text-[13px] opacity-80' : 'text-sm'} ${rowAmountClass(variant)}`}>
        {fmtAmount(amount, currency, variant === 'positive' || variant === 'negative')}
      </p>
      {small
        ? <span className="px-2.5 text-[10px] font-semibold text-[var(--ds-neutral-400)]">{fmtPct(pct)}</span>
        : <span className={`border px-2.5 py-1 text-[10px] font-semibold ${rowChipClass(variant)}`}>{fmtPct(pct)}</span>}
    </>
  )
}

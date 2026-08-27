export type StatementLine = {
  label: string
  amount: number
  pct: number
}

export type ResultsData = {
  currency: string
  income: number
  cogs: number
  grossProfit: number
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
  expenseLines: StatementLine[]
  totalExpenses: number
  netVariation: number
  closingBalance: number
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
  const formatted = `${CURRENCY_SYMBOL[currency] || '$'}${Math.abs(value).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`

  if (!signed) {
    return formatted
  }

  return `${value >= 0 ? '+' : '−'}${formatted}`
}

export function fmtPct(value: number) {
  return `${value.toFixed(1)}%`
}

export function MetricChip({ label, value, tone }: { label: string; value: string; tone: 'green' | 'sand' | 'ink' }) {
  const valueClass =
    tone === 'green'
      ? 'text-[#2D5A41] dark:text-[#9AC7A8]'
      : tone === 'sand'
      ? 'text-[#8A6118] dark:text-[#D7B36B]'
      : 'text-[#111827] dark:text-white'

  return (
    <div className="border border-[#E5E7EB] bg-white px-5 py-4 dark:border-white/10 dark:bg-[#141414]">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">{label}</p>
      <p className={`font-mono text-xl font-bold num-tabular ${valueClass}`}>{value}</p>
    </div>
  )
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
  variant?: 'neutral' | 'positive' | 'negative' | 'highlight'
}) {
  const amountClass =
    variant === 'positive'
      ? 'text-[#2D5A41] dark:text-[#9AC7A8]'
      : variant === 'negative'
      ? 'text-[#8A6118] dark:text-[#D7B36B]'
      : variant === 'highlight'
      ? 'text-[#1F2937] dark:text-[#F3F4F6]'
      : 'text-[#374151] dark:text-[#D1D5DB]'

  const chipClass =
    variant === 'positive'
      ? 'border-[#D5E3D8] bg-[#F5FAF7] text-[#2D5A41] dark:border-[#294235] dark:bg-[#162019] dark:text-[#9AC7A8]'
      : variant === 'negative'
      ? 'border-[#E6D6B8] bg-[#FFF8EC] text-[#8A6118] dark:border-[#5B4A2F] dark:bg-[#21180F] dark:text-[#D7B36B]'
      : 'border-[#E5E7EB] bg-[#FCFDFC] text-[#6B7280] dark:border-white/10 dark:bg-[#171717] dark:text-[#A3A3A3]'

  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-[#E5E7EB] py-3 last:border-b-0 dark:border-white/10 ${variant === 'highlight' ? 'bg-[#FCFDFC] px-3 dark:bg-[#171717]' : ''}`}>
      <p className="min-w-0 text-sm font-medium text-[#1F2937] dark:text-[#E8E8E8]">{label}</p>
      <p className={`text-right text-sm font-mono font-light num-tabular ${amountClass}`}>{fmtAmount(amount, currency, variant === 'positive' || variant === 'negative')}</p>
      <span className={`border px-2.5 py-1 text-[10px] font-semibold ${chipClass}`}>{fmtPct(pct)}</span>
    </div>
  )
}

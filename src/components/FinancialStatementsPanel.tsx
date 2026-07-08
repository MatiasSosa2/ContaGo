'use client'

import { useMemo, useState, type ReactNode } from 'react'

type ViewKey = 'results' | 'cashflow' | 'balance'

type StatementLine = {
  label: string
  amount: number
  pct: number
}

type ResultsData = {
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

type CashFlowData = {
  currency: string
  openingBalance: number
  collectedIncome: number
  expenseLines: StatementLine[]
  totalExpenses: number
  netVariation: number
  closingBalance: number
}

type BalanceSheetData = {
  currency: string
  assets: StatementLine[]
  totalAssets: number
  liabilities: StatementLine[]
  totalLiabilities: number
  equity: number
}

type FinancialStatementsPanelProps = {
  periodLabel: string
  results: ResultsData
  cashFlow: CashFlowData
  balanceSheet: BalanceSheetData
  exportSlot?: ReactNode
}

const CURRENCY_SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$' }

function fmtAmount(value: number, currency: string, signed = false) {
  const formatted = `${CURRENCY_SYMBOL[currency] || '$'}${Math.abs(value).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`

  if (!signed) {
    return formatted
  }

  return `${value >= 0 ? '+' : 'âˆ’'}${formatted}`
}

function fmtPct(value: number) {
  return `${value.toFixed(1)}%`
}

function MetricChip({ label, value, tone }: { label: string; value: string; tone: 'green' | 'sand' | 'ink' }) {
  const valueClass =
    tone === 'green'
      ? 'text-[#2D5A41] dark:text-[#9AC7A8]'
      : tone === 'sand'
      ? 'text-[#8A6118] dark:text-[#D7B36B]'
      : 'text-black dark:text-white'

  return (
    <div
      className="border border-[#E5E7EB] bg-white px-5 py-4 dark:border-white/10 dark:bg-[#141414]"
      style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}
    >
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">{label}</p>
      <p className={`font-mono text-xl font-bold num-tabular ${valueClass}`}>{value}</p>
    </div>
  )
}

function StatementRow({
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

function TriggerCard({
  title,
  previewValue,
  ctaLabel,
  tone,
  isActive,
  onClick,
}: {
  title: string
  previewValue: string
  ctaLabel: string
  tone: 'green' | 'sand' | 'ink'
  isActive: boolean
  onClick: () => void
}) {
  const valueClass =
    tone === 'green'
      ? 'text-[#2D5A41] dark:text-[#9AC7A8]'
      : tone === 'sand'
      ? 'text-[#8A6118] dark:text-[#D7B36B]'
      : 'text-black dark:text-white'

  const activeRingClass =
    tone === 'green'
      ? 'border-[#2D5A41] ring-1 ring-[#2D5A41]/40 dark:border-[#9AC7A8] dark:ring-[#9AC7A8]/40'
      : tone === 'sand'
      ? 'border-[#8A6118] ring-1 ring-[#8A6118]/40 dark:border-[#D7B36B] dark:ring-[#D7B36B]/40'
      : 'border-brand-military ring-1 ring-brand-military/40 dark:border-white dark:ring-white/40'

  const ctaClass =
    tone === 'green'
      ? 'border-[#2D5A41]/30 text-[#2D5A41] hover:border-brand-military hover:text-brand-military dark:border-[#9AC7A8]/40 dark:text-[#9AC7A8] dark:hover:border-[#9AC7A8] dark:hover:text-[#D7F3DF]'
      : tone === 'sand'
      ? 'border-[#8A6118]/30 text-[#8A6118] hover:border-[#8A6118] hover:text-[#5C4315] dark:border-[#D7B36B]/40 dark:text-[#D7B36B] dark:hover:border-[#D7B36B] dark:hover:text-[#F2D59B]'
      : 'border-[#D1D5DB] text-[#4B5563] hover:border-brand-military hover:text-brand-military dark:border-white/10 dark:text-[#D1D5DB] dark:hover:text-white'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`flex flex-col items-start border bg-white p-5 text-left transition dark:bg-[#141414] ${isActive ? activeRingClass : 'border-[#E5E7EB] dark:border-white/10 hover:border-brand-military/60 dark:hover:border-white/30'}`}
      style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">{title}</p>
      <p className={`font-mono text-[28px] font-bold num-tabular ${valueClass}`}>{previewValue}</p>
      <span
        className={`mt-5 inline-flex w-fit items-center gap-1.5 border px-3 py-2 text-xs font-semibold transition ${ctaClass}`}
      >
        {ctaLabel}
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </button>
  )
}

export default function FinancialStatementsPanel({
  periodLabel,
  results,
  cashFlow,
  balanceSheet,
  exportSlot,
}: FinancialStatementsPanelProps) {
  const [activeView, setActiveView] = useState<ViewKey>('results')

  const activeTitle = useMemo(() => {
    if (activeView === 'results') return 'Estado de resultados'
    if (activeView === 'cashflow') return 'Estado de flujo de efectivo'
    return 'Estado de situaciÃ³n patrimonial'
  }, [activeView])

  const activeIndex = activeView === 'results' ? 0 : activeView === 'cashflow' ? 1 : 2

  return (
    <>
      <section
        className="overflow-hidden border border-[#E5E7EB] bg-white dark:border-white/10 dark:bg-[#141414]"
        style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.05)' }}
      >
        <div className="flex flex-col gap-3 border-b border-[#E5E7EB] bg-[#FCFDFC] px-5 py-4 dark:border-white/10 dark:bg-[#141414] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center bg-brand-military-light text-brand-military">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 15l4-4 4 4 5-6" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#1F2937] dark:text-[#E8E8E8]">Estados financieros</h2>
              <p className="text-xs text-[#9CA3AF]">Seleccionar Estado</p>
            </div>
          </div>

          {exportSlot ? <div className="shrink-0">{exportSlot}</div> : null}
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 xl:grid-cols-3">
          <TriggerCard
            title="Estado de Resultados"
            previewValue={fmtAmount(results.netProfit, results.currency, true)}
            ctaLabel="Ver Estado"
            tone="green"
            isActive={activeView === 'results'}
            onClick={() => setActiveView('results')}
          />
          <TriggerCard
            title="Estado de Flujo de Caja"
            previewValue={fmtAmount(cashFlow.closingBalance, cashFlow.currency)}
            ctaLabel="Ver Flujo de Caja"
            tone="sand"
            isActive={activeView === 'cashflow'}
            onClick={() => setActiveView('cashflow')}
          />
          <TriggerCard
            title="Estado Patrimonial"
            previewValue={fmtAmount(balanceSheet.equity, balanceSheet.currency, true)}
            ctaLabel="Ver Estado Patrimonial"
            tone="ink"
            isActive={activeView === 'balance'}
            onClick={() => setActiveView('balance')}
          />
        </div>

        <div className="border-t border-[#E5E7EB] dark:border-white/10">
          <div className="border-b border-[#E5E7EB] bg-[#FCFDFC] px-6 py-4 dark:border-white/10 dark:bg-[#141414]">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center bg-brand-military-light text-brand-military">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 15l4-4 4 4 5-6" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#1F2937] dark:text-[#E8E8E8]">{activeTitle}</h3>
                <p className="text-xs text-[#9CA3AF]">{periodLabel}</p>
              </div>
            </div>

            <div className="mt-4 inline-flex border border-[#E5E7EB] bg-white dark:border-white/10 dark:bg-[#111111]">
              {[
                { key: 'results', label: 'Resultados' },
                { key: 'cashflow', label: 'Flujo' },
                { key: 'balance', label: 'Patrimonio' },
              ].map((item) => {
                const isActive = activeView === item.key
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveView(item.key as ViewKey)}
                    className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${isActive ? 'bg-brand-military text-white' : 'text-[#6B7280] hover:text-brand-military dark:text-[#A3A3A3] dark:hover:text-white'}`}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="overflow-hidden bg-[#F9FAFB] dark:bg-[#0F0F0F]">
            <div
              className="flex w-[300%] transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${(activeIndex * 100) / 3}%)` }}
            >
              <div className="w-1/3 shrink-0 px-6 py-6" aria-hidden={activeView !== 'results'}>
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <MetricChip label="Ingresos" value={fmtAmount(results.income, results.currency)} tone="green" />
                    <MetricChip label="Ganancia bruta" value={`${fmtAmount(results.grossProfit, results.currency, true)} Â· ${fmtPct(results.grossMargin)}`} tone="sand" />
                    <MetricChip label="Ganancia neta" value={`${fmtAmount(results.netProfit, results.currency, true)} Â· ${fmtPct(results.netMargin)}`} tone="ink" />
                  </div>

                  <div
                    className="border border-[#E5E7EB] bg-white p-5 dark:border-white/10 dark:bg-[#141414]"
                    style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}
                  >
                    <StatementRow label="Ingresos" amount={results.income} pct={100} currency={results.currency} variant="positive" />
                    <StatementRow label="Costo de mercaderÃ­a vendida" amount={results.cogs} pct={results.income > 0 ? (results.cogs / results.income) * 100 : 0} currency={results.currency} variant="negative" />
                    <StatementRow label="Ganancia bruta" amount={results.grossProfit} pct={results.grossMargin} currency={results.currency} variant="highlight" />

                    <div className="pt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">Otros gastos operativos</p>
                      <div className="mt-2">
                        {results.operatingExpenses.length === 0 ? (
                          <div className="border border-dashed border-[#E5E7EB] px-4 py-5 text-sm text-[#9CA3AF] dark:border-white/10 dark:text-[#737373]">
                            Sin otros gastos clasificados en el perÃ­odo.
                          </div>
                        ) : (
                          results.operatingExpenses.map((line) => (
                            <StatementRow key={line.label} label={line.label} amount={line.amount} pct={line.pct} currency={results.currency} variant="negative" />
                          ))
                        )}
                      </div>
                    </div>

                    <div className="mt-4 bg-brand-military px-4 py-4 text-white">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-military-light/80">Ganancia neta</p>
                          <p className="mt-1 text-sm text-brand-military-light/80">DespuÃ©s de CMV y gastos operativos</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-xl font-light num-tabular">{fmtAmount(results.netProfit, results.currency, true)}</p>
                          <p className="mt-1 text-sm text-brand-gold">{fmtPct(results.netMargin)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-1/3 shrink-0 px-6 py-6" aria-hidden={activeView !== 'cashflow'}>
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <MetricChip label="Saldo inicial" value={fmtAmount(cashFlow.openingBalance, cashFlow.currency)} tone="ink" />
                    <MetricChip label="VariaciÃ³n neta" value={fmtAmount(cashFlow.netVariation, cashFlow.currency, true)} tone="sand" />
                    <MetricChip label="Saldo final" value={fmtAmount(cashFlow.closingBalance, cashFlow.currency)} tone="green" />
                  </div>

                  <div
                    className="border border-[#E5E7EB] bg-white p-5 dark:border-white/10 dark:bg-[#141414]"
                    style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}
                  >
                    <StatementRow label="Saldo inicial" amount={cashFlow.openingBalance} pct={0} currency={cashFlow.currency} />
                    <StatementRow label="Ingresos cobrados" amount={cashFlow.collectedIncome} pct={cashFlow.openingBalance !== 0 ? (cashFlow.collectedIncome / Math.max(Math.abs(cashFlow.openingBalance), 1)) * 100 : 100} currency={cashFlow.currency} variant="positive" />

                    <div className="pt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">Egresos clasificados</p>
                      <div className="mt-2">
                        {cashFlow.expenseLines.length === 0 ? (
                          <div className="border border-dashed border-[#E5E7EB] px-4 py-5 text-sm text-[#9CA3AF] dark:border-white/10 dark:text-[#737373]">
                            No se registran egresos cobrados o pagados en el perÃ­odo.
                          </div>
                        ) : (
                          cashFlow.expenseLines.map((line) => (
                            <StatementRow key={line.label} label={line.label} amount={line.amount} pct={line.pct} currency={cashFlow.currency} variant="negative" />
                          ))
                        )}
                      </div>
                    </div>

                    <StatementRow label="VariaciÃ³n neta del mes" amount={cashFlow.netVariation} pct={cashFlow.openingBalance !== 0 ? (cashFlow.netVariation / Math.max(Math.abs(cashFlow.openingBalance), 1)) * 100 : 100} currency={cashFlow.currency} variant="highlight" />

                    <div className="mt-4 border border-[#D5E3D8] bg-[#F5FAF7] px-4 py-4 dark:border-[#294235] dark:bg-[#162019]">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5A7A57] dark:text-[#9AC7A8]">Saldo final</p>
                          <p className="mt-1 text-sm text-[#6B7280] dark:text-[#A3A3A3]">Caja y bancos al cierre del perÃ­odo</p>
                        </div>
                        <p className="font-mono text-xl font-light text-[#1F2937] num-tabular dark:text-[#E8E8E8]">{fmtAmount(cashFlow.closingBalance, cashFlow.currency)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-1/3 shrink-0 px-6 py-6" aria-hidden={activeView !== 'balance'}>
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <MetricChip label="Activos" value={fmtAmount(balanceSheet.totalAssets, balanceSheet.currency)} tone="green" />
                    <MetricChip label="Pasivos" value={fmtAmount(balanceSheet.totalLiabilities, balanceSheet.currency)} tone="sand" />
                    <MetricChip label="Patrimonio neto" value={fmtAmount(balanceSheet.equity, balanceSheet.currency, true)} tone="ink" />
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div
                      className="border border-[#D5E3D8] bg-[#F5FAF7] p-5 dark:border-[#294235] dark:bg-[#162019]"
                      style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5A7A57] dark:text-[#9AC7A8]">Activos</p>
                      <div className="mt-3 space-y-1">
                        {balanceSheet.assets.map((line) => (
                          <StatementRow key={line.label} label={line.label} amount={line.amount} pct={line.pct} currency={balanceSheet.currency} />
                        ))}
                      </div>
                    </div>

                    <div
                      className="border border-[#E6D6B8] bg-[#FFF8EC] p-5 dark:border-[#5B4A2F] dark:bg-[#21180F]"
                      style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8A6118] dark:text-[#D7B36B]">Pasivos</p>
                      <div className="mt-3 space-y-1">
                        {balanceSheet.liabilities.length === 0 ? (
                          <div className="border border-dashed border-[#E6D6B8] px-4 py-5 text-sm text-[#8A6118] dark:border-[#5B4A2F] dark:text-[#D7B36B]">
                            No hay deudas a pagar registradas.
                          </div>
                        ) : (
                          balanceSheet.liabilities.map((line) => (
                            <StatementRow key={line.label} label={line.label} amount={line.amount} pct={line.pct} currency={balanceSheet.currency} variant="negative" />
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
                      <p className="font-mono text-2xl font-light num-tabular">{fmtAmount(balanceSheet.equity, balanceSheet.currency, true)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

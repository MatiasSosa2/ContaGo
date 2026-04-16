'use client'

import { useEffect, useMemo, useState } from 'react'

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
}

const CURRENCY_SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$' }

function fmtAmount(value: number, currency: string, signed = false) {
  const formatted = `${CURRENCY_SYMBOL[currency] || '$'}${Math.abs(value).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`

  if (!signed) {
    return formatted
  }

  return `${value >= 0 ? '+' : '−'}${formatted}`
}

function fmtPct(value: number) {
  return `${value.toFixed(1)}%`
}

function MetricChip({ label, value, tone }: { label: string; value: string; tone: 'green' | 'sand' | 'ink' }) {
  const toneClass =
    tone === 'green'
      ? 'border-[#D5E3D8] bg-[#F5FAF7] text-[#2D5A41] dark:border-[#294235] dark:bg-[#162019] dark:text-[#9AC7A8]'
      : tone === 'sand'
      ? 'border-[#E6D6B8] bg-[#FFF8EC] text-[#8A6118] dark:border-[#5B4A2F] dark:bg-[#21180F] dark:text-[#D7B36B]'
      : 'border-[#ECE7E1] bg-[#FAFBFC] text-[#1F2937] dark:border-white/10 dark:bg-[#171717] dark:text-[#E8E8E8]'

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="mt-1 text-lg font-mono font-light num-tabular">{value}</p>
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
      : 'border-[#ECE7E1] bg-[#FAFBFC] text-[#6B7280] dark:border-white/10 dark:bg-[#171717] dark:text-[#A3A3A3]'

  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-[#ECE7E1] py-3 last:border-b-0 dark:border-white/10 ${variant === 'highlight' ? 'rounded-2xl bg-[#FAFBFC] px-3 dark:bg-[#171717]' : ''}`}>
      <p className="min-w-0 text-sm font-medium text-[#1F2937] dark:text-[#E8E8E8]">{label}</p>
      <p className={`text-right text-sm font-mono font-light num-tabular ${amountClass}`}>{fmtAmount(amount, currency, variant === 'positive' || variant === 'negative')}</p>
      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${chipClass}`}>{fmtPct(pct)}</span>
    </div>
  )
}

function TriggerCard({
  eyebrow,
  title,
  amount,
  detail,
  tone,
  onClick,
}: {
  eyebrow: string
  title: string
  amount: string
  detail: string
  tone: 'green' | 'sand' | 'ink'
  onClick: () => void
}) {
  const toneClass =
    tone === 'green'
      ? 'border-[#D5E3D8] bg-[linear-gradient(180deg,#F7FBF8_0%,#F2F8F4_100%)] dark:border-[#294235] dark:bg-[linear-gradient(180deg,#111814_0%,#162019_100%)]'
      : tone === 'sand'
      ? 'border-[#E6D6B8] bg-[linear-gradient(180deg,#FFFDF8_0%,#FFF8EC_100%)] dark:border-[#5B4A2F] dark:bg-[linear-gradient(180deg,#19130D_0%,#21180F_100%)]'
      : 'border-[#ECE7E1] bg-[linear-gradient(180deg,#FFFFFF_0%,#FAFBFC_100%)] dark:border-white/10 dark:bg-[linear-gradient(180deg,#141414_0%,#171717_100%)]'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-[24px] border p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-[1px] hover:shadow-[0_14px_32px_rgba(15,23,42,0.10)] dark:shadow-none ${toneClass}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9CA3AF]">{eyebrow}</p>
      <h3 className="mt-2 text-sm font-semibold text-[#1F2937] dark:text-[#E8E8E8] sm:text-base">{title}</h3>
      <p className="mt-3 text-xl font-mono font-light tracking-tight text-[#1F2937] dark:text-[#F3F4F6] sm:text-2xl">{amount}</p>
      <p className="mt-2 text-sm text-[#6B7280] dark:text-[#A3A3A3]">{detail}</p>
      <div className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5A7A57] dark:text-[#9AC7A8]">
        Ver estado
        <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  )
}

export default function FinancialStatementsPanel({
  periodLabel,
  results,
  cashFlow,
  balanceSheet,
}: FinancialStatementsPanelProps) {
  const [open, setOpen] = useState(false)
  const [activeView, setActiveView] = useState<ViewKey>('results')
  const launcherMetrics = [
    {
      label: 'Resultado neto',
      value: fmtAmount(results.netProfit, results.currency, true),
      tone: 'green' as const,
    },
    {
      label: 'Saldo final',
      value: fmtAmount(cashFlow.closingBalance, cashFlow.currency),
      tone: 'sand' as const,
    },
    {
      label: 'Patrimonio',
      value: fmtAmount(balanceSheet.equity, balanceSheet.currency, true),
      tone: 'ink' as const,
    },
  ]

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const activeTitle = useMemo(() => {
    if (activeView === 'results') return 'Estado de resultados'
    if (activeView === 'cashflow') return 'Estado de flujo de efectivo'
    return 'Estado de situación patrimonial'
  }, [activeView])

  function openModal(view: ViewKey) {
    setActiveView(view)
    setOpen(true)
  }

  return (
    <>
      <section className="space-y-4">
        <div className="overflow-hidden rounded-[30px] border border-[#E5E7EB] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
          <div className="border-b border-[#ECE7E1] bg-[linear-gradient(180deg,#FCFCFB_0%,#FAFBFC_100%)] px-5 py-5 dark:border-white/10 dark:bg-[#171717] sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9CA3AF]">Estados financieros</p>
                <h2 className="mt-1 text-xl font-semibold text-[#1F2937] dark:text-[#E8E8E8]">Un solo cuadro para leer el negocio completo</h2>
                <p className="mt-2 max-w-2xl text-sm text-[#6B7280] dark:text-[#A3A3A3]">
                  Elegí qué estado querés abrir y cambiá entre resultados, flujo y patrimonio dentro del mismo modal.
                </p>
              </div>

              <div className="rounded-2xl border border-[#ECE7E1] bg-white px-4 py-3 dark:border-white/10 dark:bg-[#111111]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">Periodo analizado</p>
                <p className="mt-1 text-sm font-semibold text-[#1F2937] dark:text-[#E8E8E8]">{periodLabel}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {launcherMetrics.map((metric) => (
                <MetricChip
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  tone={metric.tone}
                />
              ))}
            </div>
          </div>

          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">Seleccioná una vista</p>
                <p className="mt-1 text-sm text-[#6B7280] dark:text-[#A3A3A3]">Las tres lecturas viven en el mismo espacio.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <TriggerCard
                eyebrow="Resultados"
                title="Rentabilidad del período"
                amount={fmtAmount(results.netProfit, results.currency, true)}
                detail={`Margen neto ${fmtPct(results.netMargin)}`}
                tone="green"
                onClick={() => openModal('results')}
              />
              <TriggerCard
                eyebrow="Flujo"
                title="Movimiento real de caja"
                amount={fmtAmount(cashFlow.closingBalance, cashFlow.currency)}
                detail={`Variación ${fmtAmount(cashFlow.netVariation, cashFlow.currency, true)}`}
                tone="sand"
                onClick={() => openModal('cashflow')}
              />
              <TriggerCard
                eyebrow="Patrimonio"
                title="Foto financiera actual"
                amount={fmtAmount(balanceSheet.equity, balanceSheet.currency, true)}
                detail={`Activos ${fmtAmount(balanceSheet.totalAssets, balanceSheet.currency)}`}
                tone="ink"
                onClick={() => openModal('balance')}
              />
            </div>
          </div>
        </div>
      </section>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 sm:p-6" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />

          <div
            className="relative my-4 flex max-h-[calc(100vh-56px)] w-full max-w-[1120px] flex-col overflow-hidden rounded-[30px] border border-[#ECE7E1] bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)] sm:max-h-[calc(100vh-72px)] dark:border-white/10 dark:bg-[#141414] dark:shadow-[0_30px_90px_rgba(0,0,0,0.42)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute right-5 top-5 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-[#ECE7E1] bg-white text-stone-500 shadow-sm transition-colors hover:text-stone-700 dark:border-white/10 dark:bg-[#1B1B1B] dark:text-stone-300"
              aria-label="Cerrar modal"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="border-b border-[#ECE7E1] bg-[#FAFBFC] px-6 py-5 pr-16 dark:border-white/10 dark:bg-[#171717]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9CA3AF]">Resumen ejecutivo</p>
              <h3 className="mt-1 text-lg font-semibold text-[#1F2937] dark:text-[#E8E8E8]">{activeTitle}</h3>
              <p className="mt-1 text-sm text-[#6B7280] dark:text-[#A3A3A3]">{periodLabel}</p>

              <div className="mt-4 inline-flex rounded-2xl border border-[#ECE7E1] bg-white p-1 dark:border-white/10 dark:bg-[#111111]">
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
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${isActive ? 'bg-brand-military text-white' : 'text-[#6B7280] hover:text-[#1F2937] dark:text-[#A3A3A3] dark:hover:text-[#E8E8E8]'}`}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="overflow-y-auto px-6 py-6">
              {activeView === 'results' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <MetricChip label="Ingresos" value={fmtAmount(results.income, results.currency)} tone="green" />
                    <MetricChip label="Ganancia bruta" value={`${fmtAmount(results.grossProfit, results.currency, true)} · ${fmtPct(results.grossMargin)}`} tone="sand" />
                    <MetricChip label="Ganancia neta" value={`${fmtAmount(results.netProfit, results.currency, true)} · ${fmtPct(results.netMargin)}`} tone="ink" />
                  </div>

                  <div className="rounded-[28px] border border-[#ECE7E1] bg-white p-5 dark:border-white/10 dark:bg-[#141414]">
                    <StatementRow label="Ingresos" amount={results.income} pct={100} currency={results.currency} variant="positive" />
                    <StatementRow label="Costo de mercadería vendida" amount={results.cogs} pct={results.income > 0 ? (results.cogs / results.income) * 100 : 0} currency={results.currency} variant="negative" />
                    <StatementRow label="Ganancia bruta" amount={results.grossProfit} pct={results.grossMargin} currency={results.currency} variant="highlight" />

                    <div className="pt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">Otros gastos operativos</p>
                      <div className="mt-2">
                        {results.operatingExpenses.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-[#ECE7E1] px-4 py-5 text-sm text-[#9CA3AF] dark:border-white/10 dark:text-[#737373]">
                            Sin otros gastos clasificados en el período.
                          </div>
                        ) : (
                          results.operatingExpenses.map((line) => (
                            <StatementRow key={line.label} label={line.label} amount={line.amount} pct={line.pct} currency={results.currency} variant="negative" />
                          ))
                        )}
                      </div>
                    </div>

                    <div className="mt-4 rounded-[24px] bg-brand-military px-4 py-4 text-white">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-military-light/80">Ganancia neta</p>
                          <p className="mt-1 text-sm text-brand-military-light/80">Después de CMV y gastos operativos</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-mono font-light num-tabular">{fmtAmount(results.netProfit, results.currency, true)}</p>
                          <p className="mt-1 text-sm text-brand-gold">{fmtPct(results.netMargin)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeView === 'cashflow' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <MetricChip label="Saldo inicial" value={fmtAmount(cashFlow.openingBalance, cashFlow.currency)} tone="ink" />
                    <MetricChip label="Variación neta" value={fmtAmount(cashFlow.netVariation, cashFlow.currency, true)} tone="sand" />
                    <MetricChip label="Saldo final" value={fmtAmount(cashFlow.closingBalance, cashFlow.currency)} tone="green" />
                  </div>

                  <div className="rounded-[28px] border border-[#ECE7E1] bg-white p-5 dark:border-white/10 dark:bg-[#141414]">
                    <StatementRow label="Saldo inicial" amount={cashFlow.openingBalance} pct={0} currency={cashFlow.currency} />
                    <StatementRow label="Ingresos cobrados" amount={cashFlow.collectedIncome} pct={cashFlow.openingBalance !== 0 ? (cashFlow.collectedIncome / Math.max(Math.abs(cashFlow.openingBalance), 1)) * 100 : 100} currency={cashFlow.currency} variant="positive" />

                    <div className="pt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">Egresos clasificados</p>
                      <div className="mt-2">
                        {cashFlow.expenseLines.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-[#ECE7E1] px-4 py-5 text-sm text-[#9CA3AF] dark:border-white/10 dark:text-[#737373]">
                            No se registran egresos cobrados o pagados en el período.
                          </div>
                        ) : (
                          cashFlow.expenseLines.map((line) => (
                            <StatementRow key={line.label} label={line.label} amount={line.amount} pct={line.pct} currency={cashFlow.currency} variant="negative" />
                          ))
                        )}
                      </div>
                    </div>

                    <StatementRow label="Variación neta del mes" amount={cashFlow.netVariation} pct={cashFlow.openingBalance !== 0 ? (cashFlow.netVariation / Math.max(Math.abs(cashFlow.openingBalance), 1)) * 100 : 100} currency={cashFlow.currency} variant="highlight" />

                    <div className="mt-4 rounded-[24px] border border-[#D5E3D8] bg-[#F5FAF7] px-4 py-4 dark:border-[#294235] dark:bg-[#162019]">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5A7A57] dark:text-[#9AC7A8]">Saldo final</p>
                          <p className="mt-1 text-sm text-[#6B7280] dark:text-[#A3A3A3]">Caja y bancos al cierre del período</p>
                        </div>
                        <p className="text-xl font-mono font-light text-[#1F2937] num-tabular dark:text-[#E8E8E8]">{fmtAmount(cashFlow.closingBalance, cashFlow.currency)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeView === 'balance' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <MetricChip label="Activos" value={fmtAmount(balanceSheet.totalAssets, balanceSheet.currency)} tone="green" />
                    <MetricChip label="Pasivos" value={fmtAmount(balanceSheet.totalLiabilities, balanceSheet.currency)} tone="sand" />
                    <MetricChip label="Patrimonio neto" value={fmtAmount(balanceSheet.equity, balanceSheet.currency, true)} tone="ink" />
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-[28px] border border-[#D5E3D8] bg-[#F5FAF7] p-5 dark:border-[#294235] dark:bg-[#162019]">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5A7A57] dark:text-[#9AC7A8]">Activos</p>
                      <div className="mt-3 space-y-1">
                        {balanceSheet.assets.map((line) => (
                          <StatementRow key={line.label} label={line.label} amount={line.amount} pct={line.pct} currency={balanceSheet.currency} />
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-[#E6D6B8] bg-[#FFF8EC] p-5 dark:border-[#5B4A2F] dark:bg-[#21180F]">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8A6118] dark:text-[#D7B36B]">Pasivos</p>
                      <div className="mt-3 space-y-1">
                        {balanceSheet.liabilities.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-[#E6D6B8] px-4 py-5 text-sm text-[#8A6118] dark:border-[#5B4A2F] dark:text-[#D7B36B]">
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

                  <div className="rounded-[28px] bg-brand-military px-5 py-5 text-white">
                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-military-light/80">Patrimonio neto</p>
                        <p className="mt-1 text-sm text-brand-military-light/80">Activos menos pasivos del negocio</p>
                      </div>
                      <p className="text-2xl font-mono font-light num-tabular">{fmtAmount(balanceSheet.equity, balanceSheet.currency, true)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
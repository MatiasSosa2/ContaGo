'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts'
import { fmtAmount, fmtPct, type ResultsData, type CashFlowData, type BalanceSheetData } from './financial-statements/shared'

type TrendPoint = { label: string; value: number }
type MonthlyPoint = { label: string; net: number }

const TONE_HEX: Record<'green' | 'sand' | 'ink' | 'neutral', string> = {
  green: '#2D5A41',
  sand: '#8A6118',
  ink: '#1B4332',
  neutral: '#3F5F76',
}

type FinancialStatementsPanelProps = {
  periodLabel: string
  queryString: string
  results: ResultsData
  cashFlow: CashFlowData
  balanceSheet: BalanceSheetData
  monthlyEvolution: MonthlyPoint[]
  exportSlot?: ReactNode
}

function toneClasses(tone: 'green' | 'sand' | 'ink') {
  const value =
    tone === 'green'
      ? 'text-[#2D5A41] dark:text-[#9AC7A8]'
      : tone === 'sand'
      ? 'text-[#8A6118] dark:text-[#D7B36B]'
      : 'text-black dark:text-white'

  const badge =
    tone === 'green'
      ? 'bg-[#EAF5EE] text-[#2D5A41] dark:bg-[#162019] dark:text-[#9AC7A8]'
      : tone === 'sand'
      ? 'bg-[#FDF3DF] text-[#8A6118] dark:bg-[#21180F] dark:text-[#D7B36B]'
      : 'bg-brand-military-light text-brand-military dark:bg-white/10 dark:text-white'

  const pctChip =
    tone === 'green'
      ? 'border-[#D5E3D8] bg-[#F5FAF7] text-[#2D5A41] dark:border-[#294235] dark:bg-[#162019] dark:text-[#9AC7A8]'
      : tone === 'sand'
      ? 'border-[#E6D6B8] bg-[#FFF8EC] text-[#8A6118] dark:border-[#5B4A2F] dark:bg-[#21180F] dark:text-[#D7B36B]'
      : 'border-[#D1D5DB] bg-[#F3F4F6] text-[#374151] dark:border-white/10 dark:bg-white/5 dark:text-[#D1D5DB]'

  return { value, badge, pctChip }
}

function TrendArrow({ pct }: { pct: number }) {
  if (Math.abs(pct) < 0.05) {
    return (
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
      </svg>
    )
  }
  return pct > 0 ? (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-6 6m6-6l6 6" />
    </svg>
  ) : (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m0 0l-6-6m6 6l6-6" />
    </svg>
  )
}

function ValueCard({
  title,
  subtitle,
  periodLabel,
  previewValue,
  pctValue,
  trendPoints,
  currency,
  icon,
  tone,
}: {
  title: string
  subtitle: string
  periodLabel: string
  previewValue: string
  pctValue: number
  trendPoints: TrendPoint[]
  currency: string
  icon: ReactNode
  tone: 'green' | 'sand' | 'ink'
}) {
  const hex = TONE_HEX[tone]
  const gradientId = `preview-gradient-${tone}`
  const { value, badge, pctChip } = toneClasses(tone)

  return (
    <div className="relative flex flex-col gap-3 overflow-hidden border border-[#E5E7EB] bg-white p-5 pt-6 shadow-sm transition group-hover:border-brand-military/60 group-hover:shadow-md dark:border-white/10 dark:bg-[#141414] dark:group-hover:border-white/30">
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: hex }} aria-hidden />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center ${badge}`}>{icon}</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">{title}</p>
            <p className="text-[11px] text-[#B0B7C0] dark:text-[#6B7280]">{periodLabel}</p>
          </div>
        </div>
        <span className={`flex shrink-0 items-center gap-1 border px-2 py-1 text-[10px] font-semibold ${pctChip}`}>
          <TrendArrow pct={pctValue} />
          {fmtPct(pctValue)}
        </span>
      </div>

      <div>
        <p className={`font-mono text-[28px] font-bold num-tabular ${value}`}>{previewValue}</p>
        <p className="mt-0.5 text-[11px] text-[#9CA3AF]">{subtitle}</p>
      </div>

      <div className="h-16 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trendPoints} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={hex} stopOpacity={0.4} />
                <stop offset="100%" stopColor={hex} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Tooltip
              cursor={{ stroke: hex, strokeWidth: 1, strokeDasharray: '3 3' }}
              contentStyle={{ border: '1px solid #E5E7EB', background: '#111827', color: '#F9FAFB', fontSize: 11, padding: '6px 10px' }}
              formatter={(val) => [fmtAmount(Number(val), currency, true), '']}
              labelFormatter={(label) => String(label)}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={hex}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function DetailPreviewCard({
  lines,
  ctaLabel,
  tone,
}: {
  lines: { label: string; value: string }[]
  ctaLabel: string
  tone: 'green' | 'sand' | 'ink'
}) {
  const hex = TONE_HEX[tone]
  const ctaClass =
    tone === 'green'
      ? 'text-[#2D5A41] dark:text-[#9AC7A8]'
      : tone === 'sand'
      ? 'text-[#8A6118] dark:text-[#D7B36B]'
      : 'text-brand-military dark:text-white'

  return (
    <div className="flex h-full flex-col gap-2.5 border border-[#E5E7EB] bg-[#FCFDFC] p-5 shadow-sm transition group-hover:border-brand-military/60 group-hover:shadow-md dark:border-white/10 dark:bg-[#101010] dark:group-hover:border-white/30">
      {lines.map((line) => (
        <div key={line.label} className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] pb-2 text-xs last:border-b-0 last:pb-0 dark:border-white/10">
          <span className="flex min-w-0 items-center gap-2 text-[#6B7280] dark:text-[#A3A3A3]">
            <span className="h-1.5 w-1.5 shrink-0" style={{ background: hex }} aria-hidden />
            <span className="truncate">{line.label}</span>
          </span>
          <span className="shrink-0 font-mono font-medium text-[#374151] num-tabular dark:text-[#D1D5DB]">{line.value}</span>
        </div>
      ))}

      <span className={`mt-1 inline-flex w-fit items-center gap-1.5 text-xs font-semibold ${ctaClass}`}>
        {ctaLabel}
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </div>
  )
}

function MonthlyEvolutionCard({ points }: { points: MonthlyPoint[] }) {
  const hex = TONE_HEX.neutral
  const hasData = points.some((p) => p.net !== 0)
  const last = points[points.length - 1]
  const prev = points[points.length - 2]
  const deltaPct = last && prev && prev.net !== 0 ? ((last.net - prev.net) / Math.abs(prev.net)) * 100 : 0

  return (
    <div className="relative flex h-full flex-col gap-3 overflow-hidden border border-[#E5E7EB] bg-white p-5 pt-6 shadow-sm dark:border-white/10 dark:bg-[#141414]">
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: hex }} aria-hidden />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#EAF0F5] text-[#3F5F76] dark:bg-white/10 dark:text-[#9BC1DA]">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8M21 7v6h-6" />
            </svg>
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">Evolución mensual</p>
            <p className="text-[11px] text-[#B0B7C0] dark:text-[#6B7280]">Últimos 6 meses</p>
          </div>
        </div>
        {last && (
          <span className="flex shrink-0 items-center gap-1 border border-[#D1D5DB] bg-[#F3F4F6] px-2 py-1 text-[10px] font-semibold text-[#374151] dark:border-white/10 dark:bg-white/5 dark:text-[#D1D5DB]">
            <TrendArrow pct={deltaPct} />
            {fmtPct(deltaPct)}
          </span>
        )}
      </div>

      {hasData ? (
        <div className="h-[132px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="preview-gradient-neutral" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={hex} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={hex} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Tooltip
                cursor={{ stroke: hex, strokeWidth: 1, strokeDasharray: '3 3' }}
                contentStyle={{ border: '1px solid #E5E7EB', background: '#111827', color: '#F9FAFB', fontSize: 11, padding: '6px 10px' }}
                formatter={(val) => [fmtAmount(Number(val), 'ARS', true), 'Neto']}
                labelFormatter={(label) => String(label)}
              />
              <Area
                type="monotone"
                dataKey="net"
                stroke={hex}
                strokeWidth={2}
                fill="url(#preview-gradient-neutral)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-[132px] items-center justify-center border border-dashed border-[#E5E7EB] text-center text-xs text-[#9CA3AF] dark:border-white/10">
          Sin movimientos suficientes para graficar la evolución.
        </div>
      )}
    </div>
  )
}

export default function FinancialStatementsPanel({
  periodLabel,
  queryString,
  results,
  cashFlow,
  balanceSheet,
  monthlyEvolution,
  exportSlot,
}: FinancialStatementsPanelProps) {
  const qs = queryString ? `?${queryString}` : ''

  const cashFlowPct = cashFlow.openingBalance !== 0
    ? (cashFlow.netVariation / Math.abs(cashFlow.openingBalance)) * 100
    : 100
  const equityRatioPct = balanceSheet.totalAssets !== 0
    ? (balanceSheet.equity / balanceSheet.totalAssets) * 100
    : 0

  return (
    <section className="executive-panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[#E5E7EB] bg-[#FCFDFC] px-5 py-4 dark:border-white/10 dark:bg-[#141414] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center bg-brand-military-light text-brand-military">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 15l4-4 4 4 5-6" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1F2937] dark:text-[#E8E8E8]">Estados financieros</h2>
            <p className="text-xs text-[#9CA3AF]">Tocá un estado para ver el detalle completo</p>
          </div>
        </div>

        {exportSlot ? <div className="shrink-0">{exportSlot}</div> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 p-5 pb-0 md:grid-cols-3">
        <Link href={`/reports/resultados${qs}`} className="group">
          <ValueCard
            title="Estado de Resultados"
            subtitle="Ingresos menos costos y gastos del período"
            periodLabel={periodLabel}
            previewValue={fmtAmount(results.netProfit, results.currency, true)}
            pctValue={results.netMargin}
            trendPoints={[
              { label: 'Ingresos', value: results.income },
              { label: 'Gcia. bruta', value: results.grossProfit },
              { label: 'Gcia. neta', value: results.netProfit },
            ]}
            currency={results.currency}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 15l4-4 4 4 5-6" />
              </svg>
            }
            tone="green"
          />
        </Link>

        <Link href={`/reports/flujo-caja${qs}`} className="group">
          <ValueCard
            title="Estado de Flujo de Caja"
            subtitle="Efectivo disponible al cierre del período"
            periodLabel={periodLabel}
            previewValue={fmtAmount(cashFlow.closingBalance, cashFlow.currency)}
            pctValue={cashFlowPct}
            trendPoints={[
              { label: 'Saldo inicial', value: cashFlow.openingBalance },
              { label: 'Cobrado', value: cashFlow.collectedIncome },
              { label: 'Saldo final', value: cashFlow.closingBalance },
            ]}
            currency={cashFlow.currency}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a4 4 0 00-8 0v2M5 9h14l-1 11H6L5 9z" />
              </svg>
            }
            tone="sand"
          />
        </Link>

        <Link href={`/reports/patrimonio${qs}`} className="group">
          <ValueCard
            title="Estado Patrimonial"
            subtitle="Lo que la empresa tiene menos lo que debe"
            periodLabel={periodLabel}
            previewValue={fmtAmount(balanceSheet.equity, balanceSheet.currency, true)}
            pctValue={equityRatioPct}
            trendPoints={[
              { label: 'Activos', value: balanceSheet.totalAssets },
              { label: 'Pasivos', value: balanceSheet.totalLiabilities },
              { label: 'Patrimonio', value: balanceSheet.equity },
            ]}
            currency={balanceSheet.currency}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 21V12h6v9" />
              </svg>
            }
            tone="ink"
          />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Link href={`/reports/resultados${qs}`} className="group flex">
          <DetailPreviewCard
            tone="green"
            ctaLabel="Ver Estado de Resultados"
            lines={[
              { label: 'Ingresos', value: fmtAmount(results.income, results.currency) },
              { label: 'Costo de mercadería vendida', value: fmtAmount(results.cogs, results.currency) },
              { label: 'Gastos operativos', value: fmtAmount(results.operatingExpensesTotal, results.currency) },
            ]}
          />
        </Link>

        <Link href={`/reports/flujo-caja${qs}`} className="group flex">
          <DetailPreviewCard
            tone="sand"
            ctaLabel="Ver Flujo de Caja"
            lines={[
              { label: 'Ingresos cobrados', value: fmtAmount(cashFlow.collectedIncome, cashFlow.currency) },
              { label: 'Egresos totales', value: fmtAmount(cashFlow.totalExpenses, cashFlow.currency) },
              { label: 'Saldo inicial', value: fmtAmount(cashFlow.openingBalance, cashFlow.currency) },
            ]}
          />
        </Link>

        <Link href={`/reports/patrimonio${qs}`} className="group flex">
          <DetailPreviewCard
            tone="ink"
            ctaLabel="Ver Estado Patrimonial"
            lines={[
              { label: 'Activos totales', value: fmtAmount(balanceSheet.totalAssets, balanceSheet.currency) },
              { label: 'Pasivos totales', value: fmtAmount(balanceSheet.totalLiabilities, balanceSheet.currency) },
              { label: 'Patrimonio neto', value: fmtAmount(balanceSheet.equity, balanceSheet.currency, true) },
            ]}
          />
        </Link>

        <Link href={`/reports/evolucion${qs}`} className="group flex">
          <MonthlyEvolutionCard points={monthlyEvolution} />
        </Link>
      </div>
    </section>
  )
}

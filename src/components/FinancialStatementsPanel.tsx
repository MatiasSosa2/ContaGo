'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { FiArrowDown, FiArrowUp, FiBarChart2, FiChevronRight, FiDollarSign, FiHome, FiMinus, FiTrendingUp } from 'react-icons/fi'
import { ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts'
import { fmtAmount, fmtPct, type ResultsData, type CashFlowData, type BalanceSheetData } from './financial-statements/shared'

type TrendPoint = { label: string; value: number }
type MonthlyPoint = { label: string; net: number }
type PreviewLine = { label: string; value: string; spacing?: 'normal' | 'loose' }

const TONE_HEX: Record<'green' | 'yellow' | 'blue', string> = {
  green: '#4F7D64',
  yellow: '#9A7A3A',
  blue: '#526F91',
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

function toneClasses(tone: 'green' | 'yellow' | 'blue') {
  const value =
    tone === 'green'
      ? 'text-[#4F7D64] dark:text-[#A7C8B4]'
      : tone === 'yellow'
      ? 'text-[#9A7A3A] dark:text-[#D1B56F]'
      : 'text-[#526F91] dark:text-[#A9BED7]'

  const badge =
    tone === 'green'
      ? 'bg-[#EEF5F0] text-[#4F7D64] dark:bg-[#18241D] dark:text-[#A7C8B4]'
      : tone === 'yellow'
      ? 'bg-[#F6F0E3] text-[#8A6E36] dark:bg-[#292315] dark:text-[#D1B56F]'
      : 'bg-[#EEF3F8] text-[#526F91] dark:bg-[#172230] dark:text-[#A9BED7]'

  const pctChip =
    tone === 'green'
      ? 'border-[#D7E4DC] bg-[#F6FAF7] text-[#4F7D64] dark:border-[#2A4233] dark:bg-[#18241D] dark:text-[#A7C8B4]'
      : tone === 'yellow'
      ? 'border-[#E4D8BE] bg-[#FBF7EF] text-[#8A6E36] dark:border-[#514323] dark:bg-[#292315] dark:text-[#D1B56F]'
      : 'border-[#D5DFEA] bg-[#F6F9FC] text-[#526F91] dark:border-[#2A3C52] dark:bg-[#172230] dark:text-[#A9BED7]'

  return { value, badge, pctChip }
}

function TrendArrow({ pct }: { pct: number }) {
  if (Math.abs(pct) < 0.05) {
    return <FiMinus className="h-3 w-3" />
  }
  return pct > 0 ? <FiArrowUp className="h-3 w-3" /> : <FiArrowDown className="h-3 w-3" />
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
  tone: 'green' | 'yellow' | 'blue'
}) {
  const hex = TONE_HEX[tone]
  const gradientId = `preview-gradient-${tone}`
  const { value, badge } = toneClasses(tone)

  return (
    <div className="flex min-h-[136px] flex-col gap-3 overflow-hidden rounded-xl border border-[#E6EAEE] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] transition group-hover:-translate-y-0.5 group-hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#141414]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${badge}`}>{icon}</span>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-bold text-[#172033] dark:text-[#F4F7FB]">{title}</p>
            <p className="mt-0.5 text-[11px] text-[#7A8594] dark:text-[#9CA3AF]">{periodLabel}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(92px,34%)] items-end gap-3 sm:grid-cols-[minmax(0,1fr)_112px] md:grid-cols-[minmax(0,1fr)_96px] xl:grid-cols-[minmax(0,1fr)_118px]">
        <div className="min-w-0">
          <p className={`truncate font-mono text-[22px] font-bold leading-none num-tabular xl:text-[24px] ${value}`}>{previewValue}</p>
          <p className="mt-2 flex min-w-0 items-center gap-1.5 text-[10px] font-semibold" style={{ color: hex }}>
            <TrendArrow pct={pctValue} />
            <span className="shrink-0">{fmtPct(pctValue)}</span>
            <span className="truncate font-normal text-[#9AA3AF] dark:text-[#7A8594]">{subtitle}</span>
          </p>
        </div>

        <div className="h-[58px] w-full min-w-0 xl:h-[64px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={trendPoints} margin={{ top: 6, right: 6, left: 6, bottom: 2 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={hex} stopOpacity={0.24} />
                  <stop offset="100%" stopColor={hex} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Tooltip
                cursor={{ stroke: hex, strokeWidth: 1, strokeDasharray: '3 3' }}
                contentStyle={{ border: '1px solid #E5E7EB', background: '#111827', color: '#F9FAFB', fontSize: 11, padding: '6px 10px', borderRadius: 10 }}
                formatter={(val) => [fmtAmount(Number(val), currency, true), '']}
                labelFormatter={(label) => String(label)}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={hex}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={{ r: 2, strokeWidth: 1.5, fill: '#FFFFFF' }}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function DetailPreviewCard({
  statementTitle,
  title,
  icon,
  lines,
  result,
  ctaLabel,
  tone,
}: {
  statementTitle: string
  title: string
  icon: ReactNode
  lines: PreviewLine[]
  result: { label: string; value: string }
  ctaLabel: string
  tone: 'green' | 'yellow' | 'blue'
}) {
  const hex = TONE_HEX[tone]
  const ctaClass =
    tone === 'green'
      ? 'text-[#16A34A] dark:text-[#86EFAC]'
      : tone === 'yellow'
      ? 'text-[#B45309] dark:text-[#FACC15]'
      : 'text-[#2563EB] dark:text-[#93C5FD]'

  return (
    <div className="flex min-h-[245px] w-full flex-col rounded-xl border border-[#E6EAEE] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] transition group-hover:-translate-y-0.5 group-hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#101010]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: `${hex}14`, color: hex }}>{icon}</span>
          <p className="text-[12px] font-bold text-[#172033] dark:text-[#F4F7FB]">{statementTitle}</p>
        </div>
      </div>

      <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#172033] dark:text-[#E5E7EB]">{title}</p>

      {lines.map((line) => (
        <div key={line.label} className={`flex items-center justify-between gap-4 text-[11px] ${line.spacing === 'loose' ? 'mt-4' : 'mt-2.5'}`}>
          <span className="min-w-0 truncate text-[#4B5563] dark:text-[#A3A3A3]">
            {line.label}
          </span>
          <span className="shrink-0 font-mono font-semibold text-[#172033] num-tabular dark:text-[#D1D5DB]">{line.value}</span>
        </div>
      ))}

      <div className="mt-auto flex items-center justify-between gap-4 border-t border-[#E7EBEF] pt-4 dark:border-white/10">
        <p className="text-[11px] font-bold text-[#172033] dark:text-[#F4F7FB]">{result.label}</p>
        <p className={`font-mono text-[13px] font-bold num-tabular ${ctaClass}`}>{result.value}</p>
      </div>

      <span className="mt-4 flex h-9 items-center justify-between rounded-lg border border-[#E6EAEE] px-3 text-[11px] font-semibold text-[#697386] dark:border-white/10 dark:text-[#D1D5DB]">
        <span className="flex items-center gap-2">
          <FiBarChart2 className="h-3.5 w-3.5" />
        {ctaLabel}
        </span>
        <FiChevronRight className="h-3.5 w-3.5" />
      </span>
    </div>
  )
}

export default function FinancialStatementsPanel({
  periodLabel,
  queryString,
  results,
  cashFlow,
  balanceSheet,
  exportSlot,
}: FinancialStatementsPanelProps) {
  const qs = queryString ? `?${queryString}` : ''

  const cashFlowPct = cashFlow.openingBalance !== 0
    ? (cashFlow.netVariation / Math.abs(cashFlow.openingBalance)) * 100
    : 100
  const equityRatioPct = balanceSheet.totalAssets !== 0
    ? (balanceSheet.equity / balanceSheet.totalAssets) * 100
    : 0
  const selectedPeriodTitle = `Periodo seleccionado: ${periodLabel}`

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-military-light text-brand-military">
            <FiBarChart2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#172033] dark:text-[#E8E8E8]">Reportes</h2>
            <p className="text-xs text-[#7A8594]">Resumen integral de la salud financiera de tu negocio.</p>
          </div>
        </div>

        {exportSlot ? <div className="shrink-0">{exportSlot}</div> : null}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Link href={`/reports/resultados${qs}`} className="group">
          <ValueCard
            title="Estado de Resultado"
            subtitle="Ganancia Neta."
            periodLabel={periodLabel}
            previewValue={fmtAmount(results.netProfit, results.currency, true)}
            pctValue={results.netMargin}
            trendPoints={[
              { label: 'Ingresos', value: results.income },
              { label: 'CMV', value: -results.cogs },
              { label: 'Gcia. bruta', value: results.grossProfit },
              { label: 'Gastos', value: results.grossProfit - results.operatingExpensesTotal },
              { label: 'Gcia. neta', value: results.netProfit },
            ]}
            currency={results.currency}
            icon={<FiTrendingUp className="h-4 w-4" />}
            tone="green"
          />
        </Link>

        <Link href={`/reports/flujo-caja${qs}`} className="group">
          <ValueCard
            title="Flujo de Efectivo"
            subtitle="Saldo acumulado."
            periodLabel={periodLabel}
            previewValue={fmtAmount(cashFlow.closingBalance, cashFlow.currency)}
            pctValue={cashFlowPct}
            trendPoints={[
              { label: 'Saldo inicial', value: cashFlow.openingBalance },
              { label: 'Cobrado', value: cashFlow.collectedIncome },
              { label: 'Pagado', value: -cashFlow.totalExpenses },
              { label: 'Variación', value: cashFlow.netVariation },
              { label: 'Saldo final', value: cashFlow.closingBalance },
            ]}
            currency={cashFlow.currency}
            icon={<FiDollarSign className="h-4 w-4" />}
            tone="yellow"
          />
        </Link>

        <Link href={`/reports/patrimonio${qs}`} className="group">
          <ValueCard
            title="Situación Patrimonial"
            subtitle="Patromonio Neto."
            periodLabel={periodLabel}
            previewValue={fmtAmount(balanceSheet.equity, balanceSheet.currency, true)}
            pctValue={equityRatioPct}
            trendPoints={[
              { label: 'Activos', value: balanceSheet.totalAssets },
              { label: 'Activos netos', value: balanceSheet.totalAssets - balanceSheet.totalLiabilities / 2 },
              { label: 'Pasivos', value: balanceSheet.totalLiabilities },
              { label: 'Base patrimonial', value: balanceSheet.equity + balanceSheet.totalLiabilities / 2 },
              { label: 'Patrimonio', value: balanceSheet.equity },
            ]}
            currency={balanceSheet.currency}
            icon={<FiHome className="h-4 w-4" />}
            tone="blue"
          />
        </Link>
      </div>

      <div>
        <div className="relative">
          <div className="mb-3">
            <p className="text-sm font-bold text-[#172033] dark:text-[#F8FAFC]">Resumen ejecutivo</p>
            <p className="text-[11px] text-[#7A8594]">{selectedPeriodTitle}</p>
          </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Link href={`/reports/resultados${qs}`} className="group flex">
          <DetailPreviewCard
            tone="green"
            statementTitle="Estado de Resultado"
            title="Principales Cifras"
            icon={<FiTrendingUp className="h-4 w-4" />}
            ctaLabel="Ver detalle del estado de resultado"
            lines={[
              { label: 'Ingresos', value: fmtAmount(results.income, results.currency) },
              { label: 'Costo de mercadería vendida', value: fmtAmount(results.cogs, results.currency) },
              { label: 'Ganancia Bruta', value: fmtAmount(results.grossProfit, results.currency) },
              { label: 'Otros ingresos', value: fmtAmount(0, results.currency), spacing: 'loose' },
              { label: 'Otros Egresos', value: fmtAmount(results.operatingExpensesTotal, results.currency) },
            ]}
            result={{ label: 'Resultado Neto', value: fmtAmount(results.netProfit, results.currency, true) }}
          />
        </Link>

        <Link href={`/reports/flujo-caja${qs}`} className="group flex">
          <DetailPreviewCard
            tone="yellow"
            statementTitle="Flujo de Efectivo"
            title="Resumen del Periodo"
            icon={<FiDollarSign className="h-4 w-4" />}
            ctaLabel="Ver detalle del flujo de efectivo"
            lines={[
              { label: 'Efectivo Inicial', value: fmtAmount(cashFlow.openingBalance, cashFlow.currency) },
              { label: 'Ingresos', value: fmtAmount(cashFlow.collectedIncome, cashFlow.currency) },
              { label: 'Egresos', value: fmtAmount(cashFlow.totalExpenses, cashFlow.currency) },
            ]}
            result={{ label: 'Efectivo Final', value: fmtAmount(cashFlow.closingBalance, cashFlow.currency) }}
          />
        </Link>

        <Link href={`/reports/patrimonio${qs}`} className="group flex">
          <DetailPreviewCard
            tone="blue"
            statementTitle="Situación Patrimonial"
            title="Resumen Patrimonial"
            icon={<FiHome className="h-4 w-4" />}
            ctaLabel="Ver detalle de situación patrimonial"
            lines={[
              { label: 'Activos', value: fmtAmount(balanceSheet.totalAssets, balanceSheet.currency) },
              { label: 'Pasivos', value: fmtAmount(balanceSheet.totalLiabilities, balanceSheet.currency) },
            ]}
            result={{ label: 'Patrimonio Neto', value: fmtAmount(balanceSheet.equity, balanceSheet.currency, true) }}
          />
        </Link>

      </div>
        </div>
      </div>
    </section>
  )
}

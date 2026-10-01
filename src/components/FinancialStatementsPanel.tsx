'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { ResponsiveContainer, AreaChart, Area } from 'recharts'
import type { ResultsData, CashFlowData, BalanceSheetData } from './financial-statements/shared'
import { SF_FONT, SubtleDelta, fmtFull } from './financial-statements/modern'

const SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$' }

/** Montos de los renglones siempre en millones, con un decimal ("$203,9 M") */
function fmtM(value: number, currency = 'ARS', signed = false) {
  const m = Math.abs(value) / 1_000_000
  const num = `${m.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M`
  const n = `${SYMBOL[currency] ?? '$'}${num}`
  if (signed) return `${value >= 0 ? '+' : '−'}${n}`
  return value < 0 ? `−${n}` : n
}

/** Renglones opcionales: se ocultan si en millones redondean a $0,0 M */
const seVeEnM = (value: number) => Math.abs(value) >= 50_000

import type { ReportInsights } from '@/server/reports/insights'

/** Valores del período anterior para comparar (null si no aplica: día, semana, personalizado) */
export type ReportsPrevious = { ventas: number; entro: number; activo: number; label: string } | null
export type ReportsTrends = { ventas: number[]; entro: number[]; activo: number[] }

type Props = {
  periodLabel: string
  queryString: string
  results: ResultsData
  cashFlow: CashFlowData
  balanceSheet: BalanceSheetData
  trends: ReportsTrends
  previous: ReportsPrevious
  insights: ReportInsights
}

const CYAN = '#32ADE6'

/** Monto corto para la frase de resumen: $19,8 M · $223 mil · $850 */
function corto(v: number) {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
  if (abs >= 1_000) return `$${Math.round(abs / 1_000).toLocaleString('es-AR')} mil`
  return `$${Math.round(abs).toLocaleString('es-AR')}`
}

function Sparkline({ values, color, id }: { values: number[]; color: string; id: string }) {
  if (values.length < 2) return <div className="h-12" />
  const data = values.map((v, i) => ({ i, v }))
  return (
    <div className="h-12 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 2 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.8} fill={`url(#${id})`} isAnimationActive={false}
            dot={(p: { cx?: number; cy?: number; index?: number }) => (
              p.index === values.length - 1 && p.cx !== undefined && p.cy !== undefined
                ? <circle key={p.index} cx={p.cx} cy={p.cy} r={2.5} fill={color} />
                : <g key={p.index} />
            )}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Tarjeta de un estado: nombre, número principal con su variación, tendencia y resumen */
function StatementCard({ href, title, metric, value, negative, delta, trend, trendId, rows, footer }: {
  href: string
  title: string
  metric: string
  value: string
  negative?: boolean
  delta: number | null
  trend: number[]
  trendId: string
  rows: { label: string; value: string }[]
  /** Resultado del estado, abajo de todo y separado (ganancia neta, variación, patrimonio) */
  footer: { label: string; value: string; color: 'cyan' | 'green' | 'red' }
}) {
  const footerColor = footer.color === 'cyan' ? 'text-[#0071A4] dark:text-[#64D2FF]' : footer.color === 'green' ? 'text-[#248A3D] dark:text-[#30D158]' : 'text-[#D70015] dark:text-[#FF453A]'
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.03)] transition hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(0,0,0,0.05),0_10px_28px_rgba(0,0,0,0.07)] active:scale-[0.99] dark:bg-[#1C1C1E] dark:shadow-none"
    >
      <p className="text-center text-[13px] text-[#8E8E93]">{title}</p>

      <p className="mt-3 text-[12px] text-[#8E8E93]">{metric}</p>
      <div className="flex items-baseline justify-between gap-3">
        <p className={`text-[24px] font-semibold tracking-tight tabular-nums ${negative ? 'text-[#D70015] dark:text-[#FF453A]' : 'text-[#1C1C1E] dark:text-white'}`}>{value}</p>
        {delta !== null && <SubtleDelta value={delta} />}
      </div>

      <div className="mt-2"><Sparkline values={trend} color={CYAN} id={trendId} /></div>

      <div className="mb-4 mt-3 space-y-1.5 border-t border-black/[0.06] pt-3 dark:border-white/[0.08]">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="text-[#8E8E93]">{r.label}</span>
            <span className="tabular-nums text-[#1C1C1E] dark:text-white">{r.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-baseline justify-between gap-3 border-t border-black/10 pt-3 dark:border-white/15">
        <span className="text-[14px] font-semibold text-[#1C1C1E] dark:text-white">{footer.label}</span>
        <span className={`text-[16px] font-semibold tabular-nums ${footerColor}`}>{footer.value}</span>
      </div>
    </Link>
  )
}

/** Ranking con barra proporcional (estilo Tiempo en pantalla) */
function RankList({ items, color, currency, empty, numbered = true }: {
  items: { name: string; value: number; note?: string }[]
  color: string
  currency: string
  empty: string
  numbered?: boolean
}) {
  if (items.length === 0) return <p className="text-[13px] text-[#8E8E93]">{empty}</p>
  const max = Math.max(1, ...items.map((it) => it.value))
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <li key={it.name}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-baseline gap-2">
              {numbered && <span className="w-3 shrink-0 text-[12px] tabular-nums text-[#AEAEB2]">{i + 1}</span>}
              <span className="truncate text-[#1C1C1E] dark:text-white">{it.name}</span>
              {it.note && <span className="shrink-0 text-[11px] tabular-nums text-[#AEAEB2]">{it.note}</span>}
            </span>
            <span className="shrink-0 tabular-nums text-[#3C3C43] dark:text-[#EBEBF5]/80">{fmtM(it.value, currency)}</span>
          </div>
          <div className={`${numbered ? 'ml-5 ' : ''}mt-1 h-[5px] rounded-full bg-black/[0.05] dark:bg-white/[0.08]`}>
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, (it.value / max) * 100)}%`, backgroundColor: color }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function ListCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.03)] dark:bg-[#1C1C1E] dark:shadow-none">
      <p className="mb-3 text-[15px] font-semibold text-[#1C1C1E] dark:text-white">{title}</p>
      {children}
    </div>
  )
}

export default function FinancialStatementsPanel({ periodLabel, queryString, results, cashFlow, balanceSheet, trends, previous, insights }: Props) {
  const qs = queryString ? `?${queryString}` : ''
  const cur = results.currency
  const gano = results.netProfit >= 0
  const gastos = [...cashFlow.expenseLines].filter((l) => l.amount > 0).sort((x, y) => y.amount - x.amount)
  const resto = gastos.slice(5).reduce((sum, l) => sum + l.amount, 0)
  const egresos = [
    ...gastos.slice(0, 5).map((l) => ({ name: l.label, value: l.amount })),
    ...(resto > 0 ? [{ name: 'Otros', value: resto }] : []),
  ]

  return (
    <section className="space-y-5" style={{ fontFamily: SF_FONT }}>
      {/* Frase de resumen del período */}
      <p className="text-[15px] leading-relaxed text-[#3C3C43] dark:text-[#EBEBF5]/80">
        En {periodLabel.replace(/^Año /, '')} vendiste <span className="font-semibold text-[#1C1C1E] dark:text-white">{corto(results.sales)}</span>,{' '}
        {gano ? 'ganaste' : 'perdiste'} <span className="font-semibold" style={{ color: gano ? CYAN : '#FF3B30' }}>{corto(results.netProfit)}</span>{' '}
        y tu patrimonio {balanceSheet.equity >= 0 ? 'llegó a' : 'quedó en'} <span className="font-semibold text-[#1C1C1E] dark:text-white">{corto(balanceSheet.equity)}</span>.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatementCard
          href={`/reports/resultados${qs}`}
          title="Estado de resultados"
          metric="Ventas"
          value={fmtFull(results.sales, cur)}
          delta={previous ? results.sales - previous.ventas : null}
          trend={trends.ventas}
          trendId="trend-er"
          rows={[
            { label: 'Ventas', value: fmtM(results.sales, cur) },
            { label: 'Costo de lo vendido', value: fmtM(Math.abs(results.cogs), cur) },
            ...(seVeEnM(results.otherIncomeTotal) ? [{ label: results.otherIncomeTotal > 0 ? 'Otros ingresos' : 'Otros egresos', value: fmtM(Math.abs(results.otherIncomeTotal), cur) }] : []),
            { label: 'Gastos', value: fmtM(Math.abs(results.operatingExpensesTotal), cur) },
          ]}
          footer={{ label: 'Ganancia neta', value: fmtM(results.netProfit, cur), color: results.netProfit >= 0 ? 'cyan' : 'red' }}
        />
        <StatementCard
          href={`/reports/flujo-caja${qs}`}
          title="Flujo de efectivo"
          metric="Entró"
          value={fmtFull(cashFlow.collectedIncome, cashFlow.currency)}
          delta={previous ? cashFlow.collectedIncome - previous.entro : null}
          trend={trends.entro}
          trendId="trend-flujo"
          rows={[
            { label: 'Entró', value: fmtM(cashFlow.collectedIncome, cashFlow.currency) },
            { label: 'Salió', value: fmtM(Math.abs(cashFlow.totalExpenses), cashFlow.currency) },
            ...(seVeEnM(cashFlow.currencyExchange) ? [{ label: 'Cambio de moneda', value: fmtM(cashFlow.currencyExchange, cashFlow.currency, true) }] : []),
          ]}
          footer={{ label: 'Variación neta', value: fmtM(cashFlow.netVariation, cashFlow.currency, true), color: cashFlow.netVariation >= 0 ? 'green' : 'red' }}
        />
        <StatementCard
          href={`/reports/patrimonio${qs}`}
          title="Estado patrimonial"
          metric="Activo"
          value={fmtFull(balanceSheet.totalAssets, balanceSheet.currency)}
          delta={previous ? balanceSheet.totalAssets - previous.activo : null}
          trend={trends.activo}
          trendId="trend-pn"
          rows={[
            { label: 'Pasivo', value: fmtM(balanceSheet.totalLiabilities, balanceSheet.currency) },
          ]}
          footer={{ label: 'Patrimonio neto', value: fmtM(balanceSheet.equity, balanceSheet.currency), color: balanceSheet.equity >= 0 ? 'cyan' : 'red' }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Top 5 clientes: lo que compró cada cliente registrado; al pie, los consumidores finales */}
        <ListCard title="Top 5 clientes">
          <RankList
            empty="Sin ventas a clientes registrados en el período"
            color="#0A84FF"
            items={insights.clientes.map((c) => ({
              name: c.name,
              value: c.ventas,
              note: `${c.operaciones} ${c.operaciones === 1 ? 'compra' : 'compras'}`,
            }))}
            currency={cur}
          />
          {insights.consumidoresFinales.ventas > 0 && (
            <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-black/[0.06] pt-3 text-[13px] dark:border-white/[0.08]">
              <span className="text-[#8E8E93]">
                Consumidores finales
                <span className="ml-2 text-[11px] tabular-nums text-[#AEAEB2]">{Math.round(insights.consumidoresFinales.pct)}% de las ventas</span>
              </span>
              <span className="shrink-0 tabular-nums text-[#8E8E93]">{fmtM(insights.consumidoresFinales.ventas, cur)}</span>
            </div>
          )}
        </ListCard>

        {/* Top 5 productos más vendidos: ventas = precio × cantidad */}
        <ListCard title="Top 5 productos más vendidos">
          <RankList
            empty="Sin ventas de productos en el período"
            color="#34C759"
            items={insights.productos.map((p) => ({
              name: p.name,
              value: p.ventas,
              note: `${Math.round(p.unidades).toLocaleString('es-AR')} u.`,
            }))}
            currency={cur}
          />
        </ListCard>

        {/* Egresos por categoría: lo que salió de las cajas (del flujo de efectivo); 5 más grandes + Otros */}
        <div className="md:col-span-2">
          <ListCard title="Egresos por categoría">
            <RankList
              empty="Sin egresos en el período"
              color="#FF3B30"
              items={egresos}
              currency={cashFlow.currency}
              numbered={false}
            />
          </ListCard>
        </div>
      </div>
    </section>
  )
}

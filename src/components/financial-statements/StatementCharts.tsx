'use client'

import type { ReactNode } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Cell, PieChart, Pie,
} from 'recharts'
import type { YearlySeries } from '@/server/reports/yearly-series'
import { fmtAmount, type BalanceSheetData, type StatementLine } from './shared'

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const C = {
  green: '#5A7A57',
  gold: '#C5A065',
  oxide: '#A65D57',
  blue: '#3F5F76',
  grid: 'rgba(156,163,175,0.18)',
  tick: '#9CA3AF',
}
const PIE_COLORS = ['#5A7A57', '#C5A065', '#3F5F76', '#8FA58C', '#A65D57', '#B8B2A9']

/** Montos cortos para los ejes: $1,2 M · $350 k */
function fmtShort(value: number, currency = 'ARS') {
  const sym = currency === 'USD' ? 'US$' : '$'
  const abs = Math.abs(value)
  const sign = value < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
  if (abs >= 1_000) return `${sign}${sym}${Math.round(abs / 1_000).toLocaleString('es-AR')} k`
  return `${sign}${sym}${Math.round(abs).toLocaleString('es-AR')}`
}

const tooltipStyle = {
  contentStyle: { border: 'none', borderRadius: 10, background: '#1C1C1E', color: '#F9FAFB', fontSize: 11, padding: '8px 10px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' },
  labelStyle: { color: '#D1D5DB', marginBottom: 4 },
  itemStyle: { padding: 0 },
}

function ChartCard({ title, subtitle, legend, children }: { title: string; subtitle?: string; legend?: { label: string; color: string }[]; children: ReactNode }) {
  return (
    <div
      className="flex min-h-[280px] flex-1 flex-col border border-[#E5E7EB] bg-white p-5 dark:border-white/10 dark:bg-[#141414]"
      style={{ boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[#A3A3A3]">{subtitle}</p>}
        </div>
        {legend && (
          <div className="flex flex-wrap items-center gap-3">
            {legend.map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-[#6B7280] dark:text-[#A3A3A3]">
                <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {/* El gráfico ocupa todo el alto que le deja la tarjeta */}
      <div className="relative mt-3 min-h-0 flex-1">
        <div className="absolute inset-0">{children}</div>
      </div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-[#9CA3AF]">{text}</div>
}

const axisProps = { tickLine: false, axisLine: false, tick: { fontSize: 11, fill: C.tick } }

/** Opacidad de cada mes: el mes elegido arriba se resalta */
const monthOpacity = (i: number, active?: number) => (active === undefined || active === i ? 1 : 0.45)

function hasData<T>(points: (T | null)[]) {
  return points.some((p) => p !== null)
}

// ── Estado de resultados ──────────────────────────────────────────

export function ResultadosCharts({ series, activeMonth }: { series: YearlySeries; activeMonth?: number }) {
  const data = MONTHS.map((label, i) => ({
    label,
    ventas: series.resultados[i]?.ventas ?? null,
    bruta: series.resultados[i]?.gananciaBruta ?? null,
    neta: series.resultados[i]?.gananciaNeta ?? null,
  }))
  const empty = !hasData(series.resultados)

  return (
    <>
      <ChartCard title="Evolución de las ventas" subtitle={`Enero a diciembre ${series.year}`}>
        {empty ? <Empty text="Sin ventas en el año." /> : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ventas-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.green} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={C.green} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} width={64} tickFormatter={(v) => fmtShort(Number(v))} />
              <Tooltip {...tooltipStyle} formatter={(v) => [fmtAmount(Number(v), 'ARS'), 'Ventas']} />
              <Area type="monotone" dataKey="ventas" stroke={C.green} strokeWidth={2.25} fill="url(#ventas-gradient)" connectNulls={false} isAnimationActive={false}
                dot={(props: { cx?: number; cy?: number; index?: number; value?: number | null }) => {
                  const { cx, cy, index = -1, value } = props
                  if (value === null || value === undefined || cx === undefined || cy === undefined) return <g key={index} />
                  const active = index === activeMonth
                  return <circle key={index} cx={cx} cy={cy} r={active ? 4.5 : 2.5} fill={active ? C.gold : C.green} stroke="#fff" strokeWidth={active ? 1.5 : 0} />
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard
        title="Ganancia bruta vs. ganancia neta"
        subtitle={`Enero a diciembre ${series.year}`}
        legend={[{ label: 'Bruta', color: C.gold }, { label: 'Neta', color: C.green }]}
      >
        {empty ? <Empty text="Sin resultados en el año." /> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} width={64} tickFormatter={(v) => fmtShort(Number(v))} />
              <ReferenceLine y={0} stroke={C.tick} strokeOpacity={0.5} />
              <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(156,163,175,0.08)' }}
                formatter={(v, name) => [fmtAmount(Number(v), 'ARS'), name === 'bruta' ? 'Ganancia bruta' : 'Ganancia neta']} />
              <Bar dataKey="bruta" fill={C.gold} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {data.map((_, i) => <Cell key={i} fillOpacity={monthOpacity(i, activeMonth)} />)}
              </Bar>
              <Bar dataKey="neta" isAnimationActive={false} radius={[3, 3, 0, 0]}>
                {data.map((d, i) => <Cell key={i} fill={(d.neta ?? 0) < 0 ? C.oxide : C.green} fillOpacity={monthOpacity(i, activeMonth)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </>
  )
}

// ── Flujo de efectivo ──────────────────────────────────────────

export function FlujoCharts({ series, currency, activeMonth }: { series: YearlySeries; currency: string; activeMonth?: number }) {
  const data = MONTHS.map((label, i) => ({
    label,
    ingresos: series.flujo[i]?.ingresos ?? null,
    egresos: series.flujo[i]?.egresos ?? null,
    saldo: series.flujo[i]?.saldoFinal ?? null,
  }))
  const empty = !hasData(series.flujo)

  return (
    <>
      <ChartCard
        title="Ingresos vs. egresos"
        subtitle={`Enero a diciembre ${series.year}`}
        legend={[{ label: 'Ingresos', color: C.green }, { label: 'Egresos', color: C.gold }]}
      >
        {empty ? <Empty text="Sin movimientos de caja en el año." /> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} width={64} tickFormatter={(v) => fmtShort(Number(v), currency)} />
              <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(156,163,175,0.08)' }}
                formatter={(v, name) => [fmtAmount(Number(v), currency), name === 'ingresos' ? 'Ingresos' : 'Egresos']} />
              <Bar dataKey="ingresos" fill={C.green} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {data.map((_, i) => <Cell key={i} fillOpacity={monthOpacity(i, activeMonth)} />)}
              </Bar>
              <Bar dataKey="egresos" fill={C.gold} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {data.map((_, i) => <Cell key={i} fillOpacity={monthOpacity(i, activeMonth)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Saldo final de caja" subtitle={`Al cierre de cada mes · ${series.year}`}>
        {empty ? <Empty text="Sin cajas en esta moneda." /> : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="saldo-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.blue} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={C.blue} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} width={64} tickFormatter={(v) => fmtShort(Number(v), currency)} />
              <ReferenceLine y={0} stroke={C.tick} strokeOpacity={0.5} />
              <Tooltip {...tooltipStyle} formatter={(v) => [fmtAmount(Number(v), currency), 'Saldo final']} />
              <Area type="monotone" dataKey="saldo" stroke={C.blue} strokeWidth={2.25} fill="url(#saldo-gradient)" connectNulls={false} isAnimationActive={false}
                dot={(props: { cx?: number; cy?: number; index?: number; value?: number | null }) => {
                  const { cx, cy, index = -1, value } = props
                  if (value === null || value === undefined || cx === undefined || cy === undefined) return <g key={index} />
                  const active = index === activeMonth
                  return <circle key={index} cx={cx} cy={cy} r={active ? 4.5 : 2.5} fill={active ? C.gold : C.blue} stroke="#fff" strokeWidth={active ? 1.5 : 0} />
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </>
  )
}

// ── Estado patrimonial ──────────────────────────────────────────

function Donut({ title, total, lines, currency }: { title: string; total: number; lines: StatementLine[]; currency: string }) {
  const data = lines.filter((l) => l.amount > 0)
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          {data.length === 0 ? <Empty text="Sin saldo" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip {...tooltipStyle} formatter={(v, name) => [fmtAmount(Number(v), currency), String(name)]} />
                <Pie data={data} dataKey="amount" nameKey="label" innerRadius="62%" outerRadius="88%" paddingAngle={data.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>
                  {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">{title}</span>
          <span className="font-mono text-sm font-light text-[#1F2937] num-tabular dark:text-[#E8E8E8]">{fmtShort(total, currency)}</span>
        </div>
      </div>
      <ul className="mt-2 space-y-1">
        {data.map((l, i) => (
          <li key={l.label} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="flex min-w-0 items-center gap-1.5 text-[#6B7280] dark:text-[#A3A3A3]">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
              <span className="truncate">{l.label}</span>
            </span>
            <span className="font-mono text-[#9CA3AF] num-tabular">{total > 0 ? `${((l.amount / total) * 100).toLocaleString('es-AR', { maximumFractionDigits: 0 })}%` : '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PatrimonioCharts({ series, balance, activeMonth }: { series: YearlySeries; balance: BalanceSheetData; activeMonth?: number }) {
  const data = MONTHS.map((label, i) => ({
    label,
    activos: series.patrimonio[i]?.activos ?? null,
    pasivos: series.patrimonio[i]?.pasivos ?? null,
  }))

  return (
    <>
      <ChartCard
        title="Activos vs. pasivos"
        subtitle={`Al cierre de cada mes · ${series.year}`}
        legend={[{ label: 'Activos', color: C.green }, { label: 'Pasivos', color: C.gold }]}
      >
        {!hasData(series.patrimonio) ? <Empty text="Sin datos en el año." /> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} width={64} tickFormatter={(v) => fmtShort(Number(v))} />
              <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(156,163,175,0.08)' }}
                formatter={(v, name) => [fmtAmount(Number(v), 'ARS'), name === 'activos' ? 'Activos' : 'Pasivos']} />
              <Bar dataKey="activos" fill={C.green} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {data.map((_, i) => <Cell key={i} fillOpacity={monthOpacity(i, activeMonth)} />)}
              </Bar>
              <Bar dataKey="pasivos" fill={C.gold} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {data.map((_, i) => <Cell key={i} fillOpacity={monthOpacity(i, activeMonth)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Composición del activo y del pasivo" subtitle="Situación actual">
        <div className="flex h-full gap-6">
          <Donut title="Activo" total={balance.totalAssets} lines={balance.assets} currency={balance.currency} />
          <Donut title="Pasivo" total={balance.totalLiabilities} lines={balance.liabilities} currency={balance.currency} />
        </div>
      </ChartCard>
    </>
  )
}

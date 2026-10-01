'use client'

import type { ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Cell, PieChart, Pie, ComposedChart, Line,
} from 'recharts'
import type { YearlySeries } from '@/server/reports/yearly-series'
import { fmtAmount, type ResultsData } from './shared'
import type { BalanceSheet } from '@/server/balance/balance-sheet'
import { SubtleDelta } from './modern'

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const IOS_COLORS = { green: '#34C759', blue: '#0A84FF', red: '#FF3B30', cyan: '#32ADE6' }
const MODERN_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif'
const modernAxis = { tickLine: false, axisLine: false, tick: { fontSize: 9, fill: '#8E8E93' } }
const modernTooltip = {
  contentStyle: { border: 'none', borderRadius: 12, background: 'rgba(28,28,30,0.82)', backdropFilter: 'blur(20px)', color: '#fff', fontSize: 12, padding: '8px 12px', fontFamily: MODERN_FONT, boxShadow: '0 8px 30px rgba(0,0,0,0.18)' },
  labelStyle: { color: '#8E8E93', marginBottom: 2 },
  itemStyle: { padding: 0, color: '#fff' },
  cursor: false as const,
}

/** Montos cortos para los ejes: $1,2 M · $350 k */
function fmtShort(value: number, currency = 'ARS') {
  const sym = currency === 'USD' ? 'US$' : '$'
  const abs = Math.abs(value)
  const sign = value < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
  if (abs >= 1_000) return `${sign}${sym}${Math.round(abs / 1_000).toLocaleString('es-AR')} k`
  return `${sign}${sym}${Math.round(abs).toLocaleString('es-AR')}`
}


function ChartCard({ title, subtitle, legend, children, modern = false, fluid = false }: {
  title: string
  subtitle?: string
  legend?: { label: string; color: string }[]
  children: ReactNode
  modern?: boolean
  /** Contenido en flujo normal (no un gráfico que llena el alto): la tarjeta crece con él */
  fluid?: boolean
}) {
  return (
    <div
      className={modern
        ? 'flex min-h-[260px] flex-1 flex-col rounded-2xl bg-white px-5 pb-4 pt-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.03)] dark:bg-[#1C1C1E] dark:shadow-none'
        : 'flex min-h-[280px] flex-1 flex-col border border-[#E5E7EB] bg-white p-5 dark:border-white/10 dark:bg-[#141414]'}
      style={modern ? { fontFamily: MODERN_FONT } : { boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className={modern ? 'text-[15px] font-semibold text-[#1C1C1E] dark:text-white' : 'text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]'}>{title}</p>
          {subtitle && <p className={modern ? 'text-[12px] text-[#8E8E93]' : 'mt-0.5 text-xs text-[#6B7280] dark:text-[#A3A3A3]'}>{subtitle}</p>}
        </div>
        {legend && (
          <div className="flex flex-wrap items-center gap-3">
            {legend.map((l) => (
              <span key={l.label} className={`flex items-center gap-1.5 text-[11px] ${modern ? 'text-[#8E8E93]' : 'text-[#6B7280] dark:text-[#A3A3A3]'}`}>
                <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {/* El gráfico ocupa todo el alto que le deja la tarjeta */}
      {fluid ? (
        <div className="mt-3 flex flex-1 flex-col justify-center">{children}</div>
      ) : (
        <div className="relative mt-3 min-h-0 flex-1">
          <div className="absolute inset-0">{children}</div>
        </div>
      )}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-[#9CA3AF]">{text}</div>
}



function hasData<T>(points: (T | null)[]) {
  return points.some((p) => p !== null)
}

// ── Estado de resultados ──────────────────────────────────────────

// Colores iOS para repartir los gastos (el costo de lo vendido siempre naranja)
const SPEND_COLORS = ['#FF9F0A', '#FF3B30', '#AF52DE', '#5856D6', '#FF2D55', '#A2845E', '#8E8E93']

export function ResultadosCharts({ series, results, activeMonth }: { series: YearlySeries; results: ResultsData; activeMonth?: number }) {
  const K = IOS_COLORS
  const data = MONTHS.map((label, i) => ({
    label,
    ventas: series.resultados[i]?.ventas ?? null,
    neta: series.resultados[i]?.gananciaNeta ?? null,
  }))
  const empty = !hasData(series.resultados)

  // ¿En qué se va la plata? Costo de lo vendido + cada gasto del período
  const gastos = [
    ...(results.cogs > 0 ? [{ label: 'Costo de lo vendido', amount: results.cogs }] : []),
    ...results.operatingExpenses.map((l) => ({ label: l.label, amount: l.amount })),
  ].filter((g) => g.amount > 0).sort((x, y) => y.amount - x.amount)
  // Más de 6 porciones se agrupan en "Otros"
  const porciones = gastos.length > 6
    ? [...gastos.slice(0, 5), { label: 'Otros', amount: gastos.slice(5).reduce((s, g) => s + g.amount, 0) }]
    : gastos
  const totalGastos = porciones.reduce((s, g) => s + g.amount, 0)

  return (
    <>
      <ChartCard
        modern
        title="Ventas y ganancia neta"
        subtitle={`Enero a diciembre ${series.year}`}
        legend={[{ label: 'Ventas', color: K.green }, { label: 'Ganancia neta', color: K.cyan }]}
      >
        {empty ? <Empty text="Sin ventas en el año." /> : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="rgba(120,120,128,0.14)" />
              <XAxis dataKey="label" {...modernAxis} />
              <YAxis {...modernAxis} width={56} tickFormatter={(v) => fmtShort(Number(v))} />
              <ReferenceLine y={0} stroke="rgba(120,120,128,0.3)" />
              <Tooltip {...modernTooltip} formatter={(v, name) => [fmtAmount(Number(v), 'ARS'), name === 'ventas' ? 'Ventas' : 'Ganancia neta']} />
              <Bar dataKey="ventas" fill={K.green} maxBarSize={16} radius={[8, 8, 8, 8]} isAnimationActive={false}>
                {data.map((_, i) => <Cell key={i} fillOpacity={activeMonth === undefined || activeMonth === i ? 0.55 : 0.22} />)}
              </Bar>
              <Line type="monotone" dataKey="neta" stroke={K.cyan} strokeWidth={2.5} connectNulls={false} isAnimationActive={false}
                dot={(props: { cx?: number; cy?: number; index?: number; value?: number | null }) => {
                  const { cx, cy, index = -1, value } = props
                  if (value === null || value === undefined || cx === undefined || cy === undefined) return <g key={index} />
                  const active = index === activeMonth
                  return <circle key={index} cx={cx} cy={cy} r={active ? 4.5 : 2.5} fill={value < 0 ? K.red : K.cyan} stroke="#fff" strokeWidth={active ? 1.5 : 0} />
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard modern title="¿En qué se va la plata?" subtitle="Costo de lo vendido y gastos del período">
        {porciones.length === 0 ? <Empty text="Sin gastos en el período." /> : (
          <div className="flex h-full items-center gap-5">
            {/* Dona fina con el total en el centro */}
            <div className="relative aspect-square h-full max-h-[190px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip {...modernTooltip} formatter={(v, name) => [fmtAmount(Number(v), 'ARS'), String(name)]} />
                  <Pie data={porciones} dataKey="amount" nameKey="label" innerRadius="80%" outerRadius="96%" paddingAngle={porciones.length > 1 ? 2 : 0} cornerRadius={6} stroke="none" isAnimationActive={false}>
                    {porciones.map((_, i) => <Cell key={i} fill={SPEND_COLORS[i % SPEND_COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" style={{ fontFamily: MODERN_FONT }}>
                <span className="text-[11px] text-[#8E8E93]">Total</span>
                <span className="text-[17px] font-semibold tabular-nums text-[#1C1C1E] dark:text-white">{fmtShort(totalGastos)}</span>
              </div>
            </div>
            {/* Lista al costado */}
            <ul className="min-w-0 flex-1 space-y-2" style={{ fontFamily: MODERN_FONT }}>
              {porciones.map((g, i) => (
                <li key={g.label} className="flex items-center gap-2 text-[13px]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SPEND_COLORS[i % SPEND_COLORS.length] }} />
                  <span className="min-w-0 flex-1 truncate text-[#3C3C43] dark:text-[#EBEBF5]/80">{g.label}</span>
                  <span className="tabular-nums text-[#8E8E93]">{Math.round((g.amount / totalGastos) * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </ChartCard>
    </>
  )
}

// ── Flujo de efectivo ──────────────────────────────────────────

export function FlujoCharts({ series, currency, activeMonth }: { series: YearlySeries; currency: string; activeMonth?: number }) {
  const K = IOS_COLORS
  const data = MONTHS.map((label, i) => ({
    label,
    ingresos: series.flujo[i]?.ingresos ?? null,
    egresos: series.flujo[i]?.egresos ?? null,
    saldo: series.flujo[i]?.saldoFinal ?? null,
  }))
  const empty = !hasData(series.flujo)
  const dim = (i: number) => (activeMonth === undefined || activeMonth === i ? 1 : 0.35)

  // Tocar un mes del gráfico cambia el período a ese mes (mantiene moneda y caja)
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const irAlMes = (i: number) => {
    if (!series.flujo[i]) return
    const sp = new URLSearchParams(params.toString())
    for (const k of ['day', 'weekStart', 'from', 'to']) sp.delete(k)
    sp.set('periodo', 'mensual')
    sp.set('year', String(series.year))
    sp.set('month', String(i + 1))
    router.push(`${pathname}?${sp.toString()}`, { scroll: false })
  }

  return (
    <>
      <ChartCard
        modern
        title="Entradas y salidas"
        legend={[{ label: 'Ingresos', color: K.green }, { label: 'Egresos', color: K.red }]}
      >
        {empty ? <Empty text="Sin movimientos de caja en el año." /> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
              barGap={3}
              barCategoryGap="28%"
              style={{ cursor: 'pointer' }}
              onClick={(st) => { if (st?.activeTooltipIndex != null) irAlMes(Number(st.activeTooltipIndex)) }}
            >
              <CartesianGrid vertical={false} stroke="rgba(120,120,128,0.14)" />
              <XAxis dataKey="label" {...modernAxis} />
              <YAxis {...modernAxis} width={56} tickFormatter={(v) => fmtShort(Number(v), currency)} />
              <Tooltip {...modernTooltip} formatter={(v, name) => [fmtAmount(Number(v), currency), name === 'ingresos' ? 'Ingresos' : 'Egresos']} />
              <Bar dataKey="ingresos" fill={K.green} maxBarSize={10} radius={[5, 5, 5, 5]} isAnimationActive={false}>
                {data.map((_, i) => <Cell key={i} fillOpacity={dim(i)} />)}
              </Bar>
              <Bar dataKey="egresos" fill={K.red} maxBarSize={10} radius={[5, 5, 5, 5]} isAnimationActive={false}>
                {data.map((_, i) => <Cell key={i} fillOpacity={dim(i)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard modern title="Saldo de caja">
        {empty ? <Empty text="Sin cajas en esta moneda." /> : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="saldo-ios-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={K.cyan} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={K.cyan} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(120,120,128,0.14)" />
              <XAxis dataKey="label" {...modernAxis} />
              <YAxis {...modernAxis} width={56} tickFormatter={(v) => fmtShort(Number(v), currency)} />
              <ReferenceLine y={0} stroke="rgba(120,120,128,0.3)" />
              <Tooltip {...modernTooltip} formatter={(v) => [fmtAmount(Number(v), currency), 'Saldo final']} />
              <Area type="monotone" dataKey="saldo" stroke={K.cyan} strokeWidth={2.5} fill="url(#saldo-ios-gradient)" connectNulls={false} isAnimationActive={false}
                dot={(props: { cx?: number; cy?: number; index?: number; value?: number | null }) => {
                  const { cx, cy, index = -1, value } = props
                  if (value === null || value === undefined || cx === undefined || cy === undefined) return <g key={index} />
                  const active = index === activeMonth
                  return <circle key={index} cx={cx} cy={cy} r={active ? 4.5 : 0} fill={K.cyan} stroke="#fff" strokeWidth={1.5} />
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

// Colores de la composición del activo
const ACTIVO_COLORS: Record<string, string> = { caja: '#0A84FF', creditos: '#34C759', mercaderia: '#FF9F0A', bienes: '#AF52DE' }


type BalancePointView = {
  activos: number | null; pasivos: number | null; patrimonio: number | null
  dActivos: number | null; dPasivos: number | null; dPatrimonio: number | null
}

/** Recuadro del gráfico de patrimonio: vidrio translúcido con activo, pasivo y patrimonio del
 *  mes, y a la derecha su variación contra el mes anterior (sutil, como en el cuadro) */
function BalanceTooltip({ active, label, payload, currency }: {
  active?: boolean
  label?: string | number
  payload?: readonly { payload?: BalancePointView }[]
  currency: string
}) {
  const p = payload?.[0]?.payload
  if (!active || !p || p.patrimonio === null) return null
  const filas: [string, number | null, number | null, string, boolean][] = [
    ['Activo', p.activos, p.dActivos, '#0A84FF', false],
    ['Pasivo', p.pasivos, p.dPasivos, '#FF9F0A', true],
  ]
  const variacion = (v: number | null, inverse: boolean) => (v === null ? <span /> : <SubtleDelta value={v} inverse={inverse} />)
  return (
    <div
      className="min-w-[230px] rounded-2xl border border-white/40 bg-white/70 px-3.5 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.15)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#2C2C2E]/70"
      style={{ fontFamily: MODERN_FONT }}
    >
      <p className="text-[12px] font-medium text-[#8E8E93]">{label}</p>
      <div className="mt-1.5 grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 gap-y-1">
        {filas.map(([nombre, valor, delta, color, inverse]) => (
          <div key={nombre} className="contents">
            <span className="flex items-center gap-1.5 text-[13px] text-[#3C3C43] dark:text-[#EBEBF5]/80">
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: color }} />{nombre}
            </span>
            <span className="text-right text-[13px] tabular-nums text-[#1C1C1E] dark:text-white">{valor !== null ? fmtAmount(valor, currency) : '—'}</span>
            {variacion(delta, inverse)}
          </div>
        ))}
        <span className="col-span-3 my-1 border-t border-black/[0.08] dark:border-white/10" />
        <span className="text-[13px] font-medium text-[#1C1C1E] dark:text-white">Patrimonio</span>
        <span className="text-right text-[15px] font-semibold tabular-nums text-[#0071A4] dark:text-[#64D2FF]">{fmtAmount(p.patrimonio, currency)}</span>
        {variacion(p.dPatrimonio, false)}
      </div>
    </div>
  )
}

export function PatrimonioCharts({ series, balance, currency, activeMonth }: { series: YearlySeries; balance: BalanceSheet; currency: 'ARS' | 'USD'; activeMonth?: number }) {
  const K = IOS_COLORS
  // Patrimonio neto de cada mes (en dólares con la cotización de ese mes)
  const base = MONTHS.map((label, i) => {
    const pt = series.patrimonio[i]
    if (!pt) return { label, patrimonio: null as number | null, activos: null as number | null, pasivos: null as number | null }
    const a = (v: number) => (currency === 'USD' ? (pt.rate ? v / pt.rate : null) : v)
    return { label, patrimonio: a(pt.activos - pt.pasivos), activos: a(pt.activos), pasivos: a(pt.pasivos) }
  })
  // Variación de cada ítem contra el mes anterior (en enero no hay)
  const dif = (actual: number | null, anterior: number | null | undefined) => (actual !== null && anterior != null ? actual - anterior : null)
  const data = base.map((d, i) => ({
    ...d,
    dActivos: dif(d.activos, base[i - 1]?.activos),
    dPasivos: dif(d.pasivos, base[i - 1]?.pasivos),
    dPatrimonio: dif(d.patrimonio, base[i - 1]?.patrimonio),
  }))
  const empty = !data.some((d) => d.patrimonio !== null)
  const conv = (v: number) => (currency === 'USD' ? (balance.rate ? v / balance.rate : 0) : v)

  return (
    <>
      <ChartCard modern title="Patrimonio neto">
        {empty ? <Empty text="Sin datos en el año." /> : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pn-ios-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={K.cyan} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={K.cyan} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(120,120,128,0.14)" />
              <XAxis dataKey="label" {...modernAxis} />
              <YAxis {...modernAxis} width={56} tickFormatter={(v) => fmtShort(Number(v), currency)} />
              <Tooltip cursor={{ stroke: 'rgba(120,120,128,0.35)', strokeWidth: 1 }} content={(p) => <BalanceTooltip active={p.active} label={p.label} payload={p.payload as never} currency={currency} />} />
              <Area type="monotone" dataKey="patrimonio" stroke={K.cyan} strokeWidth={2.5} fill="url(#pn-ios-gradient)" connectNulls={false} isAnimationActive={false}
                dot={(props: { cx?: number; cy?: number; index?: number; value?: number | null }) => {
                  const { cx, cy, index = -1, value } = props
                  if (value === null || value === undefined || cx === undefined || cy === undefined) return <g key={index} />
                  return <circle key={index} cx={cx} cy={cy} r={index === activeMonth ? 4.5 : 0} fill={K.cyan} stroke="#fff" strokeWidth={1.5} />
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard modern fluid title="Composición">
        {/* Una barra fina por rubro, de mayor a menor (como Tiempo en pantalla) */}
        {(() => {
          const filas = [
            ...balance.activo.map((r) => ({ label: r.label, amount: conv(r.amount), color: ACTIVO_COLORS[r.key] ?? '#8E8E93' })),
            ...balance.pasivo.map((r) => ({ label: r.label, amount: conv(r.amount), color: '#FF3B30' })),
          ].filter((f) => f.amount > 0.5).sort((x, y) => y.amount - x.amount)
          const max = Math.max(1, ...filas.map((f) => f.amount))
          return (
            <ul className="space-y-3" style={{ fontFamily: MODERN_FONT }}>
              {filas.map((f) => (
                <li key={f.label}>
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="truncate text-[#1C1C1E] dark:text-white">{f.label}</span>
                    <span className="shrink-0 tabular-nums text-[#8E8E93]">{fmtShort(f.amount, currency)}</span>
                  </div>
                  <div className="mt-1 h-[6px] rounded-full bg-black/[0.05] dark:bg-white/[0.08]">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(2, (f.amount / max) * 100)}%`, background: f.color }} />
                  </div>
                </li>
              ))}
            </ul>
          )
        })()}
      </ChartCard>
    </>
  )
}

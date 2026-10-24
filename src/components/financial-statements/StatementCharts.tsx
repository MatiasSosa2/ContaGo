'use client'

import { useState, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Cell, PieChart, Pie, ComposedChart, Line,
} from 'recharts'
import type { YearlySeries } from '@/server/reports/yearly-series'
import { fmtAmount, type ResultsData } from './shared'
import type { BalanceSheet } from '@/server/balance/balance-sheet'
import { SubtleDelta } from './modern'

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const IOS_COLORS = { green: '#34C759', blue: '#0A84FF', red: '#FF3B30', cyan: '#32ADE6', neta: '#0E7C9E' }

/** Escala de rojos según el peso: el más grande rojo oscuro, el más chico rojo clarito */
function rojoSegunPeso(i: number, n: number) {
  const oscuro = [139, 30, 30]   // #8B1E1E
  const claro = [242, 184, 176]  // #F2B8B0
  const t = n > 1 ? i / (n - 1) : 0
  const c = oscuro.map((o, k) => Math.round(o + (claro[k] - o) * t))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}
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


function ChartCard({ title, subtitle, legend, children, modern = false, fluid = false, alto }: {
  /** Alto mínimo de la tarjeta (px) */
  alto?: number
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
      style={modern ? { fontFamily: MODERN_FONT, ...(alto ? { minHeight: alto } : {}) } : { boxShadow: '0px 2px 8px rgba(0,0,0,0.04)' }}
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

/** Diferencia contra el mes anterior en millones: ▲ 0,1M (pastilla suave) */
function DeltaM({ actual, anterior }: { actual: number; anterior: number | null | undefined }) {
  if (anterior === null || anterior === undefined) return null
  const d = actual - anterior
  if (Math.abs(d) < 1) return null
  const sube = d > 0
  return (
    <span className={`rounded-md px-1.5 py-px text-[11px] font-medium tabular-nums ${sube ? 'bg-[#34C759]/[0.14] text-[#248A3D] dark:text-[#30D158]' : 'bg-[#FF3B30]/[0.12] text-[#C4271F] dark:text-[#FF6961]'}`}>
      {sube ? '▲' : '▼'} {(Math.abs(d) / 1_000_000).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M
    </span>
  )
}

type PuntoVN = {
  label: string; i: number
  ventas: number | null; bruta: number | null; neta: number | null
  /** Tramo del mes en curso (punteado) */
  ventasEnCurso: number | null; brutaEnCurso: number | null; netaEnCurso: number | null
}
type ColoresVN = { ventas: string; bruta: string; neta: string }

/** Cartelito al pasar el mouse: el mes, las ventas, la ganancia bruta y la neta, con la variación vs el mes anterior */
function TooltipVentasNeta({ active, payload, puntos, colores }: {
  active?: boolean
  payload?: readonly { payload?: PuntoVN }[]
  puntos: PuntoVN[]
  colores: ColoresVN
}) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  const prev = puntos[p.i - 1]
  const filas = ([
    ['Ventas', p.ventas ?? p.ventasEnCurso, prev ? prev.ventas ?? prev.ventasEnCurso : null, colores.ventas],
    ['Bruta', p.bruta ?? p.brutaEnCurso, prev ? prev.bruta ?? prev.brutaEnCurso : null, colores.bruta],
    ['Neta', p.neta ?? p.netaEnCurso, prev ? prev.neta ?? prev.netaEnCurso : null, colores.neta],
  ] as const).filter(([, v]) => v !== null)
  if (filas.length === 0) return null
  return (
    <div className="min-w-[170px] rounded-xl bg-white/95 px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.05] backdrop-blur dark:bg-[#2C2C2E]/95 dark:ring-white/10" style={{ fontFamily: MODERN_FONT }}>
      <p className="mb-1 text-[11px] font-medium text-[#8E8E93]">{p.label}</p>
      {filas.map(([nombre, v, anterior, color], k) => (
        <p key={nombre} className={`flex items-center justify-between gap-3 ${k > 0 ? 'mt-0.5' : ''}`}>
          <span className="flex items-baseline gap-1.5">
            <span className="w-9 text-[10px] text-[#AEAEB2]">{nombre}</span>
            <span className="text-[14px] font-semibold tabular-nums" style={{ color: v! < 0 ? IOS_COLORS.red : color }}>{v! < 0 ? '−' : ''}{fmtAmount(Math.abs(v!), 'ARS')}</span>
          </span>
          <DeltaM actual={v!} anterior={anterior} />
        </p>
      ))}
    </div>
  )
}

export function ResultadosCharts({ series, results, activeMonth }: { series: YearlySeries; results: ResultsData; activeMonth?: number }) {
  const K = IOS_COLORS
  // Ganancia bruta en un azul más oscuro que la neta (como en el cuadro)
  const COLORES: ColoresVN = { ventas: '#30A35A', bruta: '#1E5E8A', neta: K.neta }
  // Mes en curso (si el año es el actual y tiene datos): va punteado, porque todavía no cerró
  const hoy = new Date()
  const mesEnCurso = series.year === hoy.getFullYear() && series.resultados[hoy.getMonth()] ? hoy.getMonth() : -1
  // Si el mes en curso todavía no tiene ventas, no se dibuja (la línea no cae a $0)
  const sinMovimientoAun = mesEnCurso >= 0 && !(series.resultados[mesEnCurso]?.ventas)
  const data: PuntoVN[] = MONTHS.map((label, i) => {
    const r = i === mesEnCurso && sinMovimientoAun ? null : series.resultados[i]
    const enCurso = i === mesEnCurso
    // El tramo punteado une el último mes cerrado con el mes en curso
    const tramo = i === mesEnCurso || i === mesEnCurso - 1
    return {
      label, i,
      ventas: !enCurso ? r?.ventas ?? null : null,
      bruta: !enCurso ? r?.gananciaBruta ?? null : null,
      neta: !enCurso ? r?.gananciaNeta ?? null : null,
      ventasEnCurso: tramo ? r?.ventas ?? null : null,
      brutaEnCurso: tramo ? r?.gananciaBruta ?? null : null,
      netaEnCurso: tramo ? r?.gananciaNeta ?? null : null,
    }
  })
  const empty = !hasData(series.resultados)
  const punto = (color: string) => function Punto(props: { cx?: number; cy?: number; index?: number; value?: number | null }) {
    const { cx, cy, index = -1, value } = props
    if (value === null || value === undefined || cx === undefined || cy === undefined) return <g key={index} />
    const activo = index === activeMonth
    return <circle key={index} cx={cx} cy={cy} r={activo ? 4 : 2.5} fill={value < 0 ? K.red : color} stroke="#fff" strokeWidth={activo ? 1.5 : 0} />
  }

  // Costos y gastos: costo de lo vendido + cada gasto del período
  const gastos = [
    ...(results.cogs > 0 ? [{ label: 'Costo de lo vendido', amount: results.cogs }] : []),
    ...results.operatingExpenses.map((l) => ({ label: l.label, amount: l.amount })),
  ].filter((g) => g.amount > 0).sort((x, y) => y.amount - x.amount)
  // Más de 6 porciones se agrupan en "Otros"
  const porciones = gastos.length > 6
    ? [...gastos.slice(0, 5), { label: 'Otros', amount: gastos.slice(5).reduce((s, g) => s + g.amount, 0) }]
    : gastos
  const totalGastos = porciones.reduce((s, g) => s + g.amount, 0)
  // Gasto resaltado al pasar el mouse (por la dona o por la lista)
  const [resaltado, setResaltado] = useState<number | null>(null)
  const elegido = resaltado !== null ? porciones[resaltado] : null

  return (
    <>
      <ChartCard
        modern
        alto={300}
        title="Ventas y ganancias"
        legend={[{ label: 'Ventas', color: COLORES.ventas }, { label: 'Ganancia bruta', color: COLORES.bruta }, { label: 'Ganancia neta', color: COLORES.neta }]}
      >
        {empty ? <Empty text="Sin ventas en el año." /> : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(120,120,128,0.12)" />
              <XAxis dataKey="label" {...modernAxis} />
              <YAxis {...modernAxis} width={56} tickFormatter={(v) => fmtShort(Number(v))} />
              <ReferenceLine y={0} stroke="rgba(120,120,128,0.3)" />
              <Tooltip cursor={{ stroke: 'rgba(120,120,128,0.25)', strokeDasharray: '3 3' }} content={(p) => <TooltipVentasNeta active={p.active} payload={p.payload as never} puntos={data} colores={COLORES} />} />
              <Line type="linear" dataKey="ventas" stroke={COLORES.ventas} strokeWidth={2} connectNulls={false} isAnimationActive={false} dot={punto(COLORES.ventas)} activeDot={{ r: 4, fill: COLORES.ventas, stroke: '#fff', strokeWidth: 1.5 }} />
              <Line type="linear" dataKey="bruta" stroke={COLORES.bruta} strokeWidth={2} connectNulls={false} isAnimationActive={false} dot={punto(COLORES.bruta)} activeDot={{ r: 4, fill: COLORES.bruta, stroke: '#fff', strokeWidth: 1.5 }} />
              <Line type="linear" dataKey="neta" stroke={COLORES.neta} strokeWidth={2} connectNulls={false} isAnimationActive={false} dot={punto(COLORES.neta)} activeDot={{ r: 4, fill: COLORES.neta, stroke: '#fff', strokeWidth: 1.5 }} />
              {/* Mes en curso: punteado */}
              <Line type="linear" dataKey="ventasEnCurso" stroke={COLORES.ventas} strokeWidth={2} strokeDasharray="4 4" connectNulls={false} isAnimationActive={false} dot={false} activeDot={false} legendType="none" />
              <Line type="linear" dataKey="brutaEnCurso" stroke={COLORES.bruta} strokeWidth={2} strokeDasharray="4 4" connectNulls={false} isAnimationActive={false} dot={false} activeDot={false} legendType="none" />
              <Line type="linear" dataKey="netaEnCurso" stroke={COLORES.neta} strokeWidth={2} strokeDasharray="4 4" connectNulls={false} isAnimationActive={false} dot={false} activeDot={false} legendType="none" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard modern alto={280} title="Costos y gastos">
        {porciones.length === 0 ? <Empty text="Sin gastos en el período." /> : (
          <div className="flex h-full items-center gap-5">
            {/* Dona fina con el total en el centro */}
            <div className="relative aspect-square h-full max-h-[220px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={porciones} dataKey="amount" nameKey="label" innerRadius="80%" outerRadius="96%"
                    paddingAngle={porciones.length > 1 ? 2 : 0} cornerRadius={6} stroke="none" isAnimationActive={false}
                    onMouseEnter={(_, i) => setResaltado(i)} onMouseLeave={() => setResaltado(null)}
                  >
                    {porciones.map((_, i) => (
                      <Cell key={i} fill={rojoSegunPeso(i, porciones.length)} fillOpacity={resaltado === null || resaltado === i ? 1 : 0.3} style={{ transition: 'fill-opacity 150ms', cursor: 'pointer' }} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" style={{ fontFamily: MODERN_FONT }}>
                {/* En el centro: el total, o el gasto resaltado */}
                <span className="max-w-[70%] truncate text-[11px] text-[#8E8E93]">{elegido ? elegido.label : 'Total'}</span>
                <span className="text-[17px] font-semibold tabular-nums text-[#1C1C1E] dark:text-white">{fmtShort(elegido ? elegido.amount : totalGastos)}</span>
                {elegido && <span className="text-[11px] tabular-nums text-[#8E8E93]">{Math.round((elegido.amount / totalGastos) * 100)}%</span>}
              </div>
            </div>
            {/* Lista al costado */}
            <ul className="min-w-0 flex-1 space-y-2" style={{ fontFamily: MODERN_FONT }}>
              {porciones.map((g, i) => (
                <li
                  key={g.label}
                  onMouseEnter={() => setResaltado(i)} onMouseLeave={() => setResaltado(null)}
                  className={`flex cursor-default items-center gap-2 text-[13px] transition-opacity ${resaltado === null || resaltado === i ? '' : 'opacity-40'}`}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: rojoSegunPeso(i, porciones.length) }} />
                  <span className="min-w-0 flex-1 truncate text-[#3C3C43] dark:text-[#EBEBF5]/80">{g.label}</span>
                  <span className="tabular-nums text-[#1C1C1E] dark:text-white">{fmtShort(g.amount)}</span>
                  <span className="w-9 text-right text-[12px] tabular-nums text-[#AEAEB2]">{Math.round((g.amount / totalGastos) * 100)}%</span>
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

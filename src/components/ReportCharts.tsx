'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart, ReferenceLine,
} from 'recharts'

const MILITARY = '#3A4D39'
const MILITARY_DARK = '#2A3D29'
const MILITARY_LIGHT = '#EBF0EA'
const GOLD = '#C5A065'
const GRAY_MID = '#9ca3af'

// ─── Tooltip personalizado ────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, symbol = '$' }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 px-4 py-3 text-white rounded-xl shadow-xl">
      <p className="text-xs font-medium text-gray-400 mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-xs font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.fill || p.stroke }} />
          <span className="text-gray-300">{p.name}:</span>
          <span className="font-light font-mono ml-auto pl-4">{symbol}{Number(p.value).toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
        </p>
      ))}
    </div>
  )
}

// ─── Gráfico de barras mensuales ──────────────────────────────────────────────
interface MonthData { month: string; income: number; expense: number; label: string }

export function MonthlyBarChart({ data, symbol = '$' }: { data: MonthData[]; symbol?: string }) {
  if (!data.length) return <EmptyState />
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 4 }} barCategoryGap="44%">
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fontWeight: 500, fill: '#a1a1aa' }}
          axisLine={false} tickLine={false}
        />
        <YAxis
          hide
          axisLine={false} tickLine={false}
          tickFormatter={(v) => `${symbol}${(v / 1000).toFixed(0)}k`}
          width={52}
        />
        <Tooltip content={<CustomTooltip symbol={symbol} />} cursor={{ fill: '#f9fafb' }} />
        <Bar dataKey="income" name="Ingresos" fill={MILITARY} radius={[8, 8, 0, 0]} barSize={14} />
        <Bar dataKey="expense" name="Gastos" fill="#9ca3af" radius={[8, 8, 0, 0]} barSize={14} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Gráfico de área (evolución balance) ─────────────────────────────────────
export function BalanceAreaChart({ data, symbol = '$' }: { data: MonthData[]; symbol?: string }) {
  const balanceData = data.map(d => ({ ...d, balance: d.income - d.expense }))
  if (!data.length) return <EmptyState />
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={balanceData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={MILITARY} stopOpacity={0.15} />
            <stop offset="100%" stopColor={MILITARY} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 500, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
        <YAxis hide axisLine={false} tickLine={false}
          tickFormatter={(v) => `${symbol}${(v / 1000).toFixed(0)}k`} width={52} />
        <Tooltip content={<CustomTooltip symbol={symbol} />} cursor={{ stroke: MILITARY, strokeWidth: 1, strokeDasharray: '4 2' }} />
        <Area type="monotone" dataKey="balance" name="Balance" stroke={MILITARY} strokeWidth={2} fill="url(#balGrad)" dot={false} activeDot={{ r: 4, fill: MILITARY }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Gráfico de área dual — Flujo de Fondos Hero ───────────────────────────────
export function CashFlowAreaChart({ data, symbol = '$' }: { data: MonthData[]; symbol?: string }) {
  if (!data.length) return <EmptyState />
  const maxIncome = Math.max(...data.map(d => d.income))
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 16, right: 12, left: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="cashIncomeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={MILITARY} stopOpacity={0.15} />
            <stop offset="100%" stopColor={MILITARY} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="cashExpenseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6b7280" stopOpacity={0.08} />
            <stop offset="100%" stopColor="#6b7280" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fontWeight: 500, fill: '#a1a1aa' }}
          axisLine={false} tickLine={false}
        />
        <YAxis
          hide
          axisLine={false} tickLine={false}
          tickFormatter={(v) => `${symbol}${(v / 1000).toFixed(0)}k`}
          width={52}
        />
        <Tooltip content={<CustomTooltip symbol={symbol} />} cursor={{ stroke: MILITARY, strokeWidth: 1, strokeDasharray: '4 2' }} />
        {/* Gastos por debajo — fondo más tenue */}
        <Area
          type="monotone"
          dataKey="expense"
          name="Gastos"
          stroke="#d1d5db"
          strokeWidth={1.5}
          fill="url(#cashExpenseGrad)"
          dot={false}
          activeDot={{ r: 4, fill: GRAY_MID, strokeWidth: 0 }}
        />
        {/* Ingresos por encima — protagonista */}
        <Area
          type="monotone"
          dataKey="income"
          name="Ingresos"
          stroke={MILITARY}
          strokeWidth={2}
          fill="url(#cashIncomeGrad)"
          dot={(props: any) => {
            const isMax = props.payload?.income === maxIncome
            if (!isMax) return <circle key={`dot-${props.index}`} cx={props.cx} cy={props.cy} r={2.5} fill={MILITARY} stroke="none" />
            return (
              <g key={`max-${props.index}`}>
                <circle cx={props.cx} cy={props.cy} r={7} fill={GOLD} stroke="white" strokeWidth={2} />
                <circle cx={props.cx} cy={props.cy} r={2.5} fill="white" />
              </g>
            )
          }}
          activeDot={{ r: 5, fill: MILITARY, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Stacked Area Chart — Dashboard hero (Ingresos vs Egresos apilados) ───────
interface StackedMonth { label: string; ingresos: number; egresos: number }
export function StackedAreaChart({ data, symbol = '$' }: { data: StackedMonth[]; symbol?: string }) {
  if (!data.length) return <EmptyState />
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="stackIncomeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2D6A4F" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#2D6A4F" stopOpacity={0.04} />
          </linearGradient>
          <linearGradient id="stackExpenseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#374151" stopOpacity={0.20} />
            <stop offset="95%" stopColor="#374151" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fontWeight: 500, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const ing = payload.find((p: any) => p.dataKey === 'ingresos')?.value as number || 0
            const eg = payload.find((p: any) => p.dataKey === 'egresos')?.value as number || 0
            return (
              <div className="bg-gray-900 px-4 py-3 text-white rounded-xl shadow-xl min-w-[160px]">
                <p className="text-xs text-gray-400 mb-2 font-medium">{label}</p>
                <p className="text-xs flex justify-between gap-4">
                  <span className="text-emerald-300">Ingresos</span>
                  <span className="font-mono font-light">{symbol}{ing.toLocaleString('es-AR')}</span>
                </p>
                <p className="text-xs flex justify-between gap-4">
                  <span className="text-gray-300">Egresos</span>
                  <span className="font-mono font-light">{symbol}{eg.toLocaleString('es-AR')}</span>
                </p>
                <div className="mt-2 pt-2 border-t border-white/10 text-xs flex justify-between gap-4">
                  <span className="text-gray-400">Neto</span>
                  <span className={`font-mono font-light ${ing - eg >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {ing - eg >= 0 ? '+' : ''}{symbol}{Math.abs(ing - eg).toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
            )
          }}
          cursor={{ stroke: '#2D6A4F', strokeWidth: 1, strokeDasharray: '4 2' }}
        />
        <Area type="monotone" dataKey="egresos" name="Egresos" stroke="#6b7280" strokeWidth={1.5} fill="url(#stackExpenseGrad)" dot={false} activeDot={{ r: 4, fill: '#6b7280', strokeWidth: 0 }} />
        <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#2D6A4F" strokeWidth={2} fill="url(#stackIncomeGrad)" dot={false} activeDot={{ r: 5, fill: '#2D6A4F', strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Donuts ───────────────────────────────────────────────────────────────────
interface PieSlice { name: string; value: number; color: string }

export function DonutChart({ slices, symbol = '$', centerLabel = '' }: { slices: PieSlice[]; symbol?: string; centerLabel?: string }) {
  if (!slices.length || slices.every(s => s.value === 0)) return <EmptyState />
  const total = slices.reduce((a, s) => a + s.value, 0)
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={slices}
            cx="50%"
            cy="50%"
            innerRadius={72}
            outerRadius={86}
            paddingAngle={2}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
          >
            {slices.map((s, i) => <Cell key={i} fill={s.color} stroke="none" />)}
          </Pie>
          <Tooltip
            formatter={(val: number | string | ReadonlyArray<number | string> | undefined) => {
              const rawValue = Array.isArray(val) ? val[0] : val
              return [`${symbol}${Number(rawValue ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`, '']
            }}
            contentStyle={{ background: '#111827', border: '1px solid #374151', color: '#fff', fontSize: 11, fontWeight: 700 }}
            itemStyle={{ color: '#fff' }}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Centro */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <p className="text-xs font-medium text-gray-400">{centerLabel}</p>
        <p className="text-base font-light font-mono text-[#1A1A1A] leading-tight">{symbol}{total.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</p>
      </div>
    </div>
  )
}

// ─── Barras horizontales (categorías / contactos) ─────────────────────────────
interface HBarItem { name: string; income: number; expense: number }

export function HorizontalBars({ items, max, symbol = '$' }: { items: HBarItem[]; max: number; symbol?: string }) {
  if (!items.length) return <EmptyState />
  return (
    <div className="flex flex-col gap-1 bg-gray-50/50 p-1 rounded-2xl">
      {items.map(item => {
        const incPct = max > 0 ? (item.income / max) * 100 : 0
        const expPct = max > 0 ? (item.expense / max) * 100 : 0
        return (
          <div key={item.name} className="px-5 py-3 rounded-xl bg-white hover:bg-gray-50 transition-colors">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-sm font-medium text-gray-700 truncate max-w-[140px]">{item.name}</span>
              <span className="text-xs font-light text-gray-400 font-mono">
                {item.income > 0 && <span className="text-brand-military-dark mr-2">{symbol}{item.income.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>}
                {item.expense > 0 && <span className="text-gray-500">{symbol}{item.expense.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>}
              </span>
            </div>
            <div className="space-y-1">
              {item.income > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-brand-military shrink-0" />
                  <div className="flex-1 bg-gray-100 h-2 rounded-full">
                    <div className="h-2 bg-brand-military rounded-full transition-all" style={{ width: `${incPct}%` }} />
                  </div>
                </div>
              )}
              {item.expense > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gray-500 shrink-0" />
                  <div className="flex-1 bg-gray-100 h-2 rounded-full">
                    <div className="h-2 bg-gray-500 rounded-full transition-all" style={{ width: `${expPct}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Mini sparkline — Area con gradiente premium ────────────────────────────────
export function Sparkline({ data, color = MILITARY }: { data: number[]; color?: string }) {
  const d = data.map((v, i) => ({ i, v }))
  const id = `spark-${color.replace('#', '')}`
  return (
    <ResponsiveContainer width="100%" height={44}>
      <AreaChart data={d} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${id})`}
          dot={false}
          activeDot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Estado vacío ─────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex items-center justify-center h-32 text-sm font-medium text-gray-400">
      Sin datos
    </div>
  )
}

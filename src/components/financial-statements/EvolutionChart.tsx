'use client'

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'
import { fmtAmount } from './shared'

type MonthlyPoint = { label: string; net: number }

export default function EvolutionChart({ points }: { points: MonthlyPoint[] }) {
  if (points.length === 0) {
    return (
      <div className="flex h-[360px] items-center justify-center border border-dashed border-[#D1D5DB] text-sm text-[#9CA3AF] dark:border-white/10">
        No hay datos suficientes para mostrar la evolución mensual.
      </div>
    )
  }

  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="evolution-detail-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3F5F76" stopOpacity={0.38} />
              <stop offset="100%" stopColor="#3F5F76" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} tickFormatter={(value) => fmtAmount(Number(value), 'ARS')} />
          <Tooltip
            cursor={{ stroke: '#3F5F76', strokeWidth: 1, strokeDasharray: '3 3' }}
            contentStyle={{ border: '1px solid #E5E7EB', background: '#111827', color: '#F9FAFB', fontSize: 11 }}
            formatter={(value) => [fmtAmount(Number(value), 'ARS', true), 'Neto']}
          />
          <Area type="monotone" dataKey="net" stroke="#3F5F76" strokeWidth={2.5} fill="url(#evolution-detail-gradient)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

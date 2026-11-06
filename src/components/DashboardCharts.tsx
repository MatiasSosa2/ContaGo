'use client'

import dynamic from 'next/dynamic'
import type { EChartsOption } from 'echarts'
import { useState, useEffect, useMemo } from 'react'
import CashEvolutionChart from '@/components/dashboard/CashEvolutionChart'
import type { DashboardChartTx } from '@/app/actions.database'

// ── Hook de detección de tema ──────────────────────────────────────────────────
function useDarkMode() {
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const read = () => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
    read()
    const obs = new MutationObserver(read)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return isDark
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtARS(v: number) {
  return '$' + v.toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. KPI SPARKLINE — Mini line/area chart sin ejes, solo tendencia
// ─────────────────────────────────────────────────────────────────────────────
interface DonutSlice {
  name: string
  value: number
  itemStyle: { color: string }
}

// Hasta 5 categorías con nombre; el resto se suma en "Otras"
const MAX_SLICES = 5

/**
 * Dona fina en SVG con el total en el centro y, al lado, la lista de categorías con barrita y %.
 * Al pasar el mouse por una porción o una fila se resalta y el centro muestra esa categoría.
 */
export function DonutWithLegend({ data, height = 280 }: { data: DonutSlice[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  // Las porciones se dibujan al montar (animación de llenado)
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const sorted = [...data].sort((x, y) => y.value - x.value)
  const slices = sorted.length > MAX_SLICES + 1
    ? [
        ...sorted.slice(0, MAX_SLICES),
        {
          name: 'Otras',
          value: sorted.slice(MAX_SLICES).reduce((acc, d) => acc + d.value, 0),
          itemStyle: { color: sorted[sorted.length - 1].itemStyle.color },
        },
      ]
    : sorted
  const total = slices.reduce((acc, d) => acc + d.value, 0)
  const max = Math.max(...slices.map((d) => d.value), 1)

  const SIZE = Math.min(200, height - 40)
  const STROKE = 14
  const R = (SIZE - STROKE) / 2
  const CIRC = 2 * Math.PI * R
  const GAP = slices.length > 1 ? 3 : 0
  // Largo de cada porción y dónde empieza (suma de las anteriores)
  const largos = slices.map((d) => (total > 0 ? (d.value / total) * CIRC : 0))
  const arcos = largos.map((largo, i) => ({
    largo: Math.max(0, largo - GAP),
    offset: largos.slice(0, i).reduce((acc, l) => acc + l, 0),
  }))

  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })
  const centro = hover !== null ? slices[hover] : null

  return (
    <div className="flex flex-col items-center gap-6 py-2 sm:flex-row sm:items-center sm:gap-10 sm:px-4" style={{ minHeight: height }}>
      {/* Dona */}
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" strokeWidth={STROKE} className="stroke-black/[0.04] dark:stroke-white/[0.06]" />
          {slices.map((d, i) => (
            <circle
              key={d.name}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke={d.itemStyle.color}
              strokeWidth={hover === i ? STROKE + 4 : STROKE}
              strokeLinecap="butt"
              strokeDasharray={`${drawn ? arcos[i].largo : 0} ${CIRC}`}
              strokeDashoffset={-arcos[i].offset}
              opacity={hover === null || hover === i ? 1 : 0.35}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.32,0.72,0,1), opacity 150ms, stroke-width 150ms', cursor: 'default' }}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="max-w-[120px] truncate text-[11px] font-medium text-[#8E8E93]">{centro ? centro.name : 'Total'}</p>
          <p className="text-[19px] font-semibold tracking-[-0.03em] tabular-nums text-[#1C1C1E] dark:text-white">
            {fmtARS(centro ? centro.value : total)}
          </p>
          {centro && <p className="text-[11px] tabular-nums text-[#8E8E93]">{pct(centro.value)}%</p>}
        </div>
      </div>

      {/* Lista de categorías con barrita y % */}
      <ul className="w-full min-w-0 flex-1 space-y-2.5">
        {slices.map((d, i) => (
          <li
            key={d.name}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className={`transition-opacity ${hover === null || hover === i ? 'opacity-100' : 'opacity-45'}`}
          >
            <div className="flex items-baseline gap-2 text-[13px]">
              <span className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-full" style={{ background: d.itemStyle.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[#1C1C1E] dark:text-white">{d.name}</span>
              <span className="shrink-0 text-[12px] tabular-nums text-[#8E8E93]">{pct(d.value)}%</span>
              <span className="w-[104px] shrink-0 text-right font-medium tabular-nums text-[#1C1C1E] dark:text-white">{fmtARS(d.value)}</span>
            </div>
            <div className="ml-4 mt-1 h-1 overflow-hidden rounded-full bg-black/[0.04] dark:bg-white/[0.06]">
              <div
                className="h-full rounded-full"
                style={{ width: drawn ? `${(d.value / max) * 100}%` : '0%', background: d.itemStyle.color, transition: 'width 700ms cubic-bezier(0.32,0.72,0,1)' }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4b. DONUT 3D — Rentabilidad (Egresos vs Ganancia)
// ─────────────────────────────────────────────────────────────────────────────
type EvView = 'overview' | 'income_cats' | 'expense_cats' | 'net'

interface EvolutionTabsProps {
  chartData: { label: string; income: number; expense: number; net: number; txIdx: number[] }[]
  chartTx: DashboardChartTx[]
  categoryBreakdown: { name: string; value: number; color: string }[]
  incomeCategoryBreakdown: { name: string; value: number; color: string }[]
}

function EmptyChart({ message = 'Sin datos históricos aún' }: { message?: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center">
      <p className="text-sm text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)]">{message}</p>
    </div>
  )
}

// ECharts pesa bastante y solo hace falta al abrir una vista por categorías.
const ReactECharts = dynamic(() => import('echarts-for-react'), {
  ssr: false,
  loading: () => <div className="h-[280px] animate-pulse rounded-xl bg-black/[0.03] dark:bg-white/[0.04]" />,
})

export function EvolutionTabs({ chartData, chartTx, categoryBreakdown, incomeCategoryBreakdown }: EvolutionTabsProps) {
  const [view, setView] = useState<EvView>('overview')
  const isDark = useDarkMode()

  const TABS: { key: EvView; label: string }[] = [
    { key: 'overview', label: 'Resumen' },
    { key: 'income_cats', label: 'Ingresos' },
    { key: 'expense_cats', label: 'Egresos' },
  ]

  const hasData = chartData.some(d => d.income > 0 || d.expense > 0)

  const netOption: EChartsOption = useMemo(() => {
    const axisColor = isDark ? '#2a2a2a' : '#d1d5db'
    const labelColor = isDark ? '#6b7280' : '#9ca3af'
    return {
      animation: true,
      backgroundColor: 'transparent',
      grid: { top: 12, bottom: 36, left: 16, right: 16, containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1A1A1A',
        borderColor: '#374151',
        borderWidth: 1,
        textStyle: { color: '#fff', fontSize: 11 },
        formatter: (params: unknown) => {
          const p = (params as { value?: number; axisValue?: string }[])[0]
          const val = Number(p?.value ?? 0)
          return `<div style="font-weight:600;color:#9ca3af;margin-bottom:4px;">${p?.axisValue ?? ''}</div><div style="font-family:monospace;">${val >= 0 ? '' : '-'}${fmtARS(Math.abs(val))}</div>`
        },
      },
      xAxis: {
        type: 'category',
        data: chartData.map(d => d.label),
        axisLine: { lineStyle: { color: axisColor } },
        axisTick: { show: false },
        axisLabel: { color: labelColor, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: axisColor, type: 'dashed' } },
        axisLabel: {
          color: labelColor,
          fontSize: 10,
          formatter: (v: number) => {
            const abs = Math.abs(v)
            if (abs >= 1_000_000) return `${v < 0 ? '−' : ''}$${(abs / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
            return `${v < 0 ? '−' : ''}$${Math.round(abs).toLocaleString('es-AR')}`
          },
        },
      },
      series: [{
        name: 'Ganancia',
        type: 'line',
        data: chartData.map(d => d.net),
        smooth: true,
        showSymbol: true,
        symbolSize: 5,
        lineStyle: { color: '#5B9A78', width: 2 },
        itemStyle: { color: '#5B9A78' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#23534740' },
              { offset: 1, color: '#23534700' },
            ],
          },
        },
      }],
    }
  }, [chartData, isDark])

  // Tonos de salvia para ingresos (de mayor a menor)
  const GREEN_PALETTE = ['#2F6B4F', '#4F8A6B', '#6FA287', '#93BBA4', '#B7D2C2', '#D2E3D8']
  const incomeSorted = [...incomeCategoryBreakdown].sort((a, b) => b.value - a.value)
  const incomeDonutData = incomeSorted.map((c, i) => ({
    name: c.name,
    value: c.value,
    itemStyle: { color: GREEN_PALETTE[i % GREEN_PALETTE.length] },
  }))

  // Tonos de terracota para egresos (de mayor a menor)
  const RED_PALETTE = ['#8E4535', '#B8664F', '#CB8670', '#DBA693', '#E8C5B8', '#F1DCD3']
  const expenseSorted = [...categoryBreakdown].sort((a, b) => b.value - a.value)
  const expenseDonutData = expenseSorted.map((c, i) => ({
    name: c.name,
    value: c.value,
    itemStyle: { color: RED_PALETTE[i % RED_PALETTE.length] },
  }))

  // Selector como texto con subrayado (Resumen · Ingresos · Egresos)
  const selector = (
    <div className="flex items-center gap-4" role="tablist" aria-label="Ver gráfico">
      {TABS.map(tab => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={view === tab.key}
          onClick={() => setView(tab.key)}
          className={`relative pb-1.5 text-[13px] transition-colors ${
            view === tab.key
              ? 'font-semibold text-[#1C1C1E] dark:text-white'
              : 'text-[#8E8E93] hover:text-[#3C3C43] dark:hover:text-[#EBEBF5]'
          }`}
        >
          {tab.label}
          {/* Subrayado propio (los estilos globales anulan los bordes de las pestañas) */}
          <span
            aria-hidden
            className={`absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[#1C1C1E] transition-opacity dark:bg-white ${view === tab.key ? 'opacity-100' : 'opacity-0'}`}
          />
        </button>
      ))}
    </div>
  )

  return (
    <div className="px-5 pb-4 pt-4">
      {view === 'overview' && <CashEvolutionChart chartData={chartData} chartTx={chartTx} height={300} header={selector} />}
      {view !== 'overview' && <div className="mb-3">{selector}</div>}
      {/* Vistas por categoría */}
      <div>
        {view === 'income_cats' && (
          incomeDonutData.length > 0
            ? <DonutWithLegend data={incomeDonutData} height={280} />
            : <EmptyChart message="Sin ingresos categorizados" />
        )}
        {view === 'expense_cats' && (
          expenseDonutData.length > 0
            ? <DonutWithLegend data={expenseDonutData} height={280} />
            : <EmptyChart message="Sin egresos categorizados" />
        )}
        {view === 'net' && (
          hasData
            ? <ReactECharts option={netOption} style={{ height: 280, width: '100%' }} opts={{ renderer: 'svg' }} />
            : <EmptyChart />
        )}
      </div>
    </div>
  )
}

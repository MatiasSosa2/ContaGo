'use client'

import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { useState, useEffect, useMemo, useRef } from 'react'
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

// ── Paleta del sistema ─────────────────────────────────────────────────────────
const C = {
  income:     '#2D6A4F',
  incomeFill: 'rgba(45,106,79,0.15)',
  expense:    '#6b7280',
  expenseFill:'rgba(107,114,128,0.10)',
  net:        '#C5A065',
  netFill:    'rgba(197,160,101,0.12)',
  red:        '#EF4444',
  amber:      '#F59E0B',
  green:      '#10B981',
  axis:       '#d1d5db',
  label:      '#9ca3af',
  tooltip:    '#1A1A1A',
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

export function DonutWithLegend({ data, height = 280 }: { data: DonutSlice[]; height?: number }) {
  const isDark = useDarkMode()
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(600)

  useEffect(() => {
    if (!containerRef.current) return
    const measure = () => {
      if (containerRef.current)
        setContainerWidth(containerRef.current.getBoundingClientRect().width)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const total = data.reduce((s, d) => s + d.value, 0)
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const n = sorted.length

  // ── Layout ────────────────────────────────────────────────────────────────
  const DONUT_RATIO = 0.42
  const donutW = containerWidth * DONUT_RATIO
  const outerR = 0.66 * Math.min(donutW, height) / 2
  const cx = donutW / 2
  const cy = height / 2
  const ELBOW_X = donutW + 14   // X donde el trazo dobla horizontal
  const LABEL_X = donutW + 48   // X donde empieza el texto (todos alineados)

  // Labels: distribuidos uniformemente de arriba a abajo (valor-ordenados)
  const V_PAD = height * 0.10
  const labelSpacing = n > 1 ? (height - V_PAD * 2) / (n - 1) : 0
  const labelY = (i: number) => (n === 1 ? cy : V_PAD + i * labelSpacing)

  // Puntos distribuidos en el arco DERECHO (90° → −90° clockwise).
  // Ambas secuencias son monótonas en Y → líneas nunca se cruzan.
  const arcPoint = (i: number) => {
    const angle = n === 1 ? 0 : Math.PI / 2 - (i * Math.PI) / (n - 1)
    return { x: cx + outerR * Math.cos(angle), y: cy - outerR * Math.sin(angle) }
  }

  const centerTextColor = isDark ? '#f3f4f6' : '#1f2937'

  const option: EChartsOption = {
    animation: true,
    tooltip: {
      trigger: 'item',
      backgroundColor: C.tooltip,
      borderColor: '#374151',
      textStyle: { color: '#fff', fontSize: 11 },
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent?: number }
        const pct = p.percent?.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) ?? '0'
        return `<div style="font-weight:600;margin-bottom:4px;">${p.name}</div>
          <div style="font-family:monospace;">${fmtARS(p.value)}<span style="color:#9ca3af;margin-left:8px;">${pct}%</span></div>`
      },
    },
    legend: { show: false },
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '46%',
        style: {
          text: fmtARS(total),
          fill: centerTextColor,
          fontSize: 13,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontWeight: 700,
          align: 'center',
        },
      },
    ],
    series: [{
      type: 'pie',
      radius: ['44%', '68%'],
      center: ['50%', '50%'],
      padAngle: 2,
      itemStyle: { borderRadius: 4 },
      label: { show: false },
      labelLine: { show: false },
      data: sorted,
      emphasis: {
        scale: true,
        scaleSize: 4,
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.15)' },
      },
    }],
  }

  const mutedText = isDark ? '#9ca3af' : '#6b7280'

  return (
    <div ref={containerRef} style={{ position: 'relative', height, width: '100%' }}>
      {/* Donut — zona izquierda */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: `${DONUT_RATIO * 100}%`, height }}>
        <ReactECharts option={option} style={{ height, width: '100%' }} opts={{ renderer: 'svg' }} />
      </div>

      {/* SVG: líneas rectas con punta de flecha */}
      {containerWidth > 0 && (
        <svg
          style={{
            position: 'absolute', left: 0, top: 0,
            width: containerWidth, height,
            pointerEvents: 'none', overflow: 'visible',
          }}
        >
          <defs>
            {sorted.map((item, i) => (
              <marker
                key={i}
                id={`arr-${i}`}
                markerWidth="5"
                markerHeight="5"
                refX="4"
                refY="2.5"
                orient="auto"
              >
                <polygon points="0,0 5,2.5 0,5" fill={item.itemStyle.color} opacity={0.65} />
              </marker>
            ))}
          </defs>

          {sorted.map((item, i) => {
            const { x: ax, y: ay } = arcPoint(i)
            const ly = labelY(i)
            const color = item.itemStyle.color
            return (
              <path
                key={item.name}
                d={`M ${ax.toFixed(1)} ${ay.toFixed(1)} L ${ELBOW_X.toFixed(1)} ${ly.toFixed(1)} L ${(LABEL_X - 8).toFixed(1)} ${ly.toFixed(1)}`}
                fill="none"
                stroke={color}
                strokeWidth={1.2}
                strokeOpacity={0.6}
                strokeLinejoin="round"
                markerEnd={`url(#arr-${i})`}
              />
            )
          })}
        </svg>
      )}

      {/* Labels */}
      {sorted.map((item, i) => {
        const ly = labelY(i)
        const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0'
        const mainText = isDark ? '#e5e7eb' : '#374151'
        return (
          <div
            key={item.name}
            style={{
              position: 'absolute',
              left: LABEL_X,
              top: ly,
              right: 4,
              transform: 'translateY(-50%)',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {/* Fila 1: nombre + badge % */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
              <span style={{
                color: mainText,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {item.name}
              </span>
              <span style={{
                flexShrink: 0,
                background: item.itemStyle.color + '28',
                color: item.itemStyle.color,
                fontSize: 9,
                fontWeight: 700,
                padding: '1px 4px',
                borderRadius: 4,
                fontFamily: 'ui-monospace, monospace',
                letterSpacing: '0.02em',
              }}>
                {pct}%
              </span>
            </div>
            {/* Fila 2: importe */}
            <span style={{
              color: mutedText,
              fontSize: 10,
              fontFamily: 'ui-monospace, monospace',
            }}>
              {fmtARS(item.value)}
            </span>
          </div>
        )
      })}
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
      <p className="text-sm text-stone-400 dark:text-stone-500">{message}</p>
    </div>
  )
}

export function EvolutionTabs({ chartData, chartTx, categoryBreakdown, incomeCategoryBreakdown }: EvolutionTabsProps) {
  const [view, setView] = useState<EvView>('overview')
  const isDark = useDarkMode()

  const TABS: { key: EvView; label: string }[] = [
    { key: 'overview', label: 'Ingresos vs egresos' },
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
        lineStyle: { color: '#38BDF8', width: 2 },
        itemStyle: { color: '#38BDF8' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#38BDF840' },
              { offset: 1, color: '#38BDF800' },
            ],
          },
        },
      }],
    }
  }, [chartData, isDark])

  // Paleta de verdes para ingresos (de mayor a menor intensidad)
  const GREEN_PALETTE = ['#14532D', '#166534', '#15803D', '#16A34A', '#22C55E', '#4ADE80', '#86EFAC']
  const incomeSorted = [...incomeCategoryBreakdown].sort((a, b) => b.value - a.value)
  const incomeDonutData = incomeSorted.map((c, i) => ({
    name: c.name,
    value: c.value,
    itemStyle: { color: GREEN_PALETTE[i % GREEN_PALETTE.length] },
  }))

  // Paleta de rojos para egresos (de mayor a menor intensidad)
  const RED_PALETTE = ['#B91C1C', '#DC2626', '#EF4444', '#F87171', '#FCA5A5', '#FECACA', '#FEE2E2']
  const expenseSorted = [...categoryBreakdown].sort((a, b) => b.value - a.value)
  const expenseDonutData = expenseSorted.map((c, i) => ({
    name: c.name,
    value: c.value,
    itemStyle: { color: RED_PALETTE[i % RED_PALETTE.length] },
  }))

  return (
    <div>
      {/* Segmentado iOS: ingresos vs egresos, o en qué se compone cada uno */}
      <div className="px-5 pt-3">
        <div className="inline-flex max-w-full overflow-x-auto rounded-lg bg-black/[0.06] p-0.5 dark:bg-white/[0.1]" role="tablist" aria-label="Ver gráfico">
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={view === tab.key}
              onClick={() => setView(tab.key)}
              className={`shrink-0 whitespace-nowrap rounded-md px-3.5 py-1 text-[13px] transition ${
                view === tab.key
                  ? 'bg-white font-medium text-[#1C1C1E] shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-[#636366] dark:text-white'
                  : 'text-[#3C3C43] dark:text-[#EBEBF5]/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido del gráfico */}
      <div className="p-4">
        {view === 'overview' && <CashEvolutionChart chartData={chartData} chartTx={chartTx} height={300} />}
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

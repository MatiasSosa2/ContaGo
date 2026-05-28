'use client'

import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { useState, useEffect, useMemo, useRef } from 'react'

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

const DARK = {
  axis:    '#2a2a2a',
  label:   '#6b7280',
  track:   '#2a2a2a',
  bg:      '#1a1a1a',
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtARS(v: number) {
  return '$' + v.toLocaleString('es-AR', { minimumFractionDigits: 0 })
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. KPI SPARKLINE — Mini line/area chart sin ejes, solo tendencia
// ─────────────────────────────────────────────────────────────────────────────
interface SparklineProps {
  data: number[]
  color?: string
  height?: number
}

export function KpiSparkline({ data, color = C.income, height = 44 }: SparklineProps) {
  const option: EChartsOption = {
    animation: false,
    grid: { top: 2, bottom: 2, left: 2, right: 2 },
    xAxis: { type: 'category', show: false, data: data.map((_, i) => i) },
    yAxis: { type: 'value', show: false },
    series: [{
      type: 'line',
      data,
      smooth: true,
      showSymbol: false,
      lineStyle: { color, width: 1.5 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: color + '90' },
            { offset: 1, color: color + '30' },
          ],
        },
      },
    }],
  }
  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      opts={{ renderer: 'svg' }}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. GAUGE DE MARGEN — Semi-círculo de rentabilidad
// ─────────────────────────────────────────────────────────────────────────────
interface MarginGaugeProps {
  value: number   // porcentaje 0–100
  height?: number
}

export function MarginGauge({ value, height = 130 }: MarginGaugeProps) {
  const isDark = useDarkMode()
  const clamped = Math.max(0, Math.min(100, value))
  const color = clamped >= 30 ? C.income : clamped >= 10 ? C.net : C.red
  const trackColor = isDark ? DARK.track : '#f3f4f6'
  const option: EChartsOption = {
    animation: true,
    series: [{
      type: 'gauge',
      startAngle: 180,
      endAngle: 0,
      min: 0,
      max: 100,
      radius: '100%',
      center: ['50%', '72%'],
      progress: { show: true, width: 14, itemStyle: { color } },
      axisLine: { lineStyle: { width: 14, color: [[1, trackColor]] } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      pointer: { show: false },
      detail: {
        valueAnimation: true,
        formatter: '{value}%',
        color,
        fontSize: 22,
        fontWeight: 300,
        fontFamily: 'ui-monospace, monospace',
        offsetCenter: [0, '-10%'],
      },
      data: [{ value: Math.round(clamped) }],
    }],
  }
  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      opts={{ renderer: 'svg' }}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. RESUMEN FINANCIERO — Barras (ingresos/egresos) + Línea (neto)
// ─────────────────────────────────────────────────────────────────────────────
interface FinancialOverviewItem {
  label: string
  income: number
  expense: number
  net: number
}

interface FinancialOverviewProps {
  data: FinancialOverviewItem[]
  height?: number
}

export function FinancialOverviewChart({ data, height = 240 }: FinancialOverviewProps) {
  const isDark = useDarkMode()
  const axisColor  = isDark ? DARK.axis  : C.axis
  const labelColor = isDark ? DARK.label : C.label
  const labels  = data.map(d => d.label)
  const incomes  = data.map(d => d.income)
  const expenses = data.map(d => d.expense)
  const nets     = data.map(d => d.net)

  const option: EChartsOption = {
    animation: true,
    backgroundColor: 'transparent',
    grid: { top: 12, bottom: 36, left: 16, right: 16, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: C.tooltip,
      borderColor: '#374151',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 11 },
      formatter: (params: any) => {
        const label = params[0]?.axisValue ?? ''
        let html = `<div style="font-weight:600;color:#9ca3af;margin-bottom:6px;">${label}</div>`
        for (const p of params) {
          const val = Number(p.value ?? 0)
          const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px;"></span>`
          html += `<div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:2px;">`
          html += `<span>${dot}${p.seriesName}</span>`
          html += `<span style="font-family:monospace;font-weight:300;">${val >= 0 ? '' : '-'}${fmtARS(Math.abs(val))}</span>`
          html += `</div>`
        }
        return html
      },
    },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: labelColor, fontSize: 11 },
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { lineStyle: { color: axisColor } },
      axisTick: { show: false },
      axisLabel: { color: labelColor, fontSize: 10, fontWeight: 500 },
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
          if (abs >= 1_000_000) return `${v < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(1).replace('.0', '')}M`
          return `${v < 0 ? '-' : ''}$${abs.toLocaleString('es-AR')}`
        },
      },
    },
    series: [
      {
        name: 'Ingresos',
        type: 'bar',
        data: incomes,
        barMaxWidth: 28,
        itemStyle: { color: C.income, borderRadius: [4, 4, 0, 0] },
        emphasis: { itemStyle: { color: '#3A7D5C' } },
      },
      {
        name: 'Egresos',
        type: 'bar',
        data: expenses,
        barMaxWidth: 28,
        itemStyle: { color: '#B91C1C', borderRadius: [4, 4, 0, 0] },
        emphasis: { itemStyle: { color: '#991B1B' } },
      },
      {
        name: 'Ganancia',
        type: 'line',
        data: nets,
        smooth: true,
        showSymbol: true,
        symbolSize: 5,
        lineStyle: { color: '#38BDF8', width: 2 },
        itemStyle: { color: '#38BDF8' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#38BDF830' },
              { offset: 1, color: '#38BDF800' },
            ],
          },
        },
      },
    ],
  }
  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      opts={{ renderer: 'svg' }}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. DONUT DE GASTOS POR CATEGORÍA
// ─────────────────────────────────────────────────────────────────────────────
interface DonutSlice {
  name: string
  value: number
  itemStyle: { color: string }
}

interface ExpenseDonutProps {
  data: DonutSlice[]
  totalLabel?: string
  height?: number
}

export function ExpenseCategoryDonut({ data, totalLabel = '', height = 220 }: ExpenseDonutProps) {
  const option: EChartsOption = {
    animation: true,
    tooltip: {
      trigger: 'item',
      backgroundColor: C.tooltip,
      borderColor: '#374151',
      textStyle: { color: '#fff', fontSize: 11 },
      formatter: (p: any) => {
        const pct = p.percent?.toFixed(1) ?? '0'
        return `<div style="font-weight:600;margin-bottom:4px;">${p.name}</div>
          <div style="font-family:monospace;">${fmtARS(p.value)}<span style="color:#9ca3af;margin-left:8px;">${pct}%</span></div>`
      },
    },
    legend: { show: false },
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '36%',
        style: {
          text: totalLabel,
          fill: '#6b7280',
          fontSize: 11,
          fontWeight: 500,
        } as any,
      },
      {
        type: 'text',
        left: 'center',
        top: '44%',
        style: {
          text: fmtARS(data.reduce((s, d) => s + d.value, 0)),
          fill: '#1A1A1A',
          fontSize: 17,
          fontFamily: 'ui-monospace, monospace',
          fontWeight: 300,
        } as any,
      },
    ],
    series: [{
      type: 'pie',
      radius: ['54%', '76%'],
      center: ['50%', '50%'],
      padAngle: 2,
      itemStyle: { borderRadius: 4 },
      label: { show: false },
      data,
      emphasis: {
        scale: true,
        scaleSize: 4,
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.15)' },
      },
    }],
  }
  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      opts={{ renderer: 'svg' }}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4a. DONUT + FLECHAS SIN CRUCE (arco derecho → labels)
// ─────────────────────────────────────────────────────────────────────────────
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
      formatter: (p: any) => {
        const pct = p.percent?.toFixed(1) ?? '0'
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
          textAlign: 'center',
        } as any,
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
interface ProfitabilityDonutProps {
  expense: number
  gain: number
  height?: number
}

export function ProfitabilityDonut({ expense, gain, height = 140 }: ProfitabilityDonutProps) {
  const hasGain = gain > 0
  const data = [
    { value: expense, name: '% de egresos', itemStyle: { color: '#B91C1C' } },
    ...(hasGain ? [{ value: gain, name: '% de ganancia', itemStyle: { color: '#52A875' } }] : []),
  ]

  const option: EChartsOption = {
    animation: true,
    tooltip: {
      trigger: 'item',
      backgroundColor: C.tooltip,
      borderColor: '#374151',
      textStyle: { color: '#fff', fontSize: 11 },
      formatter: (p: any) => {
        const pct = p.percent?.toFixed(1) ?? '0'
        return `<div style="font-weight:600;margin-bottom:2px;">${p.name}</div>
          <div style="font-family:monospace;">${fmtARS(p.value)}<span style="color:#9ca3af;margin-left:6px;">${pct}%</span></div>`
      },
    },
    legend: { show: false },
    series: [{
      type: 'pie',
      radius: ['50%', '78%'],
      center: ['50%', '50%'],
      padAngle: 2,
      itemStyle: { borderRadius: 4 },
      label: {
        show: true,
        position: 'outside',
        formatter: '{b}',
        fontSize: 11,
        fontWeight: 600,
        fontFamily: 'ui-serif, Georgia, serif',
        color: 'inherit',
      },
      labelLine: {
        show: true,
        length: 8,
        length2: 12,
        smooth: true,
        lineStyle: { color: '#d1d5db', width: 1 },
      },
      data,
      emphasis: {
        scale: true,
        scaleSize: 4,
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.15)' },
      },
    }],
  }

  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      opts={{ renderer: 'svg' }}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. BARRA APILADA HORIZONTAL — Semáforo de deuda
// ─────────────────────────────────────────────────────────────────────────────
interface DebtBarItem {
  name: string
  value: number
  color: string
}

interface DebtStatusBarProps {
  data: DebtBarItem[]
  height?: number
}

export function DebtStatusBar({ data, height = 48 }: DebtStatusBarProps) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null

  const option: EChartsOption = {
    animation: true,
    grid: { top: 0, bottom: 0, left: 0, right: 0 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'none' },
      backgroundColor: C.tooltip,
      borderColor: '#374151',
      textStyle: { color: '#fff', fontSize: 11 },
      formatter: (params: any) => {
        let html = ''
        for (const p of params) {
          if (!p.value) continue
          const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px;"></span>`
          html += `<div style="display:flex;justify-content:space-between;gap:12px;">`
          html += `<span>${dot}${p.seriesName}</span>`
          html += `<span style="font-family:monospace;font-weight:300;">${fmtARS(p.value)}</span>`
          html += `</div>`
        }
        return html
      },
    },
    xAxis: { type: 'value', show: false },
    yAxis: { type: 'category', show: false, data: [''] },
    series: data.map(d => ({
      name: d.name,
      type: 'bar',
      stack: 'deuda',
      data: [d.value],
      barMaxWidth: 16,
      itemStyle: { color: d.color, borderRadius: 0 },
      label: { show: false },
    })),
  }
  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      opts={{ renderer: 'svg' }}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. EVOLUTION TABS — gráfico full-width con 4 sub-vistas
// ─────────────────────────────────────────────────────────────────────────────
type EvView = 'overview' | 'income_cats' | 'expense_cats' | 'net'

interface EvolutionTabsProps {
  chartData: { label: string; income: number; expense: number; net: number }[]
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

export function EvolutionTabs({ chartData, categoryBreakdown, incomeCategoryBreakdown }: EvolutionTabsProps) {
  const [view, setView] = useState<EvView>('overview')
  const isDark = useDarkMode()

  const TABS: { key: EvView; label: string }[] = [
    { key: 'overview', label: 'Ingresos vs Egresos' },
    { key: 'income_cats', label: 'Composición Ingresos' },
    { key: 'expense_cats', label: 'Composición Egresos' },
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
        formatter: (params: any) => {
          const p = params[0]
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
            if (abs >= 1_000_000) return `${v < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(1).replace('.0', '')}M`
            return `${v < 0 ? '-' : ''}$${abs.toLocaleString('es-AR')}`
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

  const incomeDonutData = incomeCategoryBreakdown.map(c => ({ name: c.name, value: c.value, itemStyle: { color: c.color } }))

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
      {/* Pestañas */}
      <div className="flex gap-0 overflow-x-auto border-b border-[#ECE7E1] px-5 dark:border-white/10">
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setView(tab.key)}
            className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
              view === tab.key
                ? 'border-[#3A4D39] text-[#3A4D39] dark:border-[#9AC7A8] dark:text-[#9AC7A8]'
                : 'border-transparent text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenido del gráfico */}
      <div className="p-4">
        {view === 'overview' && (
          hasData
            ? <FinancialOverviewChart data={chartData} height={280} />
            : <EmptyChart />
        )}
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

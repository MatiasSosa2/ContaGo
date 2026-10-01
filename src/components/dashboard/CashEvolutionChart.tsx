'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import type { DashboardChartTx } from '@/app/actions.database'

type Bucket = { label: string; income: number; expense: number; txIdx: number[] }
type Kind = 'INCOME' | 'EXPENSE'

// Colores y tipografía estilo iOS
const GREEN = '#34C759'
const RED = '#FF3B30'
const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif'

const fmt = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(Math.round(v)).toLocaleString('es-AR')}`
const fmtShort = (v: number) => {
  const abs = Math.abs(v)
  const sign = v < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M`
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`
  return `${sign}$${Math.round(abs)}`
}

/** Título de una barra: día completo si todos sus movimientos son del mismo día, si no el mes */
function bucketTitle(txs: DashboardChartTx[], fallback: string) {
  if (txs.length === 0) return fallback
  const dates = txs.map((t) => new Date(t.date))
  const sameDay = dates.every((d) => d.toDateString() === dates[0].toDateString())
  const text = sameDay
    ? dates[0].toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    : dates[0].toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// ── Recuadro al pasar el mouse: vidrio translúcido, tipografía del sistema ──
function GlassTooltip({ active, payload, label, both }: {
  active?: boolean
  payload?: readonly { payload?: { income: number | null; expense: number | null } }[]
  label?: string | number
  both: boolean
}) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  const rows: [string, number, string][] = []
  if (p.income !== null) rows.push(['Ingresos', p.income, GREEN])
  if (p.expense !== null) rows.push(['Egresos', p.expense, RED])
  return (
    <div
      className="min-w-[150px] rounded-xl border border-black/5 bg-white/75 px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-[#2C2C2E]/75"
      style={{ fontFamily: SF }}
    >
      <p className="mb-1 text-[11px] font-medium text-[#8E8E93]">{label}</p>
      {rows.map(([name, value, color]) => (
        <p key={name} className="flex items-center justify-between gap-4 text-[12px] leading-5">
          <span className="flex items-center gap-1.5 text-[#3C3C43] dark:text-[#EBEBF5]/80">
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: color }} />{name}
          </span>
          <span className="font-semibold tabular-nums text-[#1C1C1E] dark:text-white">{fmt(value)}</span>
        </p>
      ))}
      {both && (
        <p className="mt-1 flex justify-between gap-4 border-t border-black/5 pt-1 text-[12px] leading-5 dark:border-white/10">
          <span className="text-[#8E8E93]">Resultado</span>
          <span className={`font-semibold tabular-nums ${(p.income ?? 0) - (p.expense ?? 0) >= 0 ? 'text-[#248A3D] dark:text-[#30D158]' : 'text-[#D70015] dark:text-[#FF453A]'}`}>
            {(p.income ?? 0) - (p.expense ?? 0) >= 0 ? '+' : ''}{fmt((p.income ?? 0) - (p.expense ?? 0))}
          </span>
        </p>
      )}
    </div>
  )
}

// ── Ventanita del día/mes: resumen, categorías desplegables y resultado de caja ──
function CategoryGroup({ name, txs }: { name: string; txs: DashboardChartTx[] }) {
  const [open, setOpen] = useState(false)
  const total = txs.reduce((s, t) => s + t.amount, 0)
  return (
    <div className="border-b border-black/[0.06] last:border-b-0 dark:border-white/[0.08]">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 py-2.5 text-left">
        <svg className={`h-3 w-3 shrink-0 text-[#C7C7CC] transition-transform duration-200 ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="min-w-0 flex-1 truncate text-[14px] text-[#1C1C1E] dark:text-white">{name}</span>
        <span className="text-[12px] text-[#8E8E93]">{txs.length}</span>
        <span className="w-[92px] text-right text-[14px] tabular-nums text-[#1C1C1E] dark:text-white">{fmt(total)}</span>
      </button>
      {open && (
        <div className="pb-2 pl-5">
          {txs.map((t) => (
            <Link
              key={t.id}
              href={`/cajas?mov=${t.id}`}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-[#3C3C43] dark:text-[#EBEBF5]/80">{t.description}</span>
                {t.account && <span className="block truncate text-[11px] text-[#8E8E93]">{t.account}</span>}
              </span>
              <span className="text-[13px] tabular-nums text-[#3C3C43] dark:text-[#EBEBF5]/80">{fmt(t.amount)}</span>
              <svg className="h-3 w-3 shrink-0 text-[#C7C7CC]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function KindSection({ title, txs, color }: { title: string; txs: DashboardChartTx[]; color: string }) {
  const byCat = new Map<string, DashboardChartTx[]>()
  for (const t of txs) byCat.set(t.category, [...(byCat.get(t.category) ?? []), t])
  const groups = [...byCat.entries()].sort((a, b) => b[1].reduce((s, t) => s + t.amount, 0) - a[1].reduce((s, t) => s + t.amount, 0))
  const total = txs.reduce((s, t) => s + t.amount, 0)
  return (
    <div className="mt-5">
      <p className="mb-1 px-1 text-[12px] font-medium uppercase tracking-wide text-[#8E8E93]">{title}</p>
      <div className="rounded-xl bg-white px-3 dark:bg-[#2C2C2E]">
        {groups.length === 0
          ? <p className="py-3 text-[13px] text-[#8E8E93]">Sin movimientos</p>
          : groups.map(([name, list]) => <CategoryGroup key={name} name={name} txs={list} />)}
      </div>
      <p className="mt-1.5 flex justify-between px-1 text-[13px]">
        <span className="text-[#8E8E93]">Total {title.toLowerCase()}</span>
        <span className="font-semibold tabular-nums" style={{ color }}>{fmt(total)}</span>
      </p>
    </div>
  )
}

function DaySheet({ title, txs, kinds, onClose }: { title: string; txs: DashboardChartTx[]; kinds: Kind[]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const inc = txs.filter((t) => t.type === 'INCOME')
  const exp = txs.filter((t) => t.type !== 'INCOME')
  const totalInc = inc.reduce((s, t) => s + t.amount, 0)
  const totalExp = exp.reduce((s, t) => s + t.amount, 0)
  const both = kinds.length === 2
  const resultado = totalInc - totalExp

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" style={{ fontFamily: SF }}>
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/30 backdrop-blur-[3px]" onClick={onClose} />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-[20px] bg-[#F2F2F7] shadow-[0_24px_80px_rgba(0,0,0,0.25)] sm:rounded-[20px] dark:bg-[#1C1C1E]">
        <div className="flex items-start justify-between px-5 pb-2 pt-5">
          <h3 className="text-[20px] font-semibold tracking-tight text-[#1C1C1E] dark:text-white">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.06] text-[#8E8E93] transition hover:bg-black/10 dark:bg-white/10">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-6">
          {/* Resumen */}
          <div className={`grid gap-2 ${both ? 'grid-cols-3' : 'grid-cols-1'}`}>
            {kinds.includes('INCOME') && (
              <div className="rounded-xl bg-white px-3 py-2.5 dark:bg-[#2C2C2E]">
                <p className="text-[11px] text-[#8E8E93]">Ingresos</p>
                <p className="text-[15px] font-semibold tabular-nums text-[#248A3D] dark:text-[#30D158]">{fmtShort(totalInc)}</p>
              </div>
            )}
            {kinds.includes('EXPENSE') && (
              <div className="rounded-xl bg-white px-3 py-2.5 dark:bg-[#2C2C2E]">
                <p className="text-[11px] text-[#8E8E93]">Egresos</p>
                <p className="text-[15px] font-semibold tabular-nums text-[#D70015] dark:text-[#FF453A]">{fmtShort(totalExp)}</p>
              </div>
            )}
            {both && (
              <div className="rounded-xl bg-white px-3 py-2.5 dark:bg-[#2C2C2E]">
                <p className="text-[11px] text-[#8E8E93]">Resultado</p>
                <p className="text-[15px] font-semibold tabular-nums text-[#1C1C1E] dark:text-white">{resultado >= 0 ? '+' : ''}{fmtShort(resultado)}</p>
              </div>
            )}
          </div>

          {kinds.includes('INCOME') && <KindSection title="Ingresos" txs={inc} color={GREEN} />}
          {kinds.includes('EXPENSE') && <KindSection title="Egresos" txs={exp} color={RED} />}

          {both && (
            <div className="mt-5 flex items-center justify-between rounded-xl bg-white px-4 py-3 dark:bg-[#2C2C2E]">
              <span className="text-[14px] font-medium text-[#1C1C1E] dark:text-white">Resultado de caja</span>
              <span className={`text-[16px] font-semibold tabular-nums ${resultado >= 0 ? 'text-[#248A3D] dark:text-[#30D158]' : 'text-[#D70015] dark:text-[#FF453A]'}`}>
                {resultado >= 0 ? '+' : ''}{fmt(resultado)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Gráfico ──
export default function CashEvolutionChart({ chartData, chartTx, height = 280 }: {
  chartData: Bucket[]
  chartTx: DashboardChartTx[]
  height?: number
}) {
  // Siempre arranca mostrando todo
  const [kinds, setKinds] = useState<Kind[]>(['INCOME', 'EXPENSE'])
  const [cats, setCats] = useState<string[]>([])
  const [hover, setHover] = useState<number | null>(null)
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  const single = kinds.length === 1 ? kinds[0] : null
  // Tocar la leyenda aísla ese tipo; tocarla de nuevo vuelve a mostrar todo
  const toggleKind = (k: Kind) => {
    setCats([])
    setKinds((prev) => (prev.length === 1 && prev[0] === k ? ['INCOME', 'EXPENSE'] : [k]))
  }

  // Movimientos que pasan el filtro (tipo y, si hay un solo tipo, categorías)
  const visible = (t: DashboardChartTx) =>
    kinds.includes(t.type === 'INCOME' ? 'INCOME' : 'EXPENSE') && (!single || cats.length === 0 || cats.includes(t.category))

  const data = useMemo(() => chartData.map((b) => {
    let income = 0
    let expense = 0
    for (const i of b.txIdx) {
      const t = chartTx[i]
      if (!t || !visible(t)) continue
      if (t.type === 'INCOME') income += t.amount
      else expense += t.amount
    }
    return {
      label: b.label,
      income: kinds.includes('INCOME') ? income : null,
      expense: kinds.includes('EXPENSE') ? expense : null,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [chartData, chartTx, kinds, cats])

  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const t of chartTx) {
      if (!visible(t)) continue
      if (t.type === 'INCOME') income += t.amount
      else expense += t.amount
    }
    return { income, expense }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartTx, kinds, cats])

  // Categorías del tipo aislado, con su total en el período
  const catTotals = useMemo(() => {
    if (!single) return []
    const map = new Map<string, number>()
    for (const t of chartTx) {
      if ((t.type === 'INCOME' ? 'INCOME' : 'EXPENSE') !== single) continue
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [chartTx, single])

  const hasData = chartTx.length > 0
  const barSize = Math.max(4, Math.min(12, Math.floor(560 / Math.max(1, data.length) / (kinds.length === 2 ? 3 : 2))))
  const opacity = (i: number) => (hover === null || hover === i ? 1 : 0.35)

  const openTxs = openIdx !== null ? (chartData[openIdx]?.txIdx ?? []).map((i) => chartTx[i]).filter((t) => t && visible(t)) : []

  const legendPill = (k: Kind, label: string, color: string, total: number) => {
    const on = kinds.includes(k)
    return (
      <button
        type="button"
        onClick={() => toggleKind(k)}
        aria-pressed={single === k}
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] transition ${on ? 'bg-black/[0.04] dark:bg-white/[0.07]' : 'opacity-40 hover:opacity-70'}`}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <span className="text-[#3C3C43] dark:text-[#EBEBF5]/80">{label}</span>
        <span className="font-semibold tabular-nums text-[#1C1C1E] dark:text-white">{fmtShort(total)}</span>
      </button>
    )
  }

  const resultado = totals.income - totals.expense

  return (
    <div style={{ fontFamily: SF }}>
      {!hasData ? (
        <div className="flex items-center justify-center text-[13px] text-[#8E8E93]" style={{ height }}>Sin movimientos en el período</div>
      ) : (
        <div style={{ height }} className="[&_.recharts-surface]:outline-none">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
              barGap={2}
              barCategoryGap="20%"
              onMouseMove={(s) => setHover(s?.activeTooltipIndex != null ? Number(s.activeTooltipIndex) : null)}
              onMouseLeave={() => setHover(null)}
              onClick={(s) => {
                const i = s?.activeTooltipIndex != null ? Number(s.activeTooltipIndex) : null
                if (i !== null && (chartData[i]?.txIdx ?? []).some((j) => chartTx[j] && visible(chartTx[j]))) setOpenIdx(i)
              }}
              style={{ cursor: 'pointer' }}
            >
              <CartesianGrid vertical={false} stroke="rgba(120,120,128,0.14)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: '#8E8E93' }} interval="preserveStartEnd" minTickGap={10} height={16} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: '#8E8E93' }} width={38} tickCount={4} tickFormatter={(v) => fmtShort(Number(v))} />
              <Tooltip cursor={false} content={(p) => <GlassTooltip active={p.active} payload={p.payload as never} label={p.label} both={kinds.length === 2} />} />
              {kinds.includes('INCOME') && (
                <Bar dataKey="income" fill={GREEN} barSize={barSize} radius={barSize / 2} animationDuration={350}>
                  {data.map((_, i) => <Cell key={i} fillOpacity={opacity(i)} />)}
                </Bar>
              )}
              {kinds.includes('EXPENSE') && (
                <Bar dataKey="expense" fill={RED} barSize={barSize} radius={barSize / 2} animationDuration={350}>
                  {data.map((_, i) => <Cell key={i} fillOpacity={opacity(i)} />)}
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Leyenda que filtra + resultado del período */}
      <div className="mt-3 flex flex-wrap items-center gap-1">
        {legendPill('INCOME', 'Ingresos', GREEN, totals.income)}
        {legendPill('EXPENSE', 'Egresos', RED, totals.expense)}
        <p className="ml-auto text-right text-[12px]">
          <span className="text-[#8E8E93]">{single ? `Total ${single === 'INCOME' ? 'ingresos' : 'egresos'}` : 'Resultado del período'} </span>
          <span className={`font-semibold tabular-nums ${single ? 'text-[#1C1C1E] dark:text-white' : resultado >= 0 ? 'text-[#248A3D] dark:text-[#30D158]' : 'text-[#D70015] dark:text-[#FF453A]'}`}>
            {!single && resultado >= 0 ? '+' : ''}{fmt(single ? (single === 'INCOME' ? totals.income : totals.expense) : resultado)}
          </span>
        </p>
      </div>

      {/* Con un solo tipo: pastillas por categoría (se pueden prender varias) */}
      {single && catTotals.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCats([])}
            className={`rounded-full px-3 py-1 text-[12px] transition ${cats.length === 0 ? 'bg-[#1C1C1E] text-white dark:bg-white dark:text-[#1C1C1E]' : 'bg-black/[0.05] text-[#3C3C43] hover:bg-black/[0.08] dark:bg-white/[0.08] dark:text-[#EBEBF5]/80'}`}
          >
            Todas
          </button>
          {catTotals.map(([name, total]) => {
            const on = cats.includes(name)
            return (
              <button
                key={name}
                type="button"
                onClick={() => setCats((prev) => (on ? prev.filter((c) => c !== name) : [...prev, name]))}
                className={`rounded-full px-3 py-1 text-[12px] transition ${on ? 'bg-[#1C1C1E] text-white dark:bg-white dark:text-[#1C1C1E]' : 'bg-black/[0.05] text-[#3C3C43] hover:bg-black/[0.08] dark:bg-white/[0.08] dark:text-[#EBEBF5]/80'}`}
              >
                {name} <span className="tabular-nums opacity-60">{fmtShort(total)}</span>
              </button>
            )
          })}
        </div>
      )}

      {openIdx !== null && openTxs.length > 0 && (
        <DaySheet
          title={bucketTitle(openTxs, chartData[openIdx].label)}
          txs={openTxs}
          kinds={kinds}
          onClose={() => setOpenIdx(null)}
        />
      )}
    </div>
  )
}

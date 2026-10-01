'use client'

import type { BalanceItem, BalanceRubro, BalanceSheet } from '@/server/balance/balance-sheet'
import { Card, IOS, KpiCard, SF_FONT, SubtleDelta, fmtFull, fmtPctEs } from './modern'
import AnimatedNumber from './AnimatedNumber'

export type BalanceTrends = { activo: number[]; pasivo: number[] }

type View = { currency: 'ARS' | 'USD'; rate: number | null; prevRate: number | null }

const variacionPct = (actual: number, anterior: number) => (anterior !== 0 ? ((actual - anterior) / Math.abs(anterior)) * 100 : null)

// Columnas: nombre | $ | % del activo | vs cierre anterior
const rowGrid = 'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 text-left sm:grid-cols-[minmax(0,1fr)_auto_44px_64px] sm:px-5'
const divider = 'border-b border-black/[0.06] last:border-b-0 dark:border-white/[0.08]'

/** Columna "vs": variación sutil en millones (se oculta en celular) */
function Delta({ value, inverse = false }: { value: number; currency?: string; className?: string; inverse?: boolean }) {
  return <SubtleDelta value={value} inverse={inverse} className="hidden sm:inline-flex" />
}

function Rubro({ rubro, previo, base, view, inverse = false }: { rubro: BalanceRubro; previo?: BalanceRubro; base: number; view: View; inverse?: boolean }) {
  const conv = (v: number, rate: number | null) => (view.currency === 'USD' ? (rate ? v / rate : 0) : v)
  const monto = conv(rubro.amount, view.rate)
  const delta = monto - conv(previo?.amount ?? 0, view.prevRate)
  const share = base > 0 ? fmtPctEs((rubro.amount / base) * 100) : ''
  const cur = view.currency
  // Renglones menores al 1% del activo se agrupan en "Otros" (si son 2 o más)
  const chicos = base > 0 ? rubro.items.filter((i) => i.amount / base < 0.01) : []
  type Fila = BalanceItem & { grupo?: string[] }
  const items: Fila[] = chicos.length >= 2
    ? [...rubro.items.filter((i) => !chicos.includes(i)), { label: 'Otros', amount: chicos.reduce((acc, i) => acc + i.amount, 0), note: `${chicos.length} más`, grupo: chicos.map((i) => i.label) }]
    : rubro.items

  return (
    <details className={`ios-disclosure group ${divider}`}>
      <summary className={`${rowGrid} cursor-pointer list-none py-2.5 text-[14px] [&::-webkit-details-marker]:hidden`}>
        <span className="flex min-w-0 items-center gap-1.5 pl-4">
          <svg className="h-2.5 w-2.5 shrink-0 text-[#C7C7CC] transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="truncate text-[#1C1C1E] dark:text-white">{rubro.label}</span>
        </span>
        <span className="w-[8.5rem] text-right tabular-nums text-[#1C1C1E] sm:w-[9.5rem] dark:text-white">{fmtFull(monto, cur)}</span>
        <span className="hidden text-right text-[12px] tabular-nums text-[#AEAEB2] sm:inline dark:text-[#636366]">{share}</span>
        <Delta value={delta} currency={cur} className="text-[12px]" inverse={inverse} />
      </summary>
      <div className="pb-1">
        {rubro.items.length === 0 && <p className="py-1.5 pl-14 text-[12px] text-[#8E8E93]">Sin saldo</p>}
        {items.map((it) => {
          // Valor anterior del renglón (de "Otros": la suma de los mismos renglones)
          const anteriores = previo?.items.filter((p) => (it.grupo ? it.grupo.includes(p.label) : p.label === it.label)) ?? []
          const antes = { amount: anteriores.reduce((acc, p) => acc + p.amount, 0) }
          const m = conv(it.amount, view.rate)
          return (
            <div key={it.label} className={`${rowGrid} py-2 text-[13px]`}>
              <span className="flex min-w-0 items-baseline gap-2 pl-9">
                <span className="truncate text-[#8E8E93]">{it.label}</span>
                {it.note && <span className="shrink-0 text-[11px] text-[#AEAEB2]">{it.note}</span>}
              </span>
              <span className="w-[8.5rem] text-right tabular-nums text-[#8E8E93] sm:w-[9.5rem]">{fmtFull(m, cur)}</span>
              <span className="hidden text-right text-[11px] tabular-nums text-[#AEAEB2] sm:inline dark:text-[#636366]">{base > 0 ? fmtPctEs((it.amount / base) * 100) : ''}</span>
              <Delta value={m - conv(antes?.amount ?? 0, view.prevRate)} currency={cur} className="text-[11px]" inverse={inverse} />
            </div>
          )
        })}
      </div>
    </details>
  )
}

function SectionHeader({ label, amount, delta, currency, inverse = false }: { label: string; amount: number; delta: number; currency: string; inverse?: boolean }) {
  return (
    <div className={`${rowGrid} pb-1.5 pt-5`}>
      <span className="text-[12px] font-medium uppercase tracking-wide text-[#8E8E93]">{label}</span>
      <span className="w-[8.5rem] text-right text-[15px] font-semibold tabular-nums text-[#1C1C1E] sm:w-[9.5rem] dark:text-white">{fmtFull(amount, currency)}</span>
      <span className="hidden sm:inline" />
      <Delta value={delta} currency={currency} className="text-[12px]" inverse={inverse} />
    </div>
  )
}

export default function PatrimonioDetail({ data, previous, currency, trends, prevLabel }: {
  data: BalanceSheet
  previous: BalanceSheet
  currency: 'ARS' | 'USD'
  trends: BalanceTrends
  prevLabel: string
}) {
  const view: View = { currency, rate: data.rate, prevRate: previous.rate }
  const sinCotizacion = currency === 'USD' && !data.rate
  const conv = (v: number, rate: number | null) => (currency === 'USD' ? (rate ? v / rate : 0) : v)
  const activo = conv(data.totalActivo, data.rate)
  const pasivo = conv(data.totalPasivo, data.rate)
  const patrimonio = conv(data.patrimonio, data.rate)
  const activoPrev = conv(previous.totalActivo, previous.rate)
  const pasivoPrev = conv(previous.totalPasivo, previous.rate)

  if (sinCotizacion) {
    return (
      <Card className="px-5 py-8 text-center" >
        <p className="text-[15px] text-[#1C1C1E] dark:text-white" style={{ fontFamily: SF_FONT }}>Todavía no hay una cotización registrada</p>
        <p className="mt-1 text-[13px] text-[#8E8E93]" style={{ fontFamily: SF_FONT }}>Registrá una compra o venta de dólares (cambio de caja) para ver el patrimonio en dólares.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4" style={{ fontFamily: SF_FONT }}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiCard
          label="Activo"
          value={<AnimatedNumber value={activo} format={(v) => fmtFull(v, currency)} />}
          trend={trends.activo}
          color={IOS.blue}
          delta={{ pct: variacionPct(activo, activoPrev), vs: prevLabel }}
        />
        <KpiCard
          label="Pasivo"
          value={<AnimatedNumber value={pasivo} format={(v) => fmtFull(v, currency)} />}
          trend={trends.pasivo}
          color={IOS.orange}
          delta={{ pct: variacionPct(pasivo, pasivoPrev), vs: prevLabel, inverse: true }}
        />
      </div>

      <Card className="overflow-hidden py-2">
        {/* Encabezado de columnas */}
        <div className={`${rowGrid} pb-0 pt-1.5 text-[11px] text-[#AEAEB2] dark:text-[#636366]`}>
          <span />
          <span className="w-[8.5rem] text-right sm:w-[9.5rem]">$</span>
          <span className="hidden text-right sm:inline">%</span>
          <span className="hidden text-right sm:inline">vs {prevLabel}</span>
        </div>

        <SectionHeader label="Activo" amount={activo} delta={activo - activoPrev} currency={currency} />
        {data.activo.map((r) => (
          <Rubro key={r.key} rubro={r} previo={previous.activo.find((p) => p.key === r.key)} base={data.totalActivo} view={view} />
        ))}

        <SectionHeader label="Pasivo" amount={pasivo} delta={pasivo - pasivoPrev} currency={currency} inverse />
        {data.pasivo.map((r) => (
          <Rubro key={r.key} rubro={r} previo={previous.pasivo.find((p) => p.key === r.key)} base={data.totalActivo} view={view} inverse />
        ))}

        <div className="mx-4 mt-3 flex items-baseline justify-between border-t border-black/10 pb-2 pt-4 sm:mx-5 dark:border-white/15">
          <p className="text-[17px] font-semibold text-[#1C1C1E] dark:text-white">Patrimonio neto</p>
          <p className="text-[22px] font-semibold tracking-tight tabular-nums text-[#0071A4] dark:text-[#64D2FF]">
            <AnimatedNumber value={patrimonio} format={(v) => fmtFull(v, currency)} />
          </p>
        </div>
      </Card>

      {currency === 'USD' && data.rate && (
        <p className="px-1 text-[12px] text-[#8E8E93]">Convertido a US$1 = ${data.rate.toLocaleString('es-AR')} (última cotización registrada)</p>
      )}
    </div>
  )
}

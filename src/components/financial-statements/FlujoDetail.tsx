'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { CashLine, CashStatement } from '@/server/cash/cash-statement'
import { Card, IOS, KpiCard, SF_FONT, fmtFull, fmtPctEs } from './modern'
import MovementsSheet, { type SheetMov } from './MovementsSheet'
import AnimatedNumber from './AnimatedNumber'

export type CashTrends = { saldo: number[] }

type Open = { title: string; subtitle: string; movs: SheetMov[]; sign: 1 | -1 } | null

const pct = (v: number, total: number) => (total > 0 ? fmtPctEs((v / total) * 100) : '')

// ── Renglones ──────────────────────────────────────────

function Chevron() {
  return (
    <svg className="h-2.5 w-2.5 shrink-0 text-[#C7C7CC] transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

/** Monto de la columna "$": ancho fijo y alineado a la derecha, así todos se leen parejos */
function Money({ value, currency, className = '', signed = true }: { value: number; currency: string; className?: string; signed?: boolean }) {
  return <span className={`w-[8.5rem] text-right tabular-nums sm:w-[9.5rem] ${className}`}>{fmtFull(value, currency, signed)}</span>
}

type Depth = 1 | 2 | 3
// A medida que se abren los desplegables, la letra se achica y el texto se aclara
const DEPTH = {
  1: { row: 'py-2.5 text-[14px]', share: 'text-[12px]', indent: 'pl-4' },
  2: { row: 'py-2 text-[13px]', share: 'text-[11px]', indent: 'pl-9' },
  3: { row: 'py-1.5 text-[12px]', share: 'text-[11px]', indent: 'pl-14' },
} as const

/** Contenido de un renglón: nombre (con sangría), % y monto */
function RowContent({ label, amount, share, currency, sign, depth, muted, strong, leading }: {
  label: string
  amount: number
  share: string
  currency: string
  sign: 1 | -1
  depth: Depth
  muted?: boolean
  strong?: boolean
  leading?: ReactNode
}) {
  const color = muted ? 'text-[#8E8E93]' : 'text-[#1C1C1E] dark:text-white'
  return (
    <>
      <span className={`flex min-w-0 items-center gap-1.5 ${DEPTH[depth].indent}`}>
        {leading ?? <span className="w-2.5 shrink-0" aria-hidden />}
        <span className={`truncate ${color} ${strong ? 'font-medium' : ''}`}>{label}</span>
      </span>
      <Money value={sign * amount} currency={currency} className={`${muted ? 'text-[#8E8E93]' : sign < 0 ? 'text-[#3C3C43] dark:text-[#EBEBF5]/80' : 'text-[#1C1C1E] dark:text-white'} ${strong ? 'font-medium' : ''}`} />
      <span className={`hidden text-right tabular-nums text-[#AEAEB2] sm:inline dark:text-[#636366] ${DEPTH[depth].share}`}>{share}</span>
    </>
  )
}

const rowGrid = 'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 text-left sm:grid-cols-[minmax(0,1fr)_auto_44px] sm:gap-3 sm:px-5'
const divider = 'border-b border-black/[0.06] last:border-b-0 dark:border-white/[0.08]'

/**
 * Un renglón del cuadro. Si tiene detalle (productos, clientes, subcategorías) se despliega;
 * si no, al tocarlo se abren sus movimientos.
 */
function LineRow({ line, total, currency, sign, depth, section, onOpen }: {
  line: CashLine
  total: number
  currency: string
  sign: 1 | -1
  depth: 1 | 2
  section: string
  onOpen: (o: Open) => void
}) {
  const open = (l: CashLine, subtitle: string) => onOpen({ title: l.label, subtitle, movs: l.movs, sign })
  const childDepth = (depth + 1) as Depth
  if (!line.children?.length) {
    return (
      <button type="button" onClick={() => open(line, section)} className={`${rowGrid} ${DEPTH[depth].row} ${divider} transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]`}>
        <RowContent label={line.label} amount={line.amount} share={pct(line.amount, total)} currency={currency} sign={sign} depth={depth} />
      </button>
    )
  }
  return (
    <details className={`ios-disclosure group ${divider}`}>
      <summary className={`${rowGrid} ${DEPTH[depth].row} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
        <RowContent label={line.label} amount={line.amount} share={pct(line.amount, total)} currency={currency} sign={sign} depth={depth} leading={<Chevron />} />
      </summary>
      <div className="pb-1">
        {line.children.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => open(c, line.label)}
            className={`${rowGrid} ${DEPTH[childDepth].row} transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]`}
          >
            <RowContent label={c.label} amount={c.amount} share={pct(c.amount, total)} currency={currency} sign={sign} depth={childDepth} muted />
          </button>
        ))}
      </div>
    </details>
  )
}

/** Título de una sección (Ingresos / Egresos) con su total */
function SectionHeader({ label, amount, currency, sign }: { label: string; amount: number; currency: string; sign: 1 | -1 }) {
  return (
    <div className={`${rowGrid} pb-1.5 pt-5`}>
      <span className="text-[12px] font-medium uppercase tracking-wide text-[#8E8E93]">{label}</span>
      <Money value={sign * amount} currency={currency} className={`text-[15px] font-semibold ${sign > 0 ? 'text-[#248A3D] dark:text-[#30D158]' : 'text-[#1C1C1E] dark:text-white'}`} />
      <span className="hidden sm:inline" />
    </div>
  )
}

// ── Selector de caja (menú estilo iOS) ──────────────────────────────────────────

function CajaSelect({ accounts, selected }: { accounts: CashStatement['accounts']; selected: string | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [open, setOpen] = useState(false)
  const label = accounts.find((a) => a.id === selected)?.name ?? 'Todas'

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const choose = (id: string | null) => {
    setOpen(false)
    const sp = new URLSearchParams(params.toString())
    if (id) sp.set('caja', id)
    else sp.delete('caja')
    router.push(`${pathname}?${sp.toString()}`, { scroll: false })
  }

  const options: { id: string | null; name: string; hint?: string }[] = [
    { id: null, name: 'Todas las cajas' },
    ...accounts.map((a) => ({ id: a.id, name: a.name, hint: a.type === 'CASH' ? 'Efectivo' : a.type === 'BANK' ? 'Banco' : 'Billetera' })),
  ]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1 rounded-full bg-[#007AFF]/[0.1] py-1 pl-3 pr-2 text-[13px] font-medium text-[#007AFF] transition hover:bg-[#007AFF]/[0.16] active:scale-[0.97] dark:bg-[#0A84FF]/[0.18] dark:text-[#0A84FF]"
      >
        <span className="max-w-[120px] truncate">{label}</span>
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        </svg>
      </button>

      {open && (
        <>
          <button type="button" aria-label="Cerrar" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          {/* Menú flotante estilo iOS: vidrio translúcido y tilde en la opción elegida */}
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-[14px] border border-black/[0.06] bg-white/80 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#2C2C2E]/85"
            style={{ fontFamily: SF_FONT }}
          >
            {options.map((o, i) => {
              const activa = o.id === selected
              return (
                <button
                  key={o.id ?? 'todas'}
                  type="button"
                  role="menuitemradio"
                  aria-checked={activa}
                  onClick={() => choose(o.id)}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition hover:bg-black/[0.05] dark:hover:bg-white/[0.08] ${i === 0 ? 'border-b border-black/[0.06] dark:border-white/[0.08]' : ''}`}
                >
                  <span className="flex w-4 shrink-0 justify-center text-[#007AFF] dark:text-[#0A84FF]">
                    {activa && (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] text-[#1C1C1E] dark:text-white">{o.name}</span>
                    {o.hint && <span className="block text-[12px] text-[#8E8E93]">{o.hint}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Cuadro ──────────────────────────────────────────

export default function FlujoDetail({ data, trends }: { data: CashStatement; trends: CashTrends }) {
  const [open, setOpen] = useState<Open>(null)
  const pathname = usePathname()
  const params = useSearchParams()
  // URL para filtrar por una caja (o volver a todas con null)
  const cajaHref = (id: string | null) => {
    const sp = new URLSearchParams(params.toString())
    if (id) sp.set('caja', id)
    else sp.delete('caja')
    return `${pathname}?${sp.toString()}`
  }
  const cur = data.currency
  const variacion = data.saldoFinal - data.saldoInicial
  const crecio = variacion >= 0

  return (
    <div className="space-y-4" style={{ fontFamily: SF_FONT }}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Saldo final, con selector de caja */}
        <div className="relative">
          <KpiCard
            label="Saldo final"
            value={<AnimatedNumber value={data.saldoFinal} format={(v) => fmtFull(v, cur)} />}
            trend={trends.saldo}
            color={IOS.cyan}
          />
          <div className="absolute right-3 top-3">
            <CajaSelect accounts={data.accounts} selected={data.accountId} />
          </div>
        </div>

        {/* Variación del período: tarjeta teñida, el número es lo principal */}
        <div className={`flex flex-col justify-center rounded-2xl px-5 py-4 ${crecio ? 'bg-[#34C759]/[0.12] dark:bg-[#30D158]/[0.14]' : 'bg-[#FF3B30]/[0.10] dark:bg-[#FF453A]/[0.14]'}`}>
          <p className={`text-[13px] ${crecio ? 'text-[#248A3D] dark:text-[#30D158]' : 'text-[#D70015] dark:text-[#FF453A]'}`}>Variación del período</p>
          <p className={`mt-0.5 text-[30px] font-semibold tracking-tight tabular-nums ${crecio ? 'text-[#248A3D] dark:text-[#30D158]' : 'text-[#D70015] dark:text-[#FF453A]'}`}>
            <AnimatedNumber value={variacion} format={(v) => fmtFull(v, cur, true)} />
          </p>        </div>
      </div>

      {/* Cascada: saldo inicial → ingresos → egresos → (cambio de moneda) → saldo final */}
      <Card className="overflow-hidden py-2">
        <div className={`${rowGrid} pb-0 pt-1.5 text-[11px] text-[#AEAEB2] dark:text-[#636366]`}>
          <span />
          <span className="w-[8.5rem] text-right sm:w-[9.5rem]">$</span>
          <span className="hidden text-right sm:inline">%</span>
        </div>
        <div className={`${rowGrid} ${DEPTH[1].row} border-b border-black/[0.06] dark:border-white/[0.08]`}>
          <span className="font-semibold text-[#1C1C1E] dark:text-white">Saldo inicial</span>
          <Money value={data.saldoInicial} currency={cur} signed={false} className="font-semibold text-[#1C1C1E] dark:text-white" />
          <span className="hidden sm:inline" />
        </div>

        <SectionHeader label="Ingresos" amount={data.totalIngresos} currency={cur} sign={1} />
        {data.ingresos.length === 0
          ? <p className="px-5 py-2 text-[13px] text-[#8E8E93]">Sin ingresos en el período</p>
          : data.ingresos.map((l) => (
              <LineRow key={l.label} line={l} total={data.totalIngresos} currency={cur} sign={1} depth={1} section="Ingresos" onOpen={setOpen} />
            ))}

        <SectionHeader label="Egresos" amount={data.totalEgresos} currency={cur} sign={-1} />
        {data.egresos.length === 0
          ? <p className="px-5 py-2 text-[13px] text-[#8E8E93]">Sin egresos en el período</p>
          : data.egresos.map((k) => (
              // Cada tipo (Operativos, Inversiones, Deudas, Cambio de caja) se despliega en sus renglones
              <details key={k.label} className={`ios-disclosure group/kind ${divider}`}>
                <summary className={`${rowGrid} ${DEPTH[1].row} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
                  <RowContent
                    label={k.label} amount={k.amount} share={pct(k.amount, data.totalEgresos)} currency={cur} sign={-1} depth={1} strong
                    leading={
                      <svg className="h-2.5 w-2.5 shrink-0 text-[#C7C7CC] transition-transform group-open/kind:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    }
                  />
                </summary>
                <div className="pb-1">
                  {k.lines.map((l) => (
                    <LineRow key={l.label} line={l} total={data.totalEgresos} currency={cur} sign={-1} depth={2} section={k.label} onOpen={setOpen} />
                  ))}
                </div>
              </details>
            ))}

        {data.cambioMoneda !== 0 && (
          // Cambio de moneda: el detalle va a la derecha, en gris, para que la fila quede fina
          <div className={`${rowGrid} ${DEPTH[1].row} mt-2 border-t border-black/[0.06] dark:border-white/[0.08]`}>
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="shrink-0 text-[#1C1C1E] dark:text-white">Cambio de moneda</span>
              <span className="truncate text-[12px] text-[#8E8E93]">{data.exchangeNotes.join(' · ')}</span>
            </span>
            <Money value={data.cambioMoneda} currency={cur} className="text-[#3C3C43] dark:text-[#EBEBF5]/80" />
            <span className="hidden sm:inline" />
          </div>
        )}

        <div className="mx-4 mt-3 flex items-baseline justify-between border-t border-black/10 pb-2 pt-4 sm:mx-5 dark:border-white/15">
          <p className="text-[17px] font-semibold text-[#1C1C1E] dark:text-white">Saldo final</p>
          <p className="text-[22px] font-semibold tracking-tight tabular-nums text-[#0071A4] dark:text-[#64D2FF]">{fmtFull(data.saldoFinal, cur)}</p>
        </div>
      </Card>

      {/* Por caja: inicio, cierre y variación. Tocar una caja filtra el estado */}
      {data.accounts.length > 0 && (
        <Card className="overflow-hidden py-2">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-3 px-4 pb-1 pt-3 text-[12px] font-medium uppercase tracking-wide text-[#8E8E93] sm:gap-4 sm:px-5">
            <span>Por caja</span>
            <span className="hidden w-28 text-right sm:inline">Inicio</span>
            <span className="w-24 text-right sm:w-28">Cierre</span>
            <span className="w-24 text-right sm:w-28">Variación</span>
          </div>
          {data.accounts.map((a) => {
            const v = a.cierre - a.inicio
            const activa = a.id === data.accountId
            return (
              <Link
                key={a.id}
                href={cajaHref(activa ? null : a.id)}
                scroll={false}
                className={`grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3 border-b border-black/[0.06] px-4 py-2.5 text-[14px] transition last:border-b-0 sm:gap-4 sm:px-5 dark:border-white/[0.08] ${
                  activa ? 'bg-[#007AFF]/[0.08] dark:bg-[#0A84FF]/[0.15]' : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'
                }`}
              >
                <span className={`truncate ${activa ? 'font-semibold text-[#007AFF] dark:text-[#0A84FF]' : 'text-[#1C1C1E] dark:text-white'}`}>{a.name}</span>
                <span className="hidden w-28 text-right tabular-nums text-[#8E8E93] sm:inline">{fmtFull(a.inicio, cur)}</span>
                <span className="w-24 text-right font-medium tabular-nums text-[#1C1C1E] sm:w-28 dark:text-white">{fmtFull(a.cierre, cur)}</span>
                <span className={`w-24 text-right tabular-nums sm:w-28 ${v > 0.5 ? 'text-[#248A3D] dark:text-[#30D158]' : v < -0.5 ? 'text-[#D70015] dark:text-[#FF453A]' : 'text-[#8E8E93]'}`}>
                  {fmtFull(v, cur, true)}
                </span>
              </Link>
            )
          })}
          {/* Total de todas las cajas */}
          {(() => {
            const ini = data.accounts.reduce((s, a) => s + a.inicio, 0)
            const cie = data.accounts.reduce((s, a) => s + a.cierre, 0)
            const v = cie - ini
            return (
              <div className="mx-4 mt-1 grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3 border-t border-black/10 pb-1 pt-2.5 text-[14px] font-semibold sm:mx-5 sm:gap-4 dark:border-white/15">
                <span className="text-[#1C1C1E] dark:text-white">Total</span>
                <span className="hidden w-28 text-right tabular-nums text-[#8E8E93] sm:inline">{fmtFull(ini, cur)}</span>
                <span className="w-24 text-right tabular-nums text-[#1C1C1E] sm:w-28 dark:text-white">{fmtFull(cie, cur)}</span>
                <span className={`w-24 text-right tabular-nums sm:w-28 ${v > 0.5 ? 'text-[#248A3D] dark:text-[#30D158]' : v < -0.5 ? 'text-[#D70015] dark:text-[#FF453A]' : 'text-[#8E8E93]'}`}>{fmtFull(v, cur, true)}</span>
              </div>
            )
          })()}
        </Card>
      )}

      {open && <MovementsSheet {...open} currency={cur} onClose={() => setOpen(null)} />}
    </div>
  )
}

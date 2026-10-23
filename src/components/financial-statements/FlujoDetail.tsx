'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { CashLine, CashStatement } from '@/server/cash/cash-statement'
import { Card, IOS, KpiCard, SF_FONT, TONO_MONTO, TableRow, TableSection, TableSubRow, Variacion, fmtFull, fmtPctEs, type TonoMonto } from './modern'
import MovementsSheet, { type SheetMov } from './MovementsSheet'
import AnimatedNumber from './AnimatedNumber'
import { EncabezadoVariacion, ModoVariacion } from './VariacionCol'

export type CashTrends = { saldo: number[]; variacion: number[] }

/** El mismo cuadro del período anterior (mes o año), para la columna de variación */
export type CashPrevious = {
  label: string
  saldoInicial: number
  saldoFinal: number
  ingresos: number
  egresos: number
  variacion: number
  /** Montos por línea y por "línea›detalle" */
  ing: Record<string, number>
  egr: Record<string, number>
} | null

type Open = { title: string; subtitle: string; movs: SheetMov[]; sign: 1 | -1 } | null

const pctDe = (v: number, total: number) => (total > 0 ? (v / total) * 100 : undefined)

/**
 * Una línea del cuadro (ej. "Ventas cobradas"). Si tiene detalle (productos, clientes,
 * subcategorías) se despliega; tocar una línea sin detalle, o un detalle, abre sus movimientos.
 */
function Linea({ line, total, currency, tono, section, anteriores, inverse, vs, onOpen }: {
  line: CashLine
  total: number
  currency: string
  tono: TonoMonto
  section: string
  anteriores: Record<string, number> | null
  /** En egresos, que suban es malo */
  inverse?: boolean
  vs?: string
  onOpen: (o: Open) => void
}) {
  const sign = tono === 'egreso' ? -1 : 1
  const abrir = (l: CashLine, subtitle: string) => onOpen({ title: l.label, subtitle, movs: l.movs, sign })
  const variacion = (key: string, actual: number) =>
    anteriores ? <Variacion actual={actual} anterior={anteriores[key]} inverse={inverse} vs={vs} /> : undefined
  return (
    <TableRow
      label={line.label}
      amount={line.amount}
      pct={pctDe(line.amount, total)}
      currency={currency}
      tono={tono}
      variacion={variacion(line.label, line.amount)}
      onClick={line.children?.length ? undefined : () => abrir(line, section)}
    >
      {line.children?.length
        ? line.children.map((c) => (
            <TableSubRow
              key={c.label}
              label={c.label}
              amount={c.amount}
              pct={pctDe(c.amount, total)}
              currency={currency}
              tono={tono}
              variacion={variacion(`${line.label}›${c.label}`, c.amount)}
              onClick={() => abrir(c, line.label)}
            />
          ))
        : undefined}
    </TableRow>
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

export default function FlujoDetail({ data, trends, previous }: { data: CashStatement; trends: CashTrends; previous: CashPrevious }) {
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
  const vs = previous?.label
  const comparar = (actual: number, anterior: number | undefined, inverse = false) =>
    previous ? <Variacion actual={actual} anterior={anterior} inverse={inverse} vs={vs} /> : undefined
  const pctVar = (actual: number, anterior: number) => (anterior !== 0 ? ((actual - anterior) / Math.abs(anterior)) * 100 : null)
  // Egresos sin la subclasificación (Operativos, Inversiones…): todas sus líneas directo
  const lineasEgresos = data.egresos.flatMap((k) => k.lines)

  return (
    <ModoVariacion>
    <div className="space-y-4" style={{ fontFamily: SF_FONT }}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Saldo final, con selector de caja */}
        <div className="relative">
          <KpiCard
            label="Saldo final"
            value={<AnimatedNumber value={data.saldoFinal} format={(v) => fmtFull(v, cur)} />}
            trend={trends.saldo}
            color={IOS.neta}
          />
          <div className="absolute right-3 top-3">
            <CajaSelect accounts={data.accounts} selected={data.accountId} />
          </div>
        </div>

        {/* Variación del período (lo que entró − lo que salió) */}
        <KpiCard
          label="Variación del período"
          value={<AnimatedNumber value={variacion} format={(v) => fmtFull(v, cur, true)} />}
          trend={trends.variacion}
          color={variacion >= 0 ? '#30A35A' : IOS.red}
          delta={previous ? { pct: pctVar(variacion, previous.variacion), vs: previous.label } : undefined}
        />
      </div>

      {/* Cascada: saldo inicial → ingresos → egresos → (cambio de moneda) → saldo final */}
      <Card className="overflow-hidden py-2">
        {/* Encabezado: solo la columna de variación lleva título */}
        {previous && (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 pb-0.5 pt-2 text-[11px] text-[#AEAEB2] sm:gap-4 sm:px-5 dark:text-[#636366]">
            <span />
            <EncabezadoVariacion vs={previous.label} />
          </div>
        )}

        <TableRow label="Saldo inicial" amount={data.saldoInicial} currency={cur} strong tono="saldo" variacion={comparar(data.saldoInicial, previous?.saldoInicial)} />

        <TableSection title="Ingresos" />
        {data.ingresos.length === 0
          ? <p className="px-5 py-2 text-[13px] text-[#8E8E93]">Sin ingresos en el período</p>
          : data.ingresos.map((l) => (
              <Linea key={l.label} line={l} total={data.totalIngresos} currency={cur} tono="ingreso" section="Ingresos" anteriores={previous?.ing ?? null} vs={vs} onOpen={setOpen} />
            ))}

        <TableSection title="Egresos" />
        {lineasEgresos.length === 0
          ? <p className="px-5 py-2 text-[13px] text-[#8E8E93]">Sin egresos en el período</p>
          : lineasEgresos.map((l, i) => (
              <Linea key={`${i}-${l.label}`} line={l} total={data.totalEgresos} currency={cur} tono="egreso" section="Egresos" anteriores={previous?.egr ?? null} inverse vs={vs} onOpen={setOpen} />
            ))}

        {data.cambioMoneda !== 0 && (
          <TableRow
            label="Cambio de moneda"
            note={data.exchangeNotes.join(' · ')}
            amount={Math.abs(data.cambioMoneda)}
            currency={cur}
            tono={data.cambioMoneda > 0 ? 'ingreso' : 'egreso'}
            variacion={previous ? <span className="inline-block w-12" /> : undefined}
          />
        )}

        {/* Saldo final: monto, debajo la variación del período, y a la derecha vs el anterior */}
        <div className={`mx-4 mt-3 grid items-center gap-3 border-t border-black/10 pb-4 pt-4 sm:mx-5 sm:gap-4 dark:border-white/15 ${previous ? 'grid-cols-[minmax(0,1fr)_auto_auto]' : 'grid-cols-[minmax(0,1fr)_auto]'}`}>
          <p className="text-[17px] font-semibold text-[#1C1C1E] dark:text-white">Saldo final</p>
          <div className="relative text-right">
            <p className={`text-[22px] font-semibold tracking-tight tabular-nums ${TONO_MONTO.neta}`}>{fmtFull(data.saldoFinal, cur)}</p>
            <p className="absolute right-0 top-full -mt-0.5 whitespace-nowrap text-[10px] leading-none tabular-nums text-[#C7C7CC] dark:text-[#5A5A5E]">Variación {fmtFull(variacion, cur, true)}</p>
          </div>
          {previous && <Variacion actual={data.saldoFinal} anterior={previous.saldoFinal} vs={vs} />}
        </div>
      </Card>

      {/* Resumen en 4 tarjetitas: monto y, muy sutil, la variación vs el período anterior */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          ['Saldo inicial', data.saldoInicial, 'saldo', previous?.saldoInicial, false],
          ['Ingresos', data.totalIngresos, 'ingreso', previous?.ingresos, false],
          ['Egresos', data.totalEgresos, 'egreso', previous?.egresos, true],
          ['Saldo final', data.saldoFinal, 'neta', previous?.saldoFinal, false],
        ] as const).map(([titulo, monto, tono, anterior, inverse]) => (
          <Card key={titulo} className="px-4 py-3">
            <p className="text-[12px] text-[#8E8E93]">{titulo}</p>
            <p className={`mt-0.5 text-[17px] font-semibold tracking-tight tabular-nums ${TONO_MONTO[tono]}`}>{fmtFull(monto, cur)}</p>
            {previous && (
              <p className="mt-0.5 h-3 text-[9px] leading-3 opacity-60 [&>span:first-child]:w-auto [&>span:first-child]:text-left [&>span:first-child]:text-[9px]">
                <Variacion actual={monto} anterior={anterior} inverse={inverse} vs={vs} />
                <span className="ml-1 text-[#C7C7CC] dark:text-[#5A5A5E]">vs {previous.label}</span>
              </p>
            )}
          </Card>
        ))}
      </div>

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
                className={`grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3 border-b border-black/[0.06] px-4 py-3 text-[14px] transition last:border-b-0 sm:gap-4 sm:px-5 dark:border-white/[0.08] ${
                  activa ? 'bg-[#007AFF]/[0.08] dark:bg-[#0A84FF]/[0.15]' : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'
                }`}
              >
                <span className={`truncate ${activa ? 'font-semibold text-[#007AFF] dark:text-[#0A84FF]' : 'text-[#1C1C1E] dark:text-white'}`}>{a.name}</span>
                <span className="hidden w-28 text-right tabular-nums text-[#8E8E93] sm:inline">{fmtFull(a.inicio, cur)}</span>
                <span className="w-24 text-right font-medium tabular-nums text-[#1C1C1E] sm:w-28 dark:text-white">{fmtFull(a.cierre, cur)}</span>
                <span className={`relative w-24 text-right tabular-nums sm:w-28 ${v > 0.5 ? TONO_MONTO.ingreso : v < -0.5 ? TONO_MONTO.egreso : 'text-[#8E8E93]'}`}>
                  {fmtFull(v, cur, true)}
                  {Math.abs(a.inicio) >= 0.5 && Math.abs(v) >= 0.5 && (
                    <span className="absolute right-0 top-full -mt-[3px] text-[9.5px] leading-none text-[#C7C7CC] dark:text-[#5A5A5E]">{fmtPctEs((v / Math.abs(a.inicio)) * 100)}</span>
                  )}
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
                <span className={`relative w-24 text-right tabular-nums sm:w-28 ${v > 0.5 ? TONO_MONTO.ingreso : v < -0.5 ? TONO_MONTO.egreso : 'text-[#8E8E93]'}`}>
                  {fmtFull(v, cur, true)}
                  {Math.abs(ini) >= 0.5 && Math.abs(v) >= 0.5 && (
                    <span className="absolute right-0 top-full -mt-[3px] text-[9.5px] font-normal leading-none text-[#C7C7CC] dark:text-[#5A5A5E]">{fmtPctEs((v / Math.abs(ini)) * 100)}</span>
                  )}
                </span>
              </div>
            )
          })()}
        </Card>
      )}

      {open && <MovementsSheet {...open} currency={cur} onClose={() => setOpen(null)} />}
    </div>
    </ModoVariacion>
  )
}

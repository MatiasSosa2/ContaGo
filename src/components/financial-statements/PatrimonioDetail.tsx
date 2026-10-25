'use client'

import { useRouter } from 'next/navigation'
import type { BalanceRubro, BalanceSheet } from '@/server/balance/balance-sheet'
import { Card, IOS, KpiCard, SF_FONT, TONO_MONTO, TableRow, TableSection, TableSubRow, fmtFull, type TonoMonto } from './modern'
import { EncabezadoVariacion, ModoVariacion, Variacion } from './VariacionCol'
import AnimatedNumber from './AnimatedNumber'

export type BalanceTrends = { activo: number[]; pasivo: number[] }

type View = { currency: 'ARS' | 'USD'; rate: number | null; prevRate: number | null }

const variacionPct = (actual: number, anterior: number) => (anterior !== 0 ? ((actual - anterior) / Math.abs(anterior)) * 100 : null)


/**
 * Un rubro (Caja y bancos, Créditos a cobrar, Mercadería, Bienes de uso, Deudas): se despliega
 * con sus renglones. En créditos y deudas, tocar un cliente o proveedor abre su ficha en Créditos.
 */
function Rubro({ rubro, previo, base, view, tono, inverse = false, onAbrir }: {
  rubro: BalanceRubro
  previo?: BalanceRubro
  base: number
  view: View
  tono: TonoMonto
  inverse?: boolean
  onAbrir?: (nombre: string) => void
}) {
  const conv = (v: number, rate: number | null) => (view.currency === 'USD' ? (rate ? v / rate : 0) : v)
  const monto = conv(rubro.amount, view.rate)
  const pct = (v: number) => (base > 0 ? (v / base) * 100 : undefined)
  const cur = view.currency
  const abrible = rubro.key === 'creditos' || rubro.key === 'deudas'
  return (
    <TableRow
      label={rubro.label}
      amount={monto}
      pct={pct(rubro.amount)}
      currency={cur}
      tono={tono}
      variacion={<Variacion actual={monto} anterior={previo ? conv(previo.amount, view.prevRate) : undefined} inverse={inverse} />}
    >
      {rubro.items.length === 0
        ? <p className="px-4 py-1.5 text-[12px] text-[#AEAEB2] sm:px-5">Sin saldo</p>
        : rubro.items.map((it) => {
            const m = conv(it.amount, view.rate)
            const antes = previo?.items.find((p) => p.label === it.label)?.amount
            return (
              <TableSubRow
                key={it.label}
                label={it.note ? `${it.label} · ${it.note}` : it.label}
                amount={m}
                pct={pct(it.amount)}
                currency={cur}
                tono={tono}
                variacion={<Variacion actual={m} anterior={antes !== undefined ? conv(antes, view.prevRate) : undefined} inverse={inverse} />}
                onClick={abrible && onAbrir ? () => onAbrir(it.label) : undefined}
              />
            )
          })}
    </TableRow>
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
  const patrimonioPrev = conv(previous.patrimonio, previous.rate)
  const router = useRouter()
  // Ficha del cliente o proveedor en Créditos
  const abrirCredito = (nombre: string) => router.push(`/creditos?abrir=${encodeURIComponent(nombre)}`)

  if (sinCotizacion) {
    return (
      <Card className="px-5 py-8 text-center" >
        <p className="text-[15px] text-[#1C1C1E] dark:text-white" style={{ fontFamily: SF_FONT }}>Todavía no hay una cotización registrada</p>
        <p className="mt-1 text-[13px] text-[#8E8E93]" style={{ fontFamily: SF_FONT }}>Registrá una compra o venta de dólares (cambio de caja) para ver el patrimonio en dólares.</p>
      </Card>
    )
  }

  return (
    <ModoVariacion>
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
        {/* Encabezado: solo la columna de variación lleva título */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 pb-0.5 pt-2 text-[11px] text-[#AEAEB2] sm:gap-4 sm:px-5 dark:text-[#636366]">
          <span />
          <EncabezadoVariacion vs={prevLabel} />
        </div>

        <TableSection title="Activo" />
        {data.activo.map((r) => (
          <Rubro key={r.key} rubro={r} previo={previous.activo.find((p) => p.key === r.key)} base={data.totalActivo} view={view} tono="ingreso" onAbrir={abrirCredito} />
        ))}

        <TableSection title="Pasivo" />
        {data.pasivo.map((r) => (
          <Rubro key={r.key} rubro={r} previo={previous.pasivo.find((p) => p.key === r.key)} base={data.totalActivo} view={view} tono="egreso" inverse onAbrir={abrirCredito} />
        ))}

        {/* Patrimonio neto: monto, debajo cómo se forma, y a la derecha la variación */}
        <div className="mx-4 mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-t border-black/10 pb-4 pt-4 sm:mx-5 sm:gap-4 dark:border-white/15">
          <p className="text-[17px] font-semibold text-[#1C1C1E] dark:text-white">Patrimonio neto</p>
          <div className="relative text-right">
            <p className={`text-[22px] font-semibold tracking-tight tabular-nums ${TONO_MONTO.neta}`}>
              <AnimatedNumber value={patrimonio} format={(v) => fmtFull(v, currency)} />
            </p>
            <p className="absolute right-0 top-full -mt-0.5 whitespace-nowrap text-[10px] leading-none text-[#C7C7CC] dark:text-[#5A5A5E]">Activo − Pasivo</p>
          </div>
          <Variacion actual={patrimonio} anterior={patrimonioPrev} vs={prevLabel} />
        </div>
      </Card>

      {/* Resumen en 3 tarjetitas: monto y, muy sutil, la variación vs el cierre anterior */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        {([
          ['Activo', activo, activoPrev, 'ingreso', false],
          ['Pasivo', pasivo, pasivoPrev, 'egreso', true],
          ['Patrimonio neto', patrimonio, patrimonioPrev, 'neta', false],
        ] as const).map(([titulo, monto, antes, tono, inverse]) => (
          <Card key={titulo} className="px-4 py-3">
            <p className="truncate text-[12px] text-[#8E8E93]">{titulo}</p>
            <p className={`mt-0.5 break-words text-[15px] font-semibold tracking-tight tabular-nums sm:text-[17px] ${TONO_MONTO[tono]}`}>{fmtFull(monto, currency)}</p>
            <p className="mt-0.5 flex h-3 items-center gap-1 text-[9px] leading-3 opacity-60">
              <Variacion actual={monto} anterior={antes} inverse={inverse} vs={prevLabel} className="!w-auto !text-left !text-[9px]" />
              <span className="text-[#C7C7CC] dark:text-[#5A5A5E]">vs {prevLabel}</span>
            </p>
          </Card>
        ))}
      </div>

      {currency === 'USD' && data.rate && (
        <p className="px-1 text-[12px] text-[#8E8E93]">Convertido a US$1 = ${data.rate.toLocaleString('es-AR')} (última cotización registrada)</p>
      )}
    </div>
    </ModoVariacion>
  )
}

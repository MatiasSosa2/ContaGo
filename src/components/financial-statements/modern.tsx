/**
 * Piezas visuales de los estados, estilo Apple: tipografía del sistema, tarjetas
 * redondeadas sin bordes, tablas con líneas finitas y colores iOS solo en los detalles.
 */
import type { ReactNode } from 'react'

export const SF_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", system-ui, sans-serif'

export const IOS = {
  green: '#34C759',
  red: '#FF3B30',
  orange: '#FF9F0A',
  blue: '#0A84FF',
  /** Celeste: color de la ganancia neta */
  cyan: '#32ADE6',
  /** Celeste oscuro de la ganancia neta en el Estado de resultados (cuadro y gráfico) */
  neta: '#0E7C9E',
} as const

const SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$' }

/** Monto completo: $27.485.000 · con signo opcional (+ / −) */
export function fmtFull(value: number, currency = 'ARS', signed = false) {
  const n = `${SYMBOL[currency] ?? '$'}${Math.abs(Math.round(value)).toLocaleString('es-AR')}`
  if (signed) return `${value >= 0 ? '+' : '−'}${n}`
  return value < 0 ? `−${n}` : n
}

export function fmtPctEs(value: number) {
  return `${value.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

/** Tarjeta blanca redondeada, sin borde, con sombra casi imperceptible */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.03)] dark:bg-[#1C1C1E] dark:shadow-none ${className}`}>
      {children}
    </div>
  )
}

/** Mini gráfico de tendencia (últimos meses) */
function Sparkline({ values, color, alto = 28 }: { values: number[]; color: string; alto?: number }) {
  if (values.length < 2) return <div style={{ height: alto }} />
  const w = 120
  const h = alto
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 3 - ((v - min) / span) * (h - 6)}`)
  const last = pts[pts.length - 1].split(',')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: alto }} preserveAspectRatio="none" aria-hidden>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />
    </svg>
  )
}

/** Tarjeta de un indicador: título, monto, variación vs el período anterior, nota y tendencia */
export function KpiCard({ label, value, note, trend, color, delta }: {
  label: string
  value: ReactNode
  note?: string
  trend: number[]
  color: string
  /** Variación % contra el período anterior (null = sin datos para comparar).
   *  inverse: subir es malo (ej. el pasivo), así que sube = rojo y baja = verde */
  delta?: { pct: number | null; vs: string; inverse?: boolean }
}) {
  return (
    <Card className="flex flex-col px-4 pb-3 pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] text-[#8E8E93]">{label}</p>
        {delta && delta.pct !== null && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${(delta.inverse ? delta.pct <= 0 : delta.pct >= 0) ? 'bg-[#34C759]/[0.12] text-[#248A3D] dark:text-[#30D158]' : 'bg-[#FF3B30]/[0.12] text-[#D70015] dark:text-[#FF453A]'}`}
            title={`Contra ${delta.vs}`}
          >
            {delta.pct >= 0 ? '▲' : '▼'} {Math.abs(delta.pct).toLocaleString('es-AR', { maximumFractionDigits: 0 })}% <span className="font-normal opacity-70">vs {delta.vs}</span>
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[20px] font-semibold tracking-tight tabular-nums text-[#1C1C1E] sm:text-[22px] dark:text-white">{value}</p>
      {note && <p className="h-4 text-[12px] tabular-nums text-[#8E8E93]">{note}</p>}
      <div className="mt-2"><Sparkline values={trend} color={color} alto={note ? 28 : 46} /></div>
    </Card>
  )
}

/**
 * Colores sutiles del cuadro de resultados (solo en los montos): lo que entra en verde oscuro,
 * lo que sale en rojo oscuro (sin signo) y las ganancias en azul.
 */
export type TonoMonto = 'ingreso' | 'egreso' | 'ganancia' | 'neta' | 'perdida' | 'saldo'
export const TONO_MONTO: Record<TonoMonto, string> = {
  ingreso: 'text-[#3E7D5A] dark:text-[#8FC0A4]',
  egreso: 'text-[#A3483F] dark:text-[#E89A92]',
  ganancia: 'text-[#1E5E8A] dark:text-[#7CBBE0]',
  neta: 'text-[#0E7C9E] dark:text-[#5FCBEA]',
  perdida: 'text-[#A3483F] dark:text-[#E89A92]',
  /** Saldos de caja: gris oscuro neutro */
  saldo: 'text-[#3C3C43] dark:text-[#EBEBF5]',
}

export { Variacion } from './VariacionCol'

/** Título de sección dentro de la tabla (ej. "Otros ingresos") */
export function TableSection({ title }: { title: string }) {
  return <p className="px-4 pb-1.5 pt-5 text-[12px] font-medium uppercase tracking-wide text-[#8E8E93] sm:px-5">{title}</p>
}

/**
 * Renglón de la tabla. level 1 = con sangría (detalle); strong = subtotal en negrita.
 * Los subtotales se distinguen por peso de letra, no por fondos de color.
 */
export function TableRow({ label, amount, pct, currency, level = 0, strong = false, tone, signed = false, note, pctColumn = true, tono, variacion, onClick, children }: {
  label: string
  amount: number
  pct?: number
  currency: string
  level?: 0 | 1 | 2
  strong?: boolean
  tone?: 'positive' | 'negative'
  /** Mostrar el signo + / − */
  signed?: boolean
  /** Aclaración chica debajo del nombre */
  note?: string
  /** false = cuadro sin columna de % (los montos quedan pegados al borde) */
  pctColumn?: boolean
  /** Color sutil del monto (cuadro de resultados) */
  tono?: TonoMonto
  /** Columna de variación vs el período anterior (si se pasa, la tabla tiene esa columna) */
  variacion?: ReactNode
  /** Sin desplegable: tocar el renglón hace esto (ej. ver sus movimientos) */
  onClick?: () => void
  /** Detalle (subcategorías): el renglón se despliega */
  children?: ReactNode
}) {
  const amountColor = tono
    ? TONO_MONTO[tono]
    : tone === 'negative'
      ? 'text-[#8E8E93]'
      : tone === 'positive' && strong ? 'text-[#248A3D] dark:text-[#30D158]' : 'text-[#1C1C1E] dark:text-white'
  const content = (
    <>
      <span className={`flex min-w-0 items-center gap-1.5 ${tono ? '' : level === 1 ? 'pl-4' : level === 2 ? 'pl-8' : ''}`}>
        {tono ? null : children ? (
          <svg className="h-2.5 w-2.5 shrink-0 text-[#C7C7CC] transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        ) : level > 0 ? (
          // Mismo lugar que la flechita, así los renglones de detalle quedan alineados
          <span className="w-2.5 shrink-0" aria-hidden />
        ) : null}
        <span className="min-w-0">
          <span className={`block truncate ${strong ? 'font-semibold text-[#1C1C1E] dark:text-white' : level > 0 ? 'text-[#3C3C43] dark:text-[#EBEBF5]/80' : 'text-[#1C1C1E] dark:text-white'}`}>{label}</span>
          {note && <span className="block truncate text-[12px] text-[#8E8E93]">{note}</span>}
        </span>
      </span>
      {tono ? (
        // Monto y, debajo, su peso sobre las ventas (chiquito y gris)
        <span className="relative text-right">
          <span className={`block text-[15px] tabular-nums ${strong ? 'font-semibold' : ''} ${amountColor}`}>{fmtFull(amount, currency, signed)}</span>
          {pct !== undefined && <span className="absolute right-0 top-full -mt-[3px] text-[9.5px] leading-none tabular-nums text-[#C7C7CC] dark:text-[#5A5A5E]">{fmtPctEs(pct)}</span>}
        </span>
      ) : (
        <span className={`text-right tabular-nums ${strong ? 'font-semibold' : ''} ${amountColor}`}>{fmtFull(amount, currency, signed)}</span>
      )}
      {!tono && pctColumn && <span className="hidden w-14 text-right text-[12px] tabular-nums text-[#8E8E93] sm:inline">{pct !== undefined ? fmtPctEs(pct) : ''}</span>}
      {variacion}
    </>
  )
  const cols = tono
    ? (variacion ? 'grid-cols-[minmax(0,1fr)_auto_auto]' : 'grid-cols-[minmax(0,1fr)_auto]')
    : `grid-cols-[minmax(0,1fr)_auto] ${pctColumn ? 'sm:grid-cols-[minmax(0,1fr)_auto_auto]' : ''}`
  const rowCls = `grid ${cols} items-center gap-3 px-4 ${tono ? 'py-3' : 'py-2.5'} text-[14px] sm:gap-4 sm:px-5`
  if (!children) {
    if (onClick) {
      return (
        <button type="button" onClick={onClick} className={`${rowCls} w-full border-b border-black/[0.06] text-left transition-colors last:border-b-0 hover:bg-black/[0.02] dark:border-white/[0.08] dark:hover:bg-white/[0.03]`}>
          {content}
        </button>
      )
    }
    return <div className={`${rowCls} border-b border-black/[0.06] last:border-b-0 dark:border-white/[0.08]`}>{content}</div>
  }
  return (
    <details className="group border-b border-black/[0.06] last:border-b-0 dark:border-white/[0.08]">
      <summary className={`${rowCls} cursor-pointer list-none transition-colors [&::-webkit-details-marker]:hidden ${tono ? 'hover:bg-black/[0.02] dark:hover:bg-white/[0.03]' : ''}`}>{content}</summary>
      <div className="pb-1">{children}</div>
    </details>
  )
}

/** Renglón de detalle dentro de uno desplegable */
export function TableSubRow({ label, amount, pct, currency, pctColumn = true, tono, variacion, onClick }: {
  label: string; amount: number; pct?: number; currency: string; pctColumn?: boolean
  tono?: TonoMonto
  variacion?: ReactNode
  /** Tocar el renglón hace esto (ej. ver sus movimientos) */
  onClick?: () => void
}) {
  const cols = tono
    ? (variacion ? 'grid-cols-[minmax(0,1fr)_auto_auto]' : 'grid-cols-[minmax(0,1fr)_auto]')
    : `grid-cols-[minmax(0,1fr)_auto] ${pctColumn ? 'sm:grid-cols-[minmax(0,1fr)_auto_auto]' : ''}`
  return (
    // Detalle del desplegable: más chico y apagado que las filas principales
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick() } : undefined}
      className={`grid ${cols} items-center gap-3 px-4 ${tono ? 'py-1.5 text-[12px]' : 'py-1.5 text-[13px]'} sm:gap-4 sm:px-5 ${onClick ? 'cursor-pointer transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]' : ''}`}
    >
      <span className={`truncate ${tono ? 'text-[#AEAEB2] dark:text-[#636366]' : 'pl-6 text-[#8E8E93] sm:pl-8'}`}>{label}</span>
      {tono ? (
        // Detalle: el mismo color que su línea, más apagado; el % debajo
        <span className="relative text-right">
          <span className={`block tabular-nums ${TONO_MONTO[tono]} opacity-60`}>{fmtFull(amount, currency)}</span>
          {pct !== undefined && <span className="absolute right-0 top-full -mt-[2px] text-[8.5px] leading-none tabular-nums text-[#D1D1D6] dark:text-[#4A4A4E]">{fmtPctEs(pct)}</span>}
        </span>
      ) : (
        <span className="text-right tabular-nums text-[#8E8E93]">{fmtFull(amount, currency)}</span>
      )}
      {!tono && pctColumn && <span className="hidden w-14 text-right text-[11px] tabular-nums text-[#AEAEB2] sm:inline dark:text-[#636366]">{pct !== undefined ? fmtPctEs(pct) : ''}</span>}
      {/* La variación del detalle, todavía más tenue */}
      {tono && variacion ? <span className="text-[9.5px] opacity-75 [&>span]:text-[9.5px]">{variacion}</span> : variacion}
    </div>
  )
}

/** Encabezado simple de la página de un estado: "‹ Título" y el período en gris */
export function StatementHeader({ title, period, backHref, actions }: { title: string; period: string; backHref: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3" style={{ fontFamily: SF_FONT }}>
      <div>
        <a href={backHref} className="inline-flex items-center gap-0.5 text-[15px] text-[#007AFF] transition hover:opacity-70 dark:text-[#0A84FF]">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Informes
        </a>
        <h1 className="mt-1 text-[24px] font-bold leading-tight tracking-tight text-[#1C1C1E] sm:text-[28px] dark:text-white">{title}</h1>
        <p className="text-[15px] text-[#8E8E93]">{period}</p>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  )
}

/** Monto en millones con 1 decimal, sin símbolo: 2.799.210 → "2,8 M" */
export function fmtMillones(value: number) {
  return `${(Math.abs(value) / 1_000_000).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M`
}

/**
 * Variación sutil: flechita chica con color y el monto en millones en gris claro.
 * Verde si mejoró, rojo si empeoró; inverse = subir es malo (ej. deudas).
 */
export function SubtleDelta({ value, inverse = false, className = '' }: { value: number; inverse?: boolean; className?: string }) {
  if (Math.abs(value) < 0.5) return <span className={`inline-flex justify-end text-[11px] text-[#C7C7CC] dark:text-[#48484A] ${className}`}>—</span>
  const mejoro = inverse ? value < 0 : value > 0
  return (
    <span className={`inline-flex items-baseline justify-end gap-1 text-[11px] tabular-nums text-[#AEAEB2] dark:text-[#636366] ${className}`}>
      <span className={`text-[8px] ${mejoro ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>{value > 0 ? '▲' : '▼'}</span>
      {fmtMillones(value)}
    </span>
  )
}

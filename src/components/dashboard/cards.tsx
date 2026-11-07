import type { ReactNode } from 'react'

/**
 * Piezas de las tarjetas del Inicio, con el mismo estilo iOS que Informes: fondo blanco,
 * esquinas de 16 px, sombra muy suave y sin bordes de color. Sirven en servidor y cliente.
 */

export const CARD_CLS =
  'rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.03)] dark:bg-[#1C1C1E] dark:shadow-none'

/** Tarjeta que se puede tocar (lleva a otra pestaña o abre un detalle) */
export const CARD_LINK_CLS =
  `${CARD_CLS} group flex min-h-[132px] w-full min-w-0 flex-col p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(0,0,0,0.04),0_10px_24px_rgba(0,0,0,0.06)] active:scale-[0.99] dark:hover:bg-[#232325]`

/** Monto principal de las tarjetas del resumen */
export const SUMMARY_VALUE_CLS =
  'truncate text-[clamp(18px,1.6vw,24px)] font-semibold tracking-[-0.03em] tabular-nums text-[#1C1C1E] dark:text-white'

export type CardTone = 'income' | 'expense' | 'brand'

const TONE_ICON: Record<CardTone, string> = {
  income: 'bg-[var(--income)]/[0.1] text-[var(--income)]',
  expense: 'bg-[var(--expense)]/[0.1] text-[var(--expense)]',
  // Neutro: gris, sin el verde de la marca
  brand: 'bg-black/[0.05] text-[#636366] dark:bg-white/[0.08] dark:text-[#AEAEB2]',
}

/**
 * Ícono en círculo suave + etiqueta en gris (sin mayúsculas). A la derecha va `right` (ej. la
 * variación) o, si no hay, una flechita que aparece al pasar el mouse.
 */
export function CardHeader({ icon, label, tone = 'brand', right }: { icon: ReactNode; label: string; tone?: CardTone; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full [&>svg]:h-3.5 [&>svg]:w-3.5 ${TONE_ICON[tone]}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#8E8E93]">{label}</span>
      {right ?? (
        <svg className="h-3.5 w-3.5 shrink-0 text-[#C7C7CC] opacity-0 transition-opacity group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </div>
  )
}

/**
 * Variación mínima contra el período anterior: solo flechita y %, en verde o rojo suave.
 * `inverso`: que suba es malo (ej. deudas). Sin valor anterior no se muestra nada.
 */
export function Delta({ actual, anterior, inverso = false }: { actual: number; anterior: number | null; inverso?: boolean }) {
  if (anterior === null || anterior === 0) return null
  const pct = ((actual - anterior) / Math.abs(anterior)) * 100
  if (!Number.isFinite(pct)) return null
  const sube = pct >= 0
  const bueno = inverso ? !sube : sube
  return (
    <span
      title="vs período anterior"
      className={`shrink-0 text-[11px] font-medium tabular-nums opacity-80 ${bueno ? 'text-[var(--income)]' : 'text-[var(--expense)]'}`}
    >
      {sube ? '↑' : '↓'} {Math.abs(pct).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
    </span>
  )
}

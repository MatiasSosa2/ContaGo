'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

/**
 * Columna de variación de los estados (ER, EFE y EP): por defecto en millones (▲ 8,0 M) y,
 * tocando las flechitas del título, en % (▲ 12%). La elección vale para todo el cuadro y sus
 * tarjetitas; no se guarda (cada vez arranca en millones).
 */
type Modo = 'M' | '%'
const ModoCtx = createContext<{ modo: Modo; cambiar: () => void }>({ modo: 'M', cambiar: () => {} })

export function ModoVariacion({ children }: { children: ReactNode }) {
  const [modo, setModo] = useState<Modo>('M')
  return <ModoCtx.Provider value={{ modo, cambiar: () => setModo((m) => (m === 'M' ? '%' : 'M')) }}>{children}</ModoCtx.Provider>
}

const fmtM = (v: number) => `${(Math.abs(v) / 1_000_000).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M`
const fmtPesos = (v: number) => `$${Math.round(Math.abs(v)).toLocaleString('es-AR')}`

/** Título de la columna: "‹ vs ago ›" muy tenue; tocar una flechita cambia entre M y % */
export function EncabezadoVariacion({ vs }: { vs: string }) {
  const { modo, cambiar } = useContext(ModoCtx)
  const flecha = (d: string) => (
    <button
      type="button"
      onClick={cambiar}
      aria-label={modo === 'M' ? 'Ver la variación en %' : 'Ver la variación en millones'}
      className="px-0.5 text-[#D1D1D6] transition-colors hover:text-[#8E8E93] dark:text-[#48484A] dark:hover:text-[#8E8E93]"
    >
      {d}
    </button>
  )
  return (
    <span className="inline-flex w-14 items-center justify-end text-[10px]" title={modo === 'M' ? 'En millones' : 'En %'}>
      {flecha('‹')}
      <span className="mx-0.5 whitespace-nowrap">vs {vs}</span>
      {flecha('›')}
    </span>
  )
}

/** Variación contra el período anterior (verde si es buena, rojo si es mala) */
export function Variacion({ actual, anterior, inverse = false, vs, className = '' }: {
  actual: number
  anterior?: number
  /** Subir es malo (gastos, egresos, deudas) */
  inverse?: boolean
  vs?: string
  className?: string
}) {
  const { modo } = useContext(ModoCtx)
  const base = `inline-block w-14 text-right text-[10px] tabular-nums ${className}`
  const diff = actual - (anterior ?? 0)
  const pct = anterior !== undefined && Math.abs(anterior) >= 0.5 ? (diff / Math.abs(anterior)) * 100 : null
  // En %: sin dato anterior no hay contra qué comparar
  if (modo === '%' && pct === null) return <span className={`${base} text-[#D1D1D6] dark:text-[#48484A]`}>—</span>
  if (Math.abs(diff) < 0.5 || (modo === '%' && Math.abs(pct!) < 0.5)) {
    return <span className={`${base} text-[#C7C7CC]`} title={vs ? `Igual que ${vs}` : undefined}>=</span>
  }
  const bueno = inverse ? diff < 0 : diff > 0
  const texto = modo === 'M'
    ? fmtM(diff)
    : `${Math.abs(pct!) >= 999 ? '+999' : Math.abs(pct!).toLocaleString('es-AR', { maximumFractionDigits: 0 })}%`
  return (
    <span
      className={`${base} opacity-70 ${bueno ? 'text-[#3E7D5A] dark:text-[#8FC0A4]' : 'text-[#A3483F] dark:text-[#E89A92]'}`}
      title={vs && anterior !== undefined ? `Contra ${vs}: ${fmtPesos(anterior)}` : undefined}
    >
      {diff > 0 ? '▲' : '▼'} {texto}
    </span>
  )
}

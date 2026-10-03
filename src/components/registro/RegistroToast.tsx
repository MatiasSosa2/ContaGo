'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { undoRegistro } from '@/app/actions'
import type { Registrado } from '@/lib/registro'

const DURACION_MS = 5000
const SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$' }

function fmt(value: number, currency = 'ARS') {
  return `${SYMBOL[currency] ?? '$'}${Math.round(Math.abs(value)).toLocaleString('es-AR')}`
}

type Estado = 'visible' | 'deshaciendo' | 'deshecho' | 'error'

/**
 * Aviso estilo iOS al pie de la pantalla: "✓ Venta registrada · $45.000" con Deshacer.
 * Se va solo a los 5 segundos; Deshacer revierte por completo el registro.
 */
export default function RegistroToast({ registro, tone, onDismiss }: {
  registro: Registrado
  /** Clase de acento (reg-income / reg-expense / reg-neutral) */
  tone: string
  onDismiss: () => void
}) {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>('visible')
  const [error, setError] = useState('')
  const [closing, setClosing] = useState(false)
  const dismissRef = useRef(onDismiss)
  useEffect(() => { dismissRef.current = onDismiss }, [onDismiss])

  // Se va solo (salvo mientras se está deshaciendo)
  useEffect(() => {
    if (estado === 'deshaciendo') return
    const ms = estado === 'visible' ? DURACION_MS : 1800
    const t = setTimeout(() => setClosing(true), ms)
    return () => clearTimeout(t)
  }, [estado])

  useEffect(() => {
    if (!closing) return
    const t = setTimeout(() => dismissRef.current(), 200)
    return () => clearTimeout(t)
  }, [closing])

  const deshacer = async () => {
    if (!registro.undo || estado !== 'visible') return
    setEstado('deshaciendo')
    const res = await undoRegistro(registro.undo)
    if (res.success) {
      setEstado('deshecho')
      router.refresh()
    } else {
      setError(res.error || 'No se pudo deshacer')
      setEstado('error')
    }
  }

  const texto =
    estado === 'deshecho' ? 'Registro deshecho'
      : estado === 'error' ? error
      : `${registro.titulo}${registro.monto ? ` · ${fmt(registro.monto, registro.currency)}` : ''}`

  return (
    <div
      role="status"
      aria-live="polite"
      data-closing={closing || undefined}
      className={`reg-toast ${tone} fixed bottom-24 left-1/2 z-[70] flex w-[calc(100%-2rem)] max-w-md items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl dark:bg-[#2C2C2E]/95 md:bottom-8`}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif' }}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${estado === 'error' ? 'bg-[#FF9500]' : estado === 'deshecho' ? 'bg-[#8E8E93]' : 'bg-[var(--reg-accent)]'}`}
        aria-hidden
      >
        {estado === 'error' ? (
          <span className="text-[13px] font-bold">!</span>
        ) : estado === 'deshecho' ? (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-[#1C1C1E] dark:text-white">{texto}</p>
        {registro.detalle && estado === 'visible' && (
          <p className="truncate text-[13px] text-[#8E8E93]">{registro.detalle}</p>
        )}
      </div>

      {registro.undo && (estado === 'visible' || estado === 'deshaciendo') && (
        <button
          type="button"
          onClick={deshacer}
          disabled={estado === 'deshaciendo'}
          className="shrink-0 text-[15px] font-semibold text-[#007AFF] transition-opacity active:opacity-60 disabled:opacity-50 dark:text-[#0A84FF]"
        >
          {estado === 'deshaciendo' ? 'Deshaciendo…' : 'Deshacer'}
        </button>
      )}
    </div>
  )
}

'use client'

import { useEffect } from 'react'

type Props = {
  open: boolean
  clienteNombre: string
  onClose: () => void
  tipo?: 'cliente' | 'proveedor'
}

export default function DeudaSaldadaModal({ open, clienteNombre, onClose, tipo = 'cliente' }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-zinc-950">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-military/10">
          <svg className="h-7 w-7 text-brand-military" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-black text-gray-900 dark:text-white">Deuda saldada</h3>
        <p className="mb-5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          Listo. <span className="font-bold text-gray-800 dark:text-gray-100">{clienteNombre}</span>{' '}
          {tipo === 'proveedor' ? 'ya no te reclama ni un mate. Cuenta saldada.' : 'ya no te debe ni un mate. Borrón y cuenta nueva.'}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-brand-military py-3 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-brand-military-dark"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}

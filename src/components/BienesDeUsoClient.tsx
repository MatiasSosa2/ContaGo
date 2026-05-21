'use client'

import { useState, useTransition } from 'react'
import { createBienDeUso, deleteBienDeUso, getBienesDeUso } from '@/app/actions'

type Bien = {
  id: string
  nombre: string
  descripcion: string | null
  categoria: string | null
  marca: string | null
  valorAdquisicion: number
  valorResidual: number
  depreciacionAcumulada: number
  fechaAdquisicion: Date | string
  vidaUtilMeses: number | null
  activo: boolean
}

function fmt(v: number) {
  return v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('es-AR')
}

export default function BienesDeUsoClient({ initialBienes }: { initialBienes: Bien[] }) {
  const [bienes, setBienes] = useState<Bien[]>(initialBienes)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  async function reload() {
    const data = await getBienesDeUso()
    setBienes(data as Bien[])
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await createBienDeUso(fd)
      if (!res.success) { setError(res.error || 'Error'); return }
      setError('')
      setShowForm(false)
      await reload()
    })
  }

  function handleDelete(id: string) {
    if (!confirm('¿Dar de baja este bien de uso?')) return
    startTransition(async () => {
      await deleteBienDeUso(id)
      await reload()
    })
  }

  const activos = bienes.filter((b) => b.activo)
  const totalValor = activos.reduce((s, b) => s + (b.valorAdquisicion - b.depreciacionAcumulada), 0)

  return (
    <div className="mt-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">Total activos</p>
          <p className="font-mono text-2xl font-bold text-[#1F2937] dark:text-white">${fmt(totalValor)}</p>
          <p className="text-xs text-[#9CA3AF]">{activos.length} bien{activos.length === 1 ? '' : 'es'} en uso</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-xl bg-brand-military px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-brand-military-dark"
        >
          + Nuevo bien
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm dark:border-white/[0.06] dark:bg-zinc-950">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-3 border-b border-[#E5E7EB] px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] dark:border-white/10">
          <span>Bien</span>
          <span className="text-right">Valor adq.</span>
          <span className="text-right">Depreciación</span>
          <span className="text-right">Valor neto</span>
          <span>Adquisición</span>
          <span></span>
        </div>
        {activos.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-[#9CA3AF]">No hay bienes de uso registrados.</div>
        ) : (
          activos.map((b) => {
            const valorNeto = b.valorAdquisicion - b.depreciacionAcumulada
            return (
              <div key={b.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] items-center gap-3 border-t border-[#F3F4F6] px-5 py-3 dark:border-white/[0.04]">
                <div>
                  <p className="font-semibold text-[#1F2937] dark:text-white">{b.nombre}</p>
                  <p className="text-[11px] text-[#9CA3AF]">
                    {[b.marca, b.categoria].filter(Boolean).join(' · ') || 'Sin categoría'}
                  </p>
                </div>
                <span className="text-right font-mono text-sm text-[#1F2937] dark:text-gray-200">${fmt(b.valorAdquisicion)}</span>
                <span className="text-right font-mono text-sm text-[#9CA3AF]">${fmt(b.depreciacionAcumulada)}</span>
                <span className="text-right font-mono text-sm font-bold text-brand-military-dark">${fmt(valorNeto)}</span>
                <span className="text-xs text-[#6B7280]">{fmtDate(b.fechaAdquisicion)}</span>
                <button
                  onClick={() => handleDelete(b.id)}
                  className="rounded-lg p-1.5 text-[#9CA3AF] hover:bg-red-50 hover:text-red-600"
                  aria-label="Dar de baja"
                  disabled={isPending}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                  </svg>
                </button>
              </div>
            )
          })
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-zinc-950">
            <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-b from-brand-military to-brand-military-dark px-5 pb-4 pt-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Nuevo bien de uso</h3>
              <button onClick={() => setShowForm(false)} className="text-lg leading-none text-white/60 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 p-5">
              <div className="col-span-2">
                <Field name="nombre" label="Nombre *" required />
              </div>
              <Field name="categoria" label="Categoría" />
              <Field name="marca" label="Marca / Modelo" />
              <Field name="valorAdquisicion" label="Valor adquisición *" type="number" step="0.01" required />
              <Field name="valorResidual" label="Valor residual" type="number" step="0.01" />
              <Field name="fechaAdquisicion" label="Fecha adquisición" type="date" />
              <Field name="vidaUtilMeses" label="Vida útil (meses)" type="number" />
              <div className="col-span-2">
                <Field name="descripcion" label="Descripción" />
              </div>
              {error && (
                <div className="col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 dark:border-red-900 dark:bg-red-950/30">
                  {error}
                </div>
              )}
              <div className="col-span-2 flex justify-end gap-3 border-t border-[#E5E7EB] pt-3 dark:border-white/10">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-[#E5E7EB] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#6B7280] hover:border-gray-400 dark:border-white/10 dark:text-gray-400">
                  Cancelar
                </button>
                <button type="submit" disabled={isPending} className="rounded-xl bg-brand-military px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-brand-military-dark disabled:opacity-50">
                  Crear bien
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ name, label, type = 'text', step, required }: { name: string; label: string; type?: string; step?: string; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">{label}</label>
      <input
        name={name}
        type={type}
        step={step}
        required={required}
        className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm font-mono text-[#1F2937] outline-none transition focus:border-brand-military dark:border-white/10 dark:bg-[#1F1F1F] dark:text-[#E8E8E8]"
      />
    </div>
  )
}

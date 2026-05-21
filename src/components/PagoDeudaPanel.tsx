'use client'

import { useEffect, useMemo, useState } from 'react'
import { getProveedoresConDeudaPendiente } from '@/app/actions'

export type ProveedorConDeuda = {
  contactId: string
  nombre: string
  taxId: string | null
  deudaTotal: number
  deudas: {
    id: string
    description: string
    amount: number
    saldoPendiente: number
    fechaVencimiento: Date | string | null
    date: Date | string
    estado: string
  }[]
}

type Props = {
  selectedProveedorId: string
  selectedDeudaId: string
  onSelectProveedor: (id: string) => void
  onSelectDeuda: (id: string, saldoPendiente: number, contactId: string) => void
}

export default function PagoDeudaPanel({ selectedProveedorId, selectedDeudaId, onSelectProveedor, onSelectDeuda }: Props) {
  const [proveedores, setProveedores] = useState<ProveedorConDeuda[] | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    let cancel = false
    getProveedoresConDeudaPendiente().then((data) => {
      if (!cancel) setProveedores(data as ProveedorConDeuda[])
    })
    return () => { cancel = true }
  }, [])

  const filtered = useMemo(() => {
    if (!proveedores) return []
    if (!q.trim()) return proveedores
    const ql = q.toLowerCase()
    return proveedores.filter((p) => p.nombre.toLowerCase().includes(ql) || (p.taxId ?? '').includes(q))
  }, [proveedores, q])

  const proveedor = proveedores?.find((p) => p.contactId === selectedProveedorId)

  if (proveedores === null) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-black/[0.06] bg-gray-50/80 p-6">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-military border-t-transparent" />
      </div>
    )
  }

  if (proveedores.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        No tenés proveedores con deudas pendientes. Registrá una compra a crédito antes de poder pagarla.
      </div>
    )
  }

  if (!proveedor) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-gray-50/80 p-4 dark:border-white/[0.06] dark:bg-zinc-800/50">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Elegí el proveedor</p>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o CUIT..."
          className="w-full rounded-xl border border-black/[0.08] bg-white py-2.5 px-3 text-sm outline-none focus:border-brand-military dark:border-white/10 dark:bg-zinc-900"
        />
        <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
          {filtered.map((p) => (
            <button
              key={p.contactId}
              type="button"
              onClick={() => onSelectProveedor(p.contactId)}
              className="flex items-center justify-between rounded-xl border border-black/[0.06] bg-white px-3 py-2.5 text-left transition-colors hover:border-brand-military hover:bg-brand-military/5 dark:bg-zinc-900"
            >
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{p.nombre}</p>
                {p.taxId && <p className="text-[11px] text-gray-400">{p.taxId}</p>}
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Le debés</p>
                <p className="font-mono text-sm font-bold text-brand-oxide">${p.deudaTotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-gray-400">Sin coincidencias</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-gray-50/80 p-4 dark:border-white/[0.06] dark:bg-zinc-800/50">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Proveedor</p>
          <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{proveedor.nombre}</p>
        </div>
        <button
          type="button"
          onClick={() => onSelectProveedor('')}
          className="text-[10px] font-bold uppercase tracking-wider text-brand-military hover:underline"
        >
          Cambiar
        </button>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-brand-oxide/20 bg-[#FDF2F0] px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-oxide">Deuda total</span>
        <span className="font-mono text-sm font-black text-brand-oxide">
          ${proveedor.deudaTotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Elegí la deuda a pagar</p>
      <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
        {proveedor.deudas.map((d) => {
          const fecha = d.date instanceof Date ? d.date : new Date(d.date)
          const venc = d.fechaVencimiento ? (d.fechaVencimiento instanceof Date ? d.fechaVencimiento : new Date(d.fechaVencimiento)) : null
          const isSelected = selectedDeudaId === d.id
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelectDeuda(d.id, d.saldoPendiente, proveedor.contactId)}
              className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors ${
                isSelected
                  ? 'border-brand-military bg-brand-military/10'
                  : 'border-black/[0.06] bg-white hover:border-brand-military hover:bg-brand-military/5 dark:bg-zinc-900'
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{d.description || 'Compra a crédito'}</p>
                <p className="text-[11px] text-gray-400">
                  {fecha.toLocaleDateString('es-AR')}
                  {venc && ` · vence ${venc.toLocaleDateString('es-AR')}`}
                  {d.estado === 'PARCIAL' && ' · parcialmente pagada'}
                  {d.estado === 'VENCIDO' && ' · VENCIDA'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Saldo</p>
                <p className="font-mono text-sm font-bold text-brand-military-dark">
                  ${d.saldoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

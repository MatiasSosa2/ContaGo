'use client'

import { useEffect, useMemo, useState } from 'react'
import { getClientesConCreditoPendiente } from '@/app/actions'

export type ClienteConCredito = {
  contactId: string
  nombre: string
  taxId: string | null
  deudaTotal: number
  creditos: {
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
  selectedClienteId: string
  selectedCreditoId: string
  onSelectCliente: (id: string) => void
  onSelectCredito: (id: string, saldoPendiente: number, contactId: string) => void
}

export default function CobroCreditoPanel({ selectedClienteId, selectedCreditoId, onSelectCliente, onSelectCredito }: Props) {
  const [clientes, setClientes] = useState<ClienteConCredito[] | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    let cancel = false
    getClientesConCreditoPendiente().then((data) => {
      if (!cancel) setClientes(data as ClienteConCredito[])
    })
    return () => { cancel = true }
  }, [])

  const filtered = useMemo(() => {
    if (!clientes) return []
    if (!q.trim()) return clientes
    const ql = q.toLowerCase()
    return clientes.filter((c) => c.nombre.toLowerCase().includes(ql) || (c.taxId ?? '').includes(q))
  }, [clientes, q])

  const cliente = clientes?.find((c) => c.contactId === selectedClienteId)

  if (clientes === null) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-black/[0.06] bg-gray-50/80 p-6">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-military border-t-transparent" />
      </div>
    )
  }

  if (clientes.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        No tenés clientes con créditos pendientes. Registrá una venta a crédito antes de poder cobrarla.
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-gray-50/80 p-4 dark:border-white/[0.06] dark:bg-zinc-800/50">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Elegí el cliente</p>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o CUIT..."
          className="w-full rounded-xl border border-black/[0.08] bg-white py-2.5 px-3 text-sm outline-none focus:border-brand-military dark:border-white/10 dark:bg-zinc-900"
        />
        <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
          {filtered.map((c) => (
            <button
              key={c.contactId}
              type="button"
              onClick={() => onSelectCliente(c.contactId)}
              className="flex items-center justify-between rounded-xl border border-black/[0.06] bg-white px-3 py-2.5 text-left transition-colors hover:border-brand-military hover:bg-brand-military/5 dark:bg-zinc-900"
            >
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{c.nombre}</p>
                {c.taxId && <p className="text-[11px] text-gray-400">{c.taxId}</p>}
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Debe</p>
                <p className="font-mono text-sm font-bold text-brand-oxide">${c.deudaTotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
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
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Cliente</p>
          <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{cliente.nombre}</p>
        </div>
        <button
          type="button"
          onClick={() => onSelectCliente('')}
          className="text-[10px] font-bold uppercase tracking-wider text-brand-military hover:underline"
        >
          Cambiar
        </button>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-brand-oxide/20 bg-[#FDF2F0] px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-oxide">Deuda total</span>
        <span className="font-mono text-sm font-black text-brand-oxide">
          ${cliente.deudaTotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Elegí el crédito a cobrar</p>
      <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
        {cliente.creditos.map((cr) => {
          const fecha = cr.date instanceof Date ? cr.date : new Date(cr.date)
          const venc = cr.fechaVencimiento ? (cr.fechaVencimiento instanceof Date ? cr.fechaVencimiento : new Date(cr.fechaVencimiento)) : null
          const isSelected = selectedCreditoId === cr.id
          return (
            <button
              key={cr.id}
              type="button"
              onClick={() => onSelectCredito(cr.id, cr.saldoPendiente, cliente.contactId)}
              className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors ${
                isSelected
                  ? 'border-brand-military bg-brand-military/10'
                  : 'border-black/[0.06] bg-white hover:border-brand-military hover:bg-brand-military/5 dark:bg-zinc-900'
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{cr.description || 'Venta a crédito'}</p>
                <p className="text-[11px] text-gray-400">
                  {fecha.toLocaleDateString('es-AR')}
                  {venc && ` · vence ${venc.toLocaleDateString('es-AR')}`}
                  {cr.estado === 'PARCIAL' && ' · parcialmente cobrado'}
                  {cr.estado === 'VENCIDO' && ' · VENCIDO'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Saldo</p>
                <p className="font-mono text-sm font-bold text-brand-military-dark">
                  ${cr.saldoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

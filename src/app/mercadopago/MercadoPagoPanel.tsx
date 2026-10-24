'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  disconnectMercadoPago,
  ignoreMercadoPagoPayment,
  importMercadoPagoPayment,
  syncMercadoPagoPayments,
} from './actions'

type PendingPayment = {
  id: string
  mpPaymentId: string
  description: string | null
  dateApproved: string
  amountGross: number
  feeAmount: number
  amountNet: number
  currency: string
  paymentMethod: string | null
}

type Props = {
  lastSyncAt: string | null
  defaultFrom: string
  defaultTo: string
  pending: PendingPayment[]
  accounts: { id: string; name: string; currency: string }[]
  categories: { id: string; name: string }[]
}

const money = (value: number, currency: string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(value)

export default function MercadoPagoPanel({ lastSyncAt, defaultFrom, defaultTo, pending, accounts, categories }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [selection, setSelection] = useState<Record<string, { accountId: string; categoryId: string }>>({})

  const run = (fn: () => Promise<{ success: boolean; error?: string; data?: unknown }>, onOk?: (data: unknown) => string | null) => {
    setError(null)
    setInfo(null)
    startTransition(async () => {
      const result = await fn()
      if (!result.success) {
        setError(result.error ?? 'Ocurrió un error')
        return
      }
      const message = onOk?.(result.data) ?? null
      if (message) setInfo(message)
      router.refresh()
    })
  }

  const pickAccount = (paymentId: string) => selection[paymentId]?.accountId ?? accounts[0]?.id ?? ''
  const pickCategory = (paymentId: string) => selection[paymentId]?.categoryId ?? ''

  const updateSelection = (paymentId: string, patch: Partial<{ accountId: string; categoryId: string }>) => {
    setSelection((prev) => ({
      ...prev,
      [paymentId]: { ...prev[paymentId], accountId: pickAccount(paymentId), categoryId: pickCategory(paymentId), ...patch },
    }))
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Cuenta vinculada</h2>
            <p className="text-sm text-gray-600">
              Última sincronización: {lastSyncAt ? new Date(lastSyncAt).toLocaleString('es-AR') : 'nunca'}
            </p>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (window.confirm('¿Desvincular Mercado Pago? Se borran los pagos pendientes de revisión.')) {
                run(() => disconnectMercadoPago())
              }
            }}
            className="rounded-md border border-ds-red-300 px-3 py-1.5 text-sm text-ds-red-600 hover:bg-ds-red-50 disabled:opacity-50"
          >
            Desvincular
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            Desde
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ml-2 rounded-md border px-2 py-1" />
          </label>
          <label className="text-sm">
            Hasta
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ml-2 rounded-md border px-2 py-1" />
          </label>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(
                () => syncMercadoPagoPayments(from, to),
                (data) => {
                  const d = data as { encontrados: number; nuevos: number }
                  return `Se encontraron ${d.encontrados} pagos aprobados; ${d.nuevos} nuevos para revisar.`
                },
              )
            }
            className="rounded-md bg-[#009EE3] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? 'Procesando…' : 'Sincronizar'}
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-ds-red-600" role="alert">{error}</p>}
        {info && <p className="mt-3 text-sm text-ds-green-700" role="status">{info}</p>}
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Pendientes de revisión ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No hay pagos pendientes. Sincronizá un rango de fechas para traerlos.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-gray-500">
                <tr>
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Descripción</th>
                  <th className="py-2 pr-3 text-right">Bruto</th>
                  <th className="py-2 pr-3 text-right">Comisión</th>
                  <th className="py-2 pr-3 text-right">Neto</th>
                  <th className="py-2 pr-3">Cuenta</th>
                  <th className="py-2 pr-3">Categoría</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.id} className="border-t align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(p.dateApproved).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</td>
                    <td className="py-2 pr-3">
                      {p.description || 'Cobro Mercado Pago'}
                      <div className="text-xs text-gray-500">#{p.mpPaymentId}{p.paymentMethod ? ` · ${p.paymentMethod}` : ''}</div>
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">{money(p.amountGross, p.currency)}</td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">{money(p.feeAmount, p.currency)}</td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap font-medium">{money(p.amountNet, p.currency)}</td>
                    <td className="py-2 pr-3">
                      <select
                        aria-label="Cuenta"
                        value={pickAccount(p.id)}
                        onChange={(e) => updateSelection(p.id, { accountId: e.target.value })}
                        className="rounded-md border px-2 py-1"
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        aria-label="Categoría"
                        value={pickCategory(p.id)}
                        onChange={(e) => updateSelection(p.id, { categoryId: e.target.value })}
                        className="rounded-md border px-2 py-1"
                      >
                        <option value="">Por defecto</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      <button
                        type="button"
                        disabled={isPending || !pickAccount(p.id)}
                        onClick={() => run(() => importMercadoPagoPayment(p.id, pickAccount(p.id), pickCategory(p.id) || undefined))}
                        className="mr-2 rounded-md bg-ds-green-600 px-3 py-1 text-white hover:opacity-90 disabled:opacity-50"
                      >
                        Importar
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => run(() => ignoreMercadoPagoPayment(p.id))}
                        className="rounded-md border px-3 py-1 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Ignorar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

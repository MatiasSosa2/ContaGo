'use client'

import { useMemo, useState } from 'react'
import { createCashTransfer } from '@/app/actions'
import type { Account } from './TransactionForm'
import { MoneyField, fmt, num } from './registro/payment'
import { Caption, Group, IOS_FONT, MenuSelect, PrimaryButton, Row } from './ui/ios'

const CURRENCY_SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$' }

/** Cambio de caja: mueve plata entre dos cajas propias, con cotización si cambia la moneda. */
export default function CashTransferForm({ accounts, date, onDone, footerSlot }: {
  accounts: Account[]
  date: string
  onDone: () => void
  /** Lugar debajo de la pestaña para la tarjeta del botón */
  footerSlot?: HTMLElement | null
}) {
  const [fromId, setFromId] = useState(accounts[0]?.id ?? '')
  const [toId, setToId] = useState(accounts.find((a) => a.id !== accounts[0]?.id)?.id ?? '')
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const from = accounts.find((a) => a.id === fromId)
  const to = accounts.find((a) => a.id === toId)
  const crossCurrency = Boolean(from && to && from.currency !== to.currency)
  const opciones = (exclude?: string) =>
    accounts.filter((a) => a.id !== exclude).map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))

  // Lo que entra en la caja destino (misma cuenta que hace el servidor)
  const amountTo = useMemo(() => {
    const a = num(amount)
    if (a <= 0) return null
    if (!crossCurrency) return a
    const r = num(rate)
    if (r <= 0) return null
    if (from?.currency === 'ARS' && to?.currency === 'USD') return a / r
    if (from?.currency === 'USD' && to?.currency === 'ARS') return a * r
    return null
  }, [amount, rate, crossCurrency, from?.currency, to?.currency])

  const handleFromChange = (id: string) => {
    setFromId(id)
    // Si origen y destino quedan iguales, mover el destino a otra caja
    if (id === toId) setToId(accounts.find((a) => a.id !== id)?.id ?? '')
    setError(null)
  }

  const handleSubmit = async () => {
    setError(null)
    const a = num(amount)
    if (!fromId || !toId || fromId === toId) { setError('Elegí dos cajas distintas'); return }
    if (a <= 0) { setError('El monto debe ser mayor a 0'); return }
    if (crossCurrency && !(num(rate) > 0)) { setError('Ingresá la cotización'); return }

    const fd = new FormData()
    fd.set('fromAccountId', fromId)
    fd.set('toAccountId', toId)
    fd.set('amount', String(a))
    if (crossCurrency) fd.set('exchangeRate', rate)
    fd.set('date', date)

    setSubmitting(true)
    const result = await createCashTransfer(fd)
    setSubmitting(false)
    if (!result.success) { setError(result.error || 'No se pudo registrar el cambio'); return }
    onDone()
  }

  if (accounts.length < 2) {
    return <p className={`py-8 text-center text-[13px] text-[#8E8E93] ${IOS_FONT}`}>Necesitás al menos dos cajas para registrar un cambio.</p>
  }

  const simbolo = (c?: string) => CURRENCY_SYMBOL[c ?? 'ARS'] ?? '$'

  return (
    <div className={`flex flex-col ${IOS_FONT}`}>
      {error && (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-[#FF3B30]/10 px-4 py-2.5 text-[13px] text-[#D70015] dark:text-[#FF6961]">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar aviso" className="ml-3 opacity-60">×</button>
        </div>
      )}

      <Caption>Cajas</Caption>
      <Group>
        <Row label="Desde" value={<MenuSelect label="Caja de origen" value={fromId} options={opciones()} onChange={handleFromChange} />} />
        <Row label="Hacia" value={<MenuSelect label="Caja de destino" value={toId} options={opciones(fromId)} onChange={(v) => { setToId(v); setError(null) }} />} />
      </Group>

      <Group className="mt-3">
        <div className="flex min-h-[52px] items-center justify-between gap-3 px-4">
          <span className="text-[15px] font-medium text-[#1C1C1E] dark:text-white">Monto <span className="text-[13px] font-normal text-[#8E8E93]">{simbolo(from?.currency)}</span></span>
          <div className="w-40"><MoneyField align="right" size="lg" value={amount} onChange={setAmount} label="Monto" /></div>
        </div>
        {crossCurrency && (
          <>
            <Row label="Cotización" sub="Pesos por dólar" value={<div className="w-32"><MoneyField align="right" size="md" value={rate} onChange={setRate} label="Cotización" /></div>} />
            <div className="flex min-h-[36px] items-center justify-between px-4 text-[13px] text-[#8E8E93]">
              <span>Entra en {to?.name}</span>
              <span>{amountTo !== null ? `${simbolo(to?.currency)} ${amountTo.toLocaleString('es-AR', { maximumFractionDigits: 2 })}` : '—'}</span>
            </div>
          </>
        )}
      </Group>

      <PrimaryButton onClick={handleSubmit} disabled={submitting} color="gray" slot={footerSlot}>
        {submitting ? 'Guardando…' : `Registrar cambio${num(amount) > 0 && !crossCurrency ? ` · ${fmt(num(amount))}` : ''}`}
      </PrimaryButton>
    </div>
  )
}

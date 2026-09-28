'use client'

import { useEffect, useState } from 'react'
import { createCashAdjustment, getCashAccountBalance } from '@/app/actions'
import type { Account } from './TransactionForm'
import { MoneyField, num, round2 } from './registro/payment'
import { Caption, Group, IOS_FONT, MenuSelect, PrimaryButton, Row } from './ui/ios'

const CURRENCY_SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$' }

function fmtCur(v: number, currency: string) {
  return `${CURRENCY_SYMBOL[currency] ?? '$'}${Math.abs(v).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`
}

/**
 * Diferencia de caja (arqueo): el usuario cuenta la caja, el sistema compara con su saldo
 * a esa fecha y registra el sobrante (ingreso) o faltante (egreso).
 */
export default function CashAdjustmentForm({ accounts, date, onDone, footerSlot }: {
  accounts: Account[]
  date: string
  onDone: () => void
  /** Lugar debajo de la pestaña para la tarjeta del botón */
  footerSlot?: HTMLElement | null
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  // Saldo cargado y para qué caja/fecha: si no coincide con la actual, está cargando
  const [fetched, setFetched] = useState<{ key: string; balance: number | null } | null>(null)
  const [counted, setCounted] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const account = accounts.find((a) => a.id === accountId)
  const currency = account?.currency ?? 'ARS'

  // Saldo del sistema de la caja a la fecha elegida
  const balanceKey = `${accountId}|${date}`
  useEffect(() => {
    if (!accountId) return
    let cancelled = false
    getCashAccountBalance(accountId, date).then((r) => {
      if (!cancelled) setFetched({ key: `${accountId}|${date}`, balance: r.success && r.data ? r.data.balance : null })
    })
    return () => { cancelled = true }
  }, [accountId, date])
  const loadingBalance = fetched?.key !== balanceKey
  const systemBalance = loadingBalance ? null : fetched?.balance ?? null

  const difference = systemBalance !== null && counted !== '' ? round2(num(counted) - systemBalance) : null

  const handleSubmit = async () => {
    setError(null)
    if (!accountId) { setError('Elegí la caja'); return }
    if (counted === '' || num(counted) < 0) { setError('Ingresá lo que contaste'); return }
    if (difference !== null && Math.abs(difference) < 0.01) { setError('No hay diferencia: lo contado coincide con el sistema'); return }

    const fd = new FormData()
    fd.set('accountId', accountId)
    fd.set('counted', String(num(counted)))
    fd.set('date', date)

    setSubmitting(true)
    const result = await createCashAdjustment(fd)
    setSubmitting(false)
    if (!result.success) { setError(result.error || 'No se pudo registrar la diferencia'); return }
    onDone()
  }

  if (accounts.length === 0) {
    return <p className={`py-8 text-center text-[13px] text-[#8E8E93] ${IOS_FONT}`}>No hay cajas cargadas.</p>
  }

  return (
    <div className={`flex flex-col ${IOS_FONT}`}>
      {error && (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-[#FF3B30]/10 px-4 py-2.5 text-[13px] text-[#D70015] dark:text-[#FF6961]">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar aviso" className="ml-3 opacity-60">×</button>
        </div>
      )}

      <Caption>Arqueo</Caption>
      <Group>
        <Row label="Caja" value={
          <MenuSelect
            label="Caja"
            value={accountId}
            options={accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))}
            onChange={(v) => { setAccountId(v); setError(null) }}
          />
        } />
        <div className="flex min-h-[36px] items-center justify-between px-4 text-[13px] text-[#8E8E93]">
          <span>Saldo en sistema</span>
          <span>{loadingBalance ? '…' : systemBalance !== null ? `${systemBalance < 0 ? '−' : ''}${fmtCur(systemBalance, currency)}` : '—'}</span>
        </div>
        <div className="flex min-h-[52px] items-center justify-between gap-3 px-4">
          <span className="text-[15px] font-medium text-[#1C1C1E] dark:text-white">Contado</span>
          <div className="w-40"><MoneyField align="right" size="lg" value={counted} onChange={(v) => { setCounted(v); setError(null) }} label="Contado" /></div>
        </div>
        {difference !== null && (
          <div className="flex min-h-[40px] items-center justify-between px-4 text-[13px]">
            <span className="text-[#8E8E93]">Diferencia</span>
            <span className={difference > 0 ? 'font-medium text-brand-military dark:text-[#9AC7A8]' : difference < 0 ? 'font-medium text-brand-oxide' : 'text-[#8E8E93]'}>
              {difference > 0 ? '+' : difference < 0 ? '−' : ''}{fmtCur(difference, currency)}
              <span className="ml-1.5 text-[11px] font-normal text-[#8E8E93]">{difference > 0 ? 'sobrante' : difference < 0 ? 'faltante' : 'sin diferencia'}</span>
            </span>
          </div>
        )}
      </Group>

      <PrimaryButton onClick={handleSubmit} disabled={submitting} color="gray" slot={footerSlot}>
        {submitting ? 'Guardando…' : 'Registrar diferencia'}
      </PrimaryButton>
    </div>
  )
}

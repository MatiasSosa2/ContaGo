/**
 * cash-flow.ts
 *
 * Fuente única de los saldos y del flujo de las cajas. La usan la pantalla de
 * Cajas y el Estado de flujo de efectivo, así los dos muestran exactamente lo mismo.
 *
 * Reglas:
 * - Cajas = cuentas propias CASH / BANK / WALLET (no las cuentas contables del sistema).
 * - Mueven plata los movimientos que no son a crédito (esCredito = false) y los cambios de caja.
 * - El saldo de una caja en una fecha = saldo actual − todo lo que se movió después.
 *   Así el saldo incluye el saldo con que se dio de alta la caja.
 * - Ingresos / egresos del período = movimientos no a crédito (incluye diferencias de caja).
 * - Los cambios de caja no son ingreso ni egreso. Dentro de una misma moneda se compensan;
 *   si cruzan de moneda aparecen como "cambio de moneda".
 * - Cada moneda se calcula por separado; nunca se suman pesos con dólares.
 */

import prisma from '@/lib/prisma'

export const CASH_ACCOUNT_TYPES = ['CASH', 'BANK', 'WALLET'] as const

export type CashFlowSummary = {
  currency: string
  saldoInicial: number
  ingresos: number
  egresos: number
  /** Neto de cambios de caja que cruzaron de/hacia otra moneda (+ entró, − salió) */
  cambioMoneda: number
  saldoFinal: number
}

async function getCashAccounts(businessId: string, currency?: string) {
  return prisma.account.findMany({
    where: {
      businessId,
      isSystemAccount: false,
      type: { in: [...CASH_ACCOUNT_TYPES] },
      ...(currency ? { currency } : {}),
    },
    select: { id: true, currentBalance: true, currency: true },
  })
}

/** Efecto neto sobre cada caja de lo movido en un rango de fechas. */
async function getCashEffects(businessId: string, accountIds: string[], date: { gt?: Date; gte?: Date; lte?: Date }) {
  const [txs, transfers] = await Promise.all([
    prisma.transaction.findMany({
      where: { businessId, esCredito: false, accountId: { in: accountIds }, date },
      select: { accountId: true, amount: true, type: true },
    }),
    prisma.cashTransfer.findMany({
      where: {
        businessId,
        date,
        OR: [{ fromAccountId: { in: accountIds } }, { toAccountId: { in: accountIds } }],
      },
      select: { fromAccountId: true, toAccountId: true, amountFrom: true, amountTo: true },
    }),
  ])

  const ids = new Set(accountIds)
  const byAccount: Record<string, number> = {}
  const add = (id: string, v: number) => { byAccount[id] = (byAccount[id] || 0) + v }

  let ingresos = 0
  let egresos = 0
  for (const tx of txs) {
    if (tx.type === 'INCOME') { ingresos += tx.amount; add(tx.accountId, tx.amount) }
    else { egresos += tx.amount; add(tx.accountId, -tx.amount) }
  }

  // Transferencias: se compensan si origen y destino están en el conjunto
  let cambioMoneda = 0
  for (const t of transfers) {
    const fromIn = ids.has(t.fromAccountId)
    const toIn = ids.has(t.toAccountId)
    if (fromIn) add(t.fromAccountId, -t.amountFrom)
    if (toIn) add(t.toAccountId, t.amountTo)
    if (fromIn && !toIn) cambioMoneda -= t.amountFrom
    if (toIn && !fromIn) cambioMoneda += t.amountTo
  }

  return { byAccount, ingresos, egresos, cambioMoneda }
}

/** Saldo de cada caja al cierre de `asOf` (id de cuenta → saldo). */
export async function getCashBalancesAt(businessId: string, asOf: Date): Promise<Record<string, number>> {
  const accounts = await getCashAccounts(businessId)
  const after = await getCashEffects(businessId, accounts.map((a) => a.id), { gt: asOf })
  const result: Record<string, number> = {}
  for (const a of accounts) result[a.id] = a.currentBalance - (after.byAccount[a.id] || 0)
  return result
}

/** Saldo de una caja al cierre de `asOf`. */
export async function getCashBalanceOf(businessId: string, accountId: string, asOf: Date): Promise<number | null> {
  const account = await prisma.account.findFirst({
    where: { id: accountId, businessId, isSystemAccount: false, type: { in: [...CASH_ACCOUNT_TYPES] } },
    select: { id: true, currentBalance: true },
  })
  if (!account) return null
  const after = await getCashEffects(businessId, [account.id], { gt: asOf })
  return account.currentBalance - (after.byAccount[account.id] || 0)
}

/** Saldo inicial, ingresos, egresos, cambio de moneda y saldo final de una moneda en [from, to]. */
export async function getCashFlowSummary(businessId: string, from: Date, to: Date, currency: string): Promise<CashFlowSummary> {
  const accounts = await getCashAccounts(businessId, currency)
  const ids = accounts.map((a) => a.id)
  if (ids.length === 0) {
    return { currency, saldoInicial: 0, ingresos: 0, egresos: 0, cambioMoneda: 0, saldoFinal: 0 }
  }

  const [after, period] = await Promise.all([
    getCashEffects(businessId, ids, { gt: to }),
    getCashEffects(businessId, ids, { gte: from, lte: to }),
  ])

  const saldoActual = accounts.reduce((s, a) => s + a.currentBalance, 0)
  const efectoPosterior = Object.values(after.byAccount).reduce((s, v) => s + v, 0)
  const saldoFinal = saldoActual - efectoPosterior
  const saldoInicial = saldoFinal - period.ingresos + period.egresos - period.cambioMoneda

  return {
    currency,
    saldoInicial,
    ingresos: period.ingresos,
    egresos: period.egresos,
    cambioMoneda: period.cambioMoneda,
    saldoFinal,
  }
}

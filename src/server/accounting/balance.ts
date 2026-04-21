/**
 * balance.ts
 *
 * Calcula el saldo de una cuenta contable a partir del libro diario (JournalLine).
 * Esta es la fuente de verdad contable, a diferencia de Account.currentBalance
 * que es solo un caché para queries rápidas del dashboard.
 *
 * Para cuentas tipo ASSET / EXPENSE: saldo = SUM(debit) - SUM(credit)
 * Para cuentas tipo LIABILITY / EQUITY / INCOME: saldo = SUM(credit) - SUM(debit)
 */

import prisma from '@/lib/prisma'

export type BalanceResult = {
  accountId: string
  contableType: string | null
  debitSum: number
  creditSum: number
  /** Saldo contable según la naturaleza de la cuenta */
  balance: number
}

/**
 * Calcula el saldo de una cuenta a partir del journal.
 * Útil para reconciliación y futuros reportes contables.
 */
export async function computeAccountBalance(accountId: string): Promise<BalanceResult> {
  const [account, aggregate] = await Promise.all([
    prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true, contableType: true },
    }),
    prisma.journalLine.aggregate({
      where: { accountId },
      _sum: { debit: true, credit: true },
    }),
  ])

  const debitSum = aggregate._sum.debit ?? 0
  const creditSum = aggregate._sum.credit ?? 0

  // Naturaleza del saldo según tipo contable
  // ASSET / EXPENSE: saldo normal = DEBE (debit - credit)
  // LIABILITY / EQUITY / INCOME: saldo normal = HABER (credit - debit)
  const normalDebitSide = ['ASSET', 'EXPENSE'].includes(account?.contableType ?? '')
  const balance = normalDebitSide ? debitSum - creditSum : creditSum - debitSum

  return {
    accountId,
    contableType: account?.contableType ?? null,
    debitSum,
    creditSum,
    balance,
  }
}

/**
 * Calcula balances de todas las cuentas de un negocio a partir del journal.
 * Puede usarse para construir el Balance General y el Estado de Resultados.
 */
export async function computeAllBalancesForBusiness(
  businessId: string,
): Promise<BalanceResult[]> {
  const accounts = await prisma.account.findMany({
    where: { businessId },
    select: { id: true, contableType: true },
  })

  // Traer todos los totales por cuenta en una sola query
  const aggregates = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: { journalEntry: { businessId } },
    _sum: { debit: true, credit: true },
  })

  const aggMap = new Map(aggregates.map((a) => [a.accountId, a._sum]))

  return accounts.map((acc) => {
    const sums = aggMap.get(acc.id)
    const debitSum = sums?.debit ?? 0
    const creditSum = sums?.credit ?? 0
    const normalDebitSide = ['ASSET', 'EXPENSE'].includes(acc.contableType ?? '')
    const balance = normalDebitSide ? debitSum - creditSum : creditSum - debitSum

    return {
      accountId: acc.id,
      contableType: acc.contableType,
      debitSum,
      creditSum,
      balance,
    }
  })
}

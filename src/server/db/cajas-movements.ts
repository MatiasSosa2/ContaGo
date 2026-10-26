import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import type { CajasMovementItem } from '@/components/CajasClient'
import {
  CAJAS_MOVEMENT_KINDS,
  type CajasMovementCursor,
  type CajasMovementKind,
  compareCajasMovementCandidates,
} from '@/lib/cajas-movement-pagination'
import { getBusinessId } from './shared'

const DEFAULT_PAGE_SIZE = 20

function kindRank(kind: CajasMovementKind): number {
  return CAJAS_MOVEMENT_KINDS.indexOf(kind)
}

function isMovementKind(value: unknown): value is CajasMovementKind {
  return typeof value === 'string' && CAJAS_MOVEMENT_KINDS.some((kind) => kind === value)
}

function cursorWhere(
  cursor: CajasMovementCursor | undefined,
  kind: CajasMovementKind,
): Prisma.TransactionWhereInput & Prisma.OperacionWhereInput & Prisma.CashTransferWhereInput {
  if (!cursor) return {}

  const cursorDate = new Date(cursor.date)
  if (Number.isNaN(cursorDate.getTime()) || !cursor.id || !isMovementKind(cursor.kind)) {
    throw new TypeError('Cursor de movimientos inválido')
  }

  const rank = kindRank(kind)
  const cursorRank = kindRank(cursor.kind)
  const afterDate = { date: { lt: cursorDate } }
  if (rank > cursorRank) {
    return { OR: [afterDate, { date: cursorDate }] }
  }
  if (rank === cursorRank) {
    return { OR: [afterDate, { date: cursorDate, id: { lt: cursor.id } }] }
  }
  return afterDate
}

const transactionInclude = {
  category: { select: { name: true } },
  subcategory: { select: { name: true } },
  account: { select: { name: true, type: true } },
  contact: { select: { name: true } },
  operacion: {
    select: {
      total: true,
      descuento: true,
      items: {
        select: {
          cantidad: true,
          precioUnitario: true,
          subtotal: true,
          producto: { select: { nombre: true } },
        },
      },
    },
  },
} satisfies Prisma.TransactionInclude

export async function getCajasMovementsPage(
  cursor?: CajasMovementCursor,
  pageSize = DEFAULT_PAGE_SIZE,
) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new RangeError('El tamaño de página debe estar entre 1 y 100')
  }

  const businessId = await getBusinessId()
  const take = pageSize + 1
  const [operations, transactions, transfersOut, transfersIn] = await Promise.all([
    prisma.operacion.findMany({
      where: {
        businessId,
        transactions: { some: { businessId } },
        ...cursorWhere(cursor, 'operation'),
      },
      select: { id: true, date: true },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take,
    }),
    prisma.transaction.findMany({
      where: {
        businessId,
        operacionId: null,
        ...cursorWhere(cursor, 'transaction'),
      },
      select: { id: true, date: true },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take,
    }),
    prisma.cashTransfer.findMany({
      where: { businessId, ...cursorWhere(cursor, 'transfer-out') },
      select: { id: true, date: true },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take,
    }),
    prisma.cashTransfer.findMany({
      where: { businessId, ...cursorWhere(cursor, 'transfer-in') },
      select: { id: true, date: true },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take,
    }),
  ])

  const candidates: CajasMovementCursor[] = [
    ...operations.map(({ id, date }) => ({ id, date: date.toISOString(), kind: 'operation' as const })),
    ...transactions.map(({ id, date }) => ({ id, date: date.toISOString(), kind: 'transaction' as const })),
    ...transfersOut.map(({ id, date }) => ({ id, date: date.toISOString(), kind: 'transfer-out' as const })),
    ...transfersIn.map(({ id, date }) => ({ id, date: date.toISOString(), kind: 'transfer-in' as const })),
  ].sort(compareCajasMovementCandidates)

  const pageCandidates = candidates.slice(0, pageSize)
  const operationIds = [...new Set(pageCandidates.filter((item) => item.kind === 'operation').map((item) => item.id))]
  const transactionIds = pageCandidates.filter((item) => item.kind === 'transaction').map((item) => item.id)
  const transferIds = [...new Set(pageCandidates.filter((item) => item.kind.startsWith('transfer-')).map((item) => item.id))]
  const [operationTransactions, standaloneTransactions, transferRows] = await Promise.all([
    operationIds.length
      ? prisma.transaction.findMany({
          where: { businessId, operacionId: { in: operationIds } },
          include: transactionInclude,
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
        })
      : [],
    transactionIds.length
      ? prisma.transaction.findMany({
          where: { businessId, id: { in: transactionIds } },
          include: transactionInclude,
        })
      : [],
    transferIds.length
      ? prisma.cashTransfer.findMany({
          where: { businessId, id: { in: transferIds } },
          select: {
            id: true,
            date: true,
            description: true,
            amountFrom: true,
            amountTo: true,
            fromAccount: { select: { name: true, type: true, currency: true } },
            toAccount: { select: { name: true, type: true, currency: true } },
          },
        })
      : [],
  ])

  const transactionsById = new Map([...operationTransactions, ...standaloneTransactions].map((item) => [item.id, item]))
  const transactionsByOperation = new Map<string, typeof operationTransactions>()
  for (const transaction of operationTransactions) {
    if (!transaction.operacionId) continue
    const grouped = transactionsByOperation.get(transaction.operacionId) ?? []
    grouped.push(transaction)
    transactionsByOperation.set(transaction.operacionId, grouped)
  }
  const transfersById = new Map(transferRows.map((transfer) => [transfer.id, transfer]))

  const movements = pageCandidates.flatMap<CajasMovementItem>((candidate) => {
    if (candidate.kind === 'operation') {
      return transactionsByOperation.get(candidate.id) ?? []
    }
    if (candidate.kind === 'transaction') {
      const transaction = transactionsById.get(candidate.id)
      return transaction ? [transaction] : []
    }

    const transfer = transfersById.get(candidate.id)
    if (!transfer) return []
    const label = `${transfer.fromAccount.name} → ${transfer.toAccount.name}`
    const common = {
      description: transfer.description ?? label,
      date: transfer.date,
      esCredito: false,
      category: null,
      isTransfer: true,
      transferLabel: label,
    }
    const leg = candidate.kind === 'transfer-out'
      ? {
          ...common,
          id: `${transfer.id}-out`,
          type: 'EXPENSE',
          amount: transfer.amountFrom,
          currency: transfer.fromAccount.currency,
          account: { name: transfer.fromAccount.name, type: transfer.fromAccount.type },
        }
      : {
          ...common,
          id: `${transfer.id}-in`,
          type: 'INCOME',
          amount: transfer.amountTo,
          currency: transfer.toAccount.currency,
          account: { name: transfer.toAccount.name, type: transfer.toAccount.type },
        }
    return [leg]
  })

  return {
    movements,
    nextCursor: candidates.length > pageSize ? pageCandidates.at(-1) ?? null : null,
  }
}

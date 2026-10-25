import assert from 'node:assert/strict'
import test from 'node:test'
import { generateJournalLines } from '../src/server/accounting/journal-engine'

const base = {
  amount: 1234.56,
  type: 'INCOME' as const,
  esCredito: false,
  physicalAccountId: 'cash',
  categoryContableAccountId: 'sales',
  cxcAccountId: 'receivables',
  cxpAccountId: 'payables',
}

function assertBalanced(lines: { debit: number; credit: number }[]) {
  const debit = lines.reduce((total, line) => total + line.debit, 0)
  const credit = lines.reduce((total, line) => total + line.credit, 0)
  assert.ok(Math.abs(debit - credit) <= 0.001)
}

test('generates a balanced cash income entry', () => {
  const result = generateJournalLines(base)

  assert.equal(result.ok, true)
  if (!result.ok) return
  assertBalanced(result.lines)
  assert.deepEqual(result.lines.map(({ accountId, debit, credit }) => ({ accountId, debit, credit })), [
    { accountId: 'cash', debit: 1234.56, credit: 0 },
    { accountId: 'sales', debit: 0, credit: 1234.56 },
  ])
})

test('generates a balanced credit expense entry against accounts payable', () => {
  const result = generateJournalLines({
    ...base,
    type: 'EXPENSE',
    esCredito: true,
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assertBalanced(result.lines)
  assert.deepEqual(result.lines.map(({ accountId, debit, credit }) => ({ accountId, debit, credit })), [
    { accountId: 'sales', debit: 1234.56, credit: 0 },
    { accountId: 'payables', debit: 0, credit: 1234.56 },
  ])
})

test('returns an explicit error when a required system account is absent', () => {
  const result = generateJournalLines({
    ...base,
    mode: 'COBRO_CREDITO',
    cxcAccountId: null,
  })

  assert.deepEqual(result, { ok: false, reason: 'sin_cuenta_cxc' })
})

test('balances the inventory and cost entries for product sales', () => {
  const result = generateJournalLines({
    ...base,
    mode: 'SALE_PRODUCT',
    costoMercaderia: 450.25,
    inventoryAccountId: 'inventory',
    cogsAccountId: 'cogs',
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assertBalanced(result.lines)
  assert.equal(result.lines.length, 4)
})

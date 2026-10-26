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

test('generates a balanced credit sale with both receivable and revenue lines', () => {
  const result = generateJournalLines({
    ...base,
    esCredito: true,
    mode: 'SALE_PRODUCT',
    costoMercaderia: 450.25,
    inventoryAccountId: 'inventory',
    cogsAccountId: 'cogs',
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assertBalanced(result.lines)
  assert.deepEqual(result.lines.map(({ accountId }) => accountId), [
    'receivables',
    'sales',
    'cogs',
    'inventory',
  ])
})

test('rejects product sale when inventory accounts are not configured', () => {
  const result = generateJournalLines({
    ...base,
    mode: 'SALE_PRODUCT',
    costoMercaderia: 450.25,
  })

  assert.deepEqual(result, { ok: false, reason: 'sin_cuenta_inventario' })
})

test('balances purchase, credit collection, and supplier debt payment flows', () => {
  const purchase = generateJournalLines({
    ...base,
    type: 'EXPENSE',
    esCredito: true,
    mode: 'PURCHASE_PRODUCT',
    inventoryAccountId: 'inventory',
  })
  const collection = generateJournalLines({ ...base, mode: 'COBRO_CREDITO' })
  const payment = generateJournalLines({ ...base, mode: 'PAGO_DEUDA' })

  for (const result of [purchase, collection, payment]) {
    assert.equal(result.ok, true)
    if (result.ok) assertBalanced(result.lines)
  }
})

test('balances the gain or loss on sale of a fixed asset', () => {
  const gain = generateJournalLines({
    ...base,
    mode: 'SALE_BIEN_USO',
    fixedAssetAccountId: 'fixed-assets',
    bienValorNetoEnLibros: 900,
  })
  const loss = generateJournalLines({
    ...base,
    mode: 'SALE_BIEN_USO',
    fixedAssetAccountId: 'fixed-assets',
    bienValorNetoEnLibros: 1500,
  })

  for (const result of [gain, loss]) {
    assert.equal(result.ok, true)
    if (result.ok) assertBalanced(result.lines)
  }
})

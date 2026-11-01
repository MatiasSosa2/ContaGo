import assert from 'node:assert/strict'
import test from 'node:test'
import {
  allocateProportionally,
  buildTransferJournalLines,
  generateJournalLines,
} from '../src/server/accounting/journal-engine'

const sumDebits = (lines: { debit: number }[]) => lines.reduce((s, l) => s + l.debit, 0)
const sumCredits = (lines: { credit: number }[]) => lines.reduce((s, l) => s + l.credit, 0)

test('transferencia en la misma moneda: asiento directo y balanceado', () => {
  const result = buildTransferJournalLines({
    amountFrom: 1000, amountTo: 1000,
    fromCurrency: 'ARS', toCurrency: 'ARS',
    exchangeRate: null,
    fromAccountId: 'a', toAccountId: 'b', fxDiffAccountId: null,
  })
  assert.ok(result.ok)
  assert.equal(sumDebits(result.lines), sumCredits(result.lines))
})

test('transferencia ARS→USD: ambos lados se expresan en pesos y el asiento balancea', () => {
  // ARS 150.000 a 1.500 = USD 100: débito 100 × 1500 = crédito 150.000
  const result = buildTransferJournalLines({
    amountFrom: 150000, amountTo: 100,
    fromCurrency: 'ARS', toCurrency: 'USD',
    exchangeRate: 1500,
    fromAccountId: 'ars', toAccountId: 'usd', fxDiffAccountId: null,
  })
  assert.ok(result.ok)
  assert.equal(sumDebits(result.lines), 150000)
  assert.equal(sumCredits(result.lines), 150000)
})

test('transferencia con redondeo de conversión: el residual va a Diferencia de cambio', () => {
  // ARS 100.000 a 1.500 = USD 66,67 (redondeado al alza): 66,67 × 1500 = 100.005 →
  // entró un pelín más de lo que salió: ganancia de 5 (crédito en Diferencia de cambio)
  const result = buildTransferJournalLines({
    amountFrom: 100000, amountTo: 66.67,
    fromCurrency: 'ARS', toCurrency: 'USD',
    exchangeRate: 1500,
    fromAccountId: 'ars', toAccountId: 'usd', fxDiffAccountId: 'fx',
  })
  assert.ok(result.ok)
  const fxLine = result.lines.find((l) => l.accountId === 'fx')
  assert.ok(fxLine)
  assert.equal(fxLine.credit, 5)
  assert.equal(sumDebits(result.lines), sumCredits(result.lines))
})

test('transferencia cruzada sin cotización o sin cuenta de diferencia: error explícito', () => {
  const sinRate = buildTransferJournalLines({
    amountFrom: 1000, amountTo: 1, fromCurrency: 'ARS', toCurrency: 'USD',
    exchangeRate: null, fromAccountId: 'a', toAccountId: 'b', fxDiffAccountId: 'fx',
  })
  assert.deepEqual(sinRate, { ok: false, reason: 'sin_cotizacion' })

  const sinCuenta = buildTransferJournalLines({
    amountFrom: 100000, amountTo: 66.67, fromCurrency: 'ARS', toCurrency: 'USD',
    exchangeRate: 1500, fromAccountId: 'a', toAccountId: 'b', fxDiffAccountId: null,
  })
  assert.deepEqual(sinCuenta, { ok: false, reason: 'sin_cuenta_dif_cambio' })
})

test('compra con costo fijo: inventario al fijo y varianza al resultado, balanceado', () => {
  // Pagó 150, el inventario entra al costo fijo 100: varianza 50 de gasto
  const result = generateJournalLines({
    amount: 150,
    type: 'EXPENSE',
    esCredito: false,
    physicalAccountId: 'caja',
    categoryContableAccountId: 'compras',
    cxcAccountId: null,
    cxpAccountId: null,
    inventoryAccountId: 'inventario',
    mode: 'PURCHASE_PRODUCT',
    inventoryValue: 100,
    costVariance: 50,
    costVarianceAccountId: 'dif-costo',
  })
  assert.ok(result.ok)
  assert.equal(sumDebits(result.lines), 150)
  assert.equal(sumCredits(result.lines), 150)
  assert.ok(result.lines.some((l) => l.accountId === 'dif-costo' && l.debit === 50))
})

test('compra bajo el costo fijo: la varianza negativa se acredita como resultado', () => {
  const result = generateJournalLines({
    amount: 80,
    type: 'EXPENSE',
    esCredito: false,
    physicalAccountId: 'caja',
    categoryContableAccountId: 'compras',
    cxcAccountId: null,
    cxpAccountId: null,
    inventoryAccountId: 'inventario',
    mode: 'PURCHASE_PRODUCT',
    inventoryValue: 100,
    costVariance: -20,
    costVarianceAccountId: 'dif-costo',
  })
  assert.ok(result.ok)
  assert.equal(sumDebits(result.lines), sumCredits(result.lines))
  assert.ok(result.lines.some((l) => l.accountId === 'dif-costo' && l.credit === 20))
})

test('allocateProportionally: la suma siempre da el total exacto, con residual en el último', () => {
  // 100 unidades a $1 con $0,50 de descuento: total 99,50 sobre pesos iguales
  const parts = allocateProportionally(99.5, [100])
  assert.deepEqual(parts, [99.5])

  const tres = allocateProportionally(100, [1, 1, 1])
  assert.equal(tres.reduce((s, v) => s + v, 0), 100)
  assert.deepEqual(tres, [33.33, 33.33, 33.34])

  const sinPesos = allocateProportionally(50, [0, 0])
  assert.deepEqual(sinPesos, [0, 50])
})

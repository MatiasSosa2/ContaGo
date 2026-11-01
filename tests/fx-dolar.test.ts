import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchDolarOficial, toArs } from '../src/server/fx/dolar'

function mockFetch(body: unknown, ok = true): typeof fetch {
  return (async () => ({ ok, json: async () => body })) as unknown as typeof fetch
}

test('fetchDolarOficial devuelve la punta vendedora del oficial', async () => {
  const rate = await fetchDolarOficial(mockFetch({ venta: 1450.5, compra: 1410 }))
  assert.equal(rate, 1450.5)
})

test('fetchDolarOficial rechaza respuestas inválidas o fallidas sin romper', async () => {
  assert.equal(await fetchDolarOficial(mockFetch({ venta: -5 })), null)
  assert.equal(await fetchDolarOficial(mockFetch({ venta: '1500' })), null)
  assert.equal(await fetchDolarOficial(mockFetch({}, false)), null)
  assert.equal(await fetchDolarOficial((async () => { throw new Error('down') }) as unknown as typeof fetch), null)
})

test('toArs convierte dólares con la tasa y nunca mezcla monedas sin tasa', () => {
  assert.equal(toArs(100, 'USD', 1500), 150000)
  assert.equal(toArs(100, 'USD', null), 0)
  assert.equal(toArs(100, 'ARS', null), 100)
  assert.equal(toArs(100, 'ARS', 1500), 100)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { compareCajasMovementCandidates, type CajasMovementCursor } from '../src/lib/cajas-movement-pagination'

test('orders movement candidates by date, kind, then stable id', () => {
  const candidates: CajasMovementCursor[] = [
    { date: '2025-01-01T12:00:00.000Z', id: 'a', kind: 'transfer-in' },
    { date: '2025-01-02T12:00:00.000Z', id: 'a', kind: 'transaction' },
    { date: '2025-01-02T12:00:00.000Z', id: 'b', kind: 'transaction' },
    { date: '2025-01-02T12:00:00.000Z', id: 'z', kind: 'operation' },
    { date: '2025-01-02T12:00:00.000Z', id: 'a', kind: 'transfer-out' },
    { date: '2025-01-02T12:00:00.000Z', id: 'a', kind: 'transfer-in' },
  ]

  assert.deepEqual(
    candidates.sort(compareCajasMovementCandidates).map(({ kind, id }) => `${kind}:${id}`),
    [
      'operation:z',
      'transaction:b',
      'transaction:a',
      'transfer-out:a',
      'transfer-in:a',
      'transfer-in:a',
    ],
  )
})

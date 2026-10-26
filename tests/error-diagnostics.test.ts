import assert from 'node:assert/strict'
import test from 'node:test'

import { getSafeErrorDiagnostics } from '../src/lib/error-diagnostics'

test('keeps fetch failure causes useful while redacting URLs and credentials', () => {
  const error = new Error('fetch failed', {
    cause: Object.assign(new Error('request to https://db.example.test/path?token=private failed'), {
      code: 'ECONNRESET',
    }),
  })

  assert.deepEqual(getSafeErrorDiagnostics(error), [
    { name: 'Error', message: 'fetch failed' },
    { name: 'Error', code: 'ECONNRESET', message: 'request to [redacted-url] failed' },
  ])
})

test('bounds cyclic and unusually deep causes', () => {
  const error = new Error('outer')
  Object.defineProperty(error, 'cause', { value: error })

  assert.deepEqual(getSafeErrorDiagnostics(error), [
    { name: 'Error', message: 'outer' },
  ])
})

test('does not leak token-like values from messages', () => {
  assert.deepEqual(
    getSafeErrorDiagnostics(new Error('authToken=super-secret database unavailable')),
    [{ name: 'Error', message: 'authToken=[redacted] database unavailable' }],
  )
})

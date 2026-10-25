import assert from 'node:assert/strict'
import test from 'node:test'
import { getProductionConfigurationErrors } from '../src/lib/production-config'

const validEnvironment: Record<string, string> = {
  NEXTAUTH_SECRET: 'a'.repeat(32),
  NEXTAUTH_URL: 'https://contago.example',
  TURSO_DATABASE_URL: 'libsql://contago.example',
  TURSO_AUTH_TOKEN: 'test-token',
  AUTH_EMAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 'test-resend-key',
  AUTH_EMAIL_FROM: 'ContaGo <auth@example.com>',
  UPSTASH_REDIS_REST_URL: 'https://redis.example',
  UPSTASH_REDIS_REST_TOKEN: 'test-redis-token',
}

test('accepts a complete production configuration', () => {
  assert.deepEqual(getProductionConfigurationErrors(validEnvironment), [])
})

test('rejects missing production security dependencies without exposing values', () => {
  const errors = getProductionConfigurationErrors({})

  assert.ok(errors.some((error) => error.includes('NEXTAUTH_SECRET')))
  assert.ok(errors.some((error) => /database/i.test(error)))
  assert.ok(errors.some((error) => error.includes('UPSTASH')))
  assert.ok(errors.some((error) => error.includes('resend')))
})

test('rejects insecure URLs and local databases in production', () => {
  const errors = getProductionConfigurationErrors({
    ...validEnvironment,
    NEXTAUTH_URL: 'http://contago.example',
    TURSO_DATABASE_URL: 'file:./dev.db',
    UPSTASH_REDIS_REST_URL: 'http://redis.example',
  })

  assert.ok(errors.some((error) => error.includes('remote libSQL')))
  assert.ok(errors.some((error) => error.includes('HTTPS')))
})

test('requires a token encryption key when Mercado Pago credentials are enabled', () => {
  const errors = getProductionConfigurationErrors({
    ...validEnvironment,
    MP_CLIENT_ID: 'client-id',
    MP_CLIENT_SECRET: 'client-secret',
  })

  assert.ok(errors.some((error) => error.includes('MP_TOKEN_ENCRYPTION_KEY')))
})

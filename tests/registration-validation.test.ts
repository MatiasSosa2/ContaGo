import assert from 'node:assert/strict'
import test from 'node:test'

import {
  registerWithCredentialsSchema,
  requestEmailChallengeSchema,
  verifyEmailChallengeSchema,
} from '../src/lib/validations'

const validRegistration = {
  name: '  Ana Pérez  ',
  email: 'ana@example.com',
  password: 'secure-password',
  businessName: '  Mi negocio  ',
  operatingModel: 'BOTH',
}

test('validates and normalizes registration identity fields', () => {
  const result = registerWithCredentialsSchema.safeParse(validRegistration)

  assert.equal(result.success, true)
  if (!result.success) return
  assert.equal(result.data.name, 'Ana Pérez')
  assert.equal(result.data.businessName, 'Mi negocio')
})

test('rejects invalid email, weak password, and missing business model', () => {
  const result = registerWithCredentialsSchema.safeParse({
    ...validRegistration,
    email: 'not-an-email',
    password: '123',
    operatingModel: 'UNKNOWN',
  })

  assert.equal(result.success, false)
})

test('accepts only supported verification requests and six-digit codes', () => {
  assert.equal(requestEmailChallengeSchema.safeParse({
    email: 'ana@example.com',
    purpose: 'SIGNUP_VERIFY',
  }).success, true)

  assert.equal(verifyEmailChallengeSchema.safeParse({
    email: 'ana@example.com',
    purpose: 'SIGNUP_VERIFY',
    code: '123456',
  }).success, true)

  assert.equal(verifyEmailChallengeSchema.safeParse({
    email: 'ana@example.com',
    purpose: 'SIGNUP_VERIFY',
    code: '12345x',
  }).success, false)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { changePasswordSchema } from '../src/lib/validations'

test('requires matching valid new passwords', () => {
  assert.equal(changePasswordSchema.safeParse({
    currentPassword: 'current-password',
    newPassword: 'new-password',
    confirmPassword: 'new-password',
  }).success, true)

  const mismatch = changePasswordSchema.safeParse({
    currentPassword: 'current-password',
    newPassword: 'new-password',
    confirmPassword: 'different-password',
  })
  assert.equal(mismatch.success, false)
})

test('allows password creation for an authenticated OAuth account', () => {
  assert.equal(changePasswordSchema.safeParse({
    currentPassword: '',
    newPassword: 'new-password',
    confirmPassword: 'new-password',
  }).success, true)
})

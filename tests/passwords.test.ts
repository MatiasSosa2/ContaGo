import assert from 'node:assert/strict'
import test from 'node:test'

import {
  changePasswordFlow,
  hashPassword,
  type PasswordChangeDatabase,
} from '../src/server/auth/password-change'

function createDatabase(password: string | null): {
  database: PasswordChangeDatabase
  stored: { password: string | null; passwordChangedAt: Date | null; sessionsCleared: boolean }
} {
  const stored = { password, passwordChangedAt: null as Date | null, sessionsCleared: false }
  const database: PasswordChangeDatabase = {
    user: {
      async findUnique({ where }) {
        if (where.id !== 'user-1') return null
        return { password: stored.password, passwordChangedAt: stored.passwordChangedAt }
      },
      async updateMany({ where, data }) {
        if (
          where.id !== 'user-1' ||
          where.password !== stored.password ||
          where.passwordChangedAt !== stored.passwordChangedAt
        ) {
          return { count: 0 }
        }
        stored.password = data.password
        stored.passwordChangedAt = data.passwordChangedAt
        stored.sessionsCleared =
          data.activeSessionId === null && data.activeSessionExpiresAt === null
        return { count: 1 }
      },
    },
  }
  return { database, stored }
}

test('changes a password only after verifying the current password and clears its session', async () => {
  const currentHash = await hashPassword('current-pass-123')
  const { database, stored } = createDatabase(currentHash)

  const result = await changePasswordFlow(database, {
    userId: 'user-1',
    currentPassword: 'current-pass-123',
    newPassword: 'new-password-456',
  })

  assert.deepEqual(result, { success: true })
  assert.notEqual(stored.password, currentHash)
  assert.ok(stored.passwordChangedAt)
  assert.equal(stored.sessionsCleared, true)
})

test('rejects an incorrect current password without changing account state', async () => {
  const currentHash = await hashPassword('current-pass-123')
  const { database, stored } = createDatabase(currentHash)

  const result = await changePasswordFlow(database, {
    userId: 'user-1',
    currentPassword: 'incorrect-password',
    newPassword: 'new-password-456',
  })

  assert.deepEqual(result, {
    success: false,
    error: 'La contraseña actual no es correcta.',
  })
  assert.equal(stored.password, currentHash)
  assert.equal(stored.passwordChangedAt, null)
  assert.equal(stored.sessionsCleared, false)
})

test('allows an authenticated OAuth user without a password to set one', async () => {
  const { database, stored } = createDatabase(null)

  const result = await changePasswordFlow(database, {
    userId: 'user-1',
    currentPassword: '',
    newPassword: 'new-password-456',
  })

  assert.deepEqual(result, { success: true })
  assert.ok(stored.password)
  assert.ok(stored.passwordChangedAt)
  assert.equal(stored.sessionsCleared, true)
})

test('rejects a concurrent password update instead of overwriting it', async () => {
  const currentHash = await hashPassword('current-pass-123')
  const { database } = createDatabase(currentHash)
  database.user.updateMany = async () => ({ count: 0 })

  const result = await changePasswordFlow(database, {
    userId: 'user-1',
    currentPassword: 'current-pass-123',
    newPassword: 'new-password-456',
  })

  assert.deepEqual(result, {
    success: false,
    error: 'La contraseña cambió en otra solicitud. Vuelve a intentarlo.',
  })
})

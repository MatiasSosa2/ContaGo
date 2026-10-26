import assert from 'node:assert/strict'
import test from 'node:test'
import {
  claimSingleUserSession,
  refreshUserSession,
  releaseUserSession,
  type SingleSessionDatabase,
} from '../src/server/auth/single-session'

type StoredSession = {
  id: string
  activeSessionId: string | null
  activeSessionExpiresAt: Date | null
  activeSessionId2: string | null
  activeSessionExpiresAt2: Date | null
  activeSessionId3: string | null
  activeSessionExpiresAt3: Date | null
}

const fields = {
  1: { id: 'activeSessionId', expiresAt: 'activeSessionExpiresAt' },
  2: { id: 'activeSessionId2', expiresAt: 'activeSessionExpiresAt2' },
  3: { id: 'activeSessionId3', expiresAt: 'activeSessionExpiresAt3' },
} as const

function createDatabase(initial: Partial<StoredSession> & Pick<StoredSession, 'id'>): {
  database: SingleSessionDatabase
  stored: StoredSession
} {
  const stored: StoredSession = {
    activeSessionId: null,
    activeSessionExpiresAt: null,
    activeSessionId2: null,
    activeSessionExpiresAt2: null,
    activeSessionId3: null,
    activeSessionExpiresAt3: null,
    ...initial,
  }
  const database: SingleSessionDatabase = {
    user: {
      async updateMany({ where, data }) {
        if (where.id !== stored.id) return { count: 0 }

        const record = where as Record<string, unknown>
        const conditionMatches = (condition: Record<string, unknown>) =>
          Object.entries(condition).every(([key, expected]) => {
            const actual = stored[key as keyof StoredSession]
            if (expected === null || typeof expected !== 'object') return actual === expected
            if (!(actual instanceof Date)) return false
            const range = expected as { lte?: Date; gt?: Date }
            return (!range.lte || actual <= range.lte) && (!range.gt || actual > range.gt)
          })
        const matchedCondition = Array.isArray(record.OR)
          ? record.OR.some((condition) => conditionMatches(condition as Record<string, unknown>))
          : Object.entries(record).every(([key, expected]) => {
              if (key === 'id') return expected === stored.id
              const actual = stored[key as keyof StoredSession]
              if (expected === null || typeof expected !== 'object') return actual === expected
              if (!(actual instanceof Date)) return false
              const range = expected as { lte?: Date; gt?: Date }
              return (!range.lte || actual <= range.lte) && (!range.gt || actual > range.gt)
            })

        if (!matchedCondition) return { count: 0 }
        Object.assign(stored, data)
        return { count: 1 }
      },
    },
  }
  return { database, stored }
}

function seedActiveSessions(count: number): Partial<StoredSession> {
  const values: Partial<StoredSession> = {}
  for (const slot of [1, 2, 3] as const) {
    if (slot > count) continue
    values[fields[slot].id] = `session-${slot}`
    values[fields[slot].expiresAt] = new Date(Date.now() + 60_000)
  }
  return values
}

test('allows at most three concurrent device sessions', async () => {
  const { database, stored } = createDatabase({ id: 'user-1' })
  const claims = await Promise.all(
    Array.from({ length: 4 }, () => claimSingleUserSession(database, 'user-1')),
  )

  assert.equal(claims.filter(Boolean).length, 3)
  assert.equal(new Set(claims.filter(Boolean).map((claim) => claim?.sessionId)).size, 3)
  assert.equal(await claimSingleUserSession(database, 'user-1'), null)
  assert.ok(stored.activeSessionId)
  assert.ok(stored.activeSessionId2)
  assert.ok(stored.activeSessionId3)
})

test('reclaims an expired slot without affecting the other devices', async () => {
  const { database, stored } = createDatabase({
    id: 'user-1',
    ...seedActiveSessions(3),
    activeSessionExpiresAt2: new Date(Date.now() - 1),
  })

  const replacement = await claimSingleUserSession(database, 'user-1')

  assert.equal(replacement?.slot, 2)
  assert.equal(stored.activeSessionId, 'session-1')
  assert.equal(stored.activeSessionId3, 'session-3')
  assert.equal(stored.activeSessionId2, replacement?.sessionId)
})

test('refreshes and releases only the specified device session', async () => {
  const { database, stored } = createDatabase({
    id: 'user-1',
    ...seedActiveSessions(2),
  })
  const priorExpiry = stored.activeSessionExpiresAt2

  assert.equal(await refreshUserSession(database, {
    userId: 'user-1',
    sessionId: 'session-2',
    slot: 2,
  }), true)
  assert.ok(stored.activeSessionExpiresAt2 && priorExpiry)
  assert.ok(stored.activeSessionExpiresAt2 > priorExpiry)

  await releaseUserSession(database, {
    userId: 'user-1',
    sessionId: 'session-1',
    slot: 1,
  })
  assert.equal(stored.activeSessionId, null)
  assert.equal(stored.activeSessionId2, 'session-2')
})

test('does not let a session claim a slot for another user', async () => {
  const { database } = createDatabase({ id: 'user-1' })
  assert.equal(await claimSingleUserSession(database, 'user-2'), null)
})

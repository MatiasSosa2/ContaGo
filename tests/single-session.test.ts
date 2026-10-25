import assert from 'node:assert/strict'
import test from 'node:test'
import {
  claimSingleUserSession,
  type SingleSessionDatabase,
} from '../src/server/auth/single-session'

type StoredSession = {
  id: string
  activeSessionId: string | null
  activeSessionExpiresAt: Date | null
}

function createDatabase(initial: StoredSession): {
  database: SingleSessionDatabase
  stored: StoredSession
} {
  const stored = initial
  const database: SingleSessionDatabase = {
    user: {
      async updateMany({ where, data }) {
        if (where.id !== stored.id) return { count: 0 }

        const isAvailable =
          stored.activeSessionId === null ||
          (stored.activeSessionExpiresAt !== null &&
            where.OR.some((condition) =>
              'activeSessionExpiresAt' in condition &&
              stored.activeSessionExpiresAt !== null &&
              stored.activeSessionExpiresAt <= condition.activeSessionExpiresAt.lte,
            ))

        if (!isAvailable) return { count: 0 }

        stored.activeSessionId = data.activeSessionId
        stored.activeSessionExpiresAt = data.activeSessionExpiresAt
        return { count: 1 }
      },
    },
  }
  return { database, stored }
}

test('only one concurrent login can claim the active session slot', async () => {
  const { database, stored } = createDatabase({
    id: 'user-1',
    activeSessionId: null,
    activeSessionExpiresAt: null,
  })

  const claims = await Promise.all([
    claimSingleUserSession(database, 'user-1'),
    claimSingleUserSession(database, 'user-1'),
  ])

  assert.equal(claims.filter(Boolean).length, 1)
  assert.ok(stored.activeSessionId)
  assert.equal(claims.find(Boolean), stored.activeSessionId)
})

test('a live session blocks a new device while an expired slot can be reclaimed', async () => {
  const { database, stored } = createDatabase({
    id: 'user-1',
    activeSessionId: 'existing-session',
    activeSessionExpiresAt: new Date(Date.now() + 60_000),
  })

  assert.equal(await claimSingleUserSession(database, 'user-1'), null)

  stored.activeSessionExpiresAt = new Date(Date.now() - 1)
  const reclaimed = await claimSingleUserSession(database, 'user-1')

  assert.ok(reclaimed)
  assert.equal(stored.activeSessionId, reclaimed)
})

test('cannot claim a session slot belonging to a different user', async () => {
  const { database } = createDatabase({
    id: 'user-1',
    activeSessionId: null,
    activeSessionExpiresAt: null,
  })

  assert.equal(await claimSingleUserSession(database, 'user-2'), null)
})

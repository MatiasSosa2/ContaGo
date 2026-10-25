import { randomUUID } from 'node:crypto'

export const SINGLE_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

export type SingleSessionDatabase = {
  user: {
    updateMany(args: {
      where: {
        id: string
        OR: (
          | { activeSessionId: null }
          | { activeSessionExpiresAt: { lte: Date } }
        )[]
      }
      data: {
        activeSessionId: string
        activeSessionExpiresAt: Date
      }
    }): Promise<{ count: number }>
  }
}

export async function claimSingleUserSession(
  database: SingleSessionDatabase,
  userId: string,
): Promise<string | null> {
  const now = new Date()
  const sessionId = randomUUID()
  const result = await database.user.updateMany({
    where: {
      id: userId,
      OR: [
        { activeSessionId: null },
        { activeSessionExpiresAt: { lte: now } },
      ],
    },
    data: {
      activeSessionId: sessionId,
      activeSessionExpiresAt: new Date(now.getTime() + SINGLE_SESSION_MAX_AGE_SECONDS * 1000),
    },
  })

  return result.count === 1 ? sessionId : null
}

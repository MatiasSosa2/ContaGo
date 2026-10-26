import { randomUUID } from 'node:crypto'

export const SINGLE_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
export const MAX_USER_SESSIONS = 3

export type UserSessionSlot = 1 | 2 | 3

type SessionSlotFields = typeof SLOT_FIELDS[UserSessionSlot]

const SLOT_FIELDS = {
  1: { id: 'activeSessionId', expiresAt: 'activeSessionExpiresAt' },
  2: { id: 'activeSessionId2', expiresAt: 'activeSessionExpiresAt2' },
  3: { id: 'activeSessionId3', expiresAt: 'activeSessionExpiresAt3' },
} as const
type SlotAvailability = { activeSessionId: null; activeSessionExpiresAt?: { lte: Date } }
  | { activeSessionExpiresAt: { lte: Date } }
  | { activeSessionId2: null; activeSessionExpiresAt2?: { lte: Date } }
  | { activeSessionExpiresAt2: { lte: Date } }
  | { activeSessionId3: null; activeSessionExpiresAt3?: { lte: Date } }
  | { activeSessionExpiresAt3: { lte: Date } }

export type SingleSessionDatabase = {
  user: {
    updateMany(args: {
      where: { id: string; OR: SlotAvailability[] } | Record<string, unknown>
      data: Record<string, string | Date | null>
    }): Promise<{ count: number }>
  }
}

export function getSessionSlotFields(slot: UserSessionSlot): SessionSlotFields {
  return SLOT_FIELDS[slot]
}

function isAvailableCondition(slot: UserSessionSlot, now: Date): SlotAvailability[] {
  if (slot === 1) {
    return [
      { activeSessionId: null },
      { activeSessionExpiresAt: { lte: now } },
    ]
  }
  if (slot === 2) {
    return [
      { activeSessionId2: null },
      { activeSessionExpiresAt2: { lte: now } },
    ]
  }
  return [
    { activeSessionId3: null },
    { activeSessionExpiresAt3: { lte: now } },
  ]
}

export async function claimSingleUserSession(
  database: SingleSessionDatabase,
  userId: string,
): Promise<{ sessionId: string; slot: UserSessionSlot } | null> {
  const now = new Date()
  for (const slot of [1, 2, 3] as const) {
    const fields = getSessionSlotFields(slot)
    const sessionId = randomUUID()
    const result = await database.user.updateMany({
      where: {
        id: userId,
        OR: isAvailableCondition(slot, now),
      },
      data: {
        [fields.id]: sessionId,
        [fields.expiresAt]: new Date(now.getTime() + SINGLE_SESSION_MAX_AGE_SECONDS * 1000),
      },
    })
    if (result.count === 1) return { sessionId, slot }
  }

  return null
}

export async function refreshUserSession(
  database: SingleSessionDatabase,
  input: { userId: string; sessionId: string; slot: UserSessionSlot },
): Promise<boolean> {
  const now = new Date()
  const fields = getSessionSlotFields(input.slot)
  const result = await database.user.updateMany({
    where: {
      id: input.userId,
      [fields.id]: input.sessionId,
      [fields.expiresAt]: { gt: now },
    },
    data: {
      [fields.expiresAt]: new Date(now.getTime() + SINGLE_SESSION_MAX_AGE_SECONDS * 1000),
    },
  })
  return result.count === 1
}

export async function releaseUserSession(
  database: SingleSessionDatabase,
  input: { userId: string; sessionId: string; slot: UserSessionSlot },
): Promise<void> {
  const fields = getSessionSlotFields(input.slot)
  await database.user.updateMany({
    where: { id: input.userId, [fields.id]: input.sessionId },
    data: { [fields.id]: null, [fields.expiresAt]: null },
  })
}

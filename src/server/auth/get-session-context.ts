import { cache } from 'react'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

import type { ActiveBusinessContext, AppRole } from './business-context'

export type SessionContext = {
  user: {
    id: string
    email: string
    name?: string | null
    image?: string | null
    emailVerified: boolean
  }
  activeBusiness: ActiveBusinessContext | null
  businesses: ActiveBusinessContext[]
  auth: {
    provider: 'google' | 'apple' | 'credentials' | 'mock'
    challengeSatisfied: boolean
  }
}

function normalizeRole(role: string | null | undefined): AppRole {
  if (role === 'ADMIN' || role === 'COLLABORATOR' || role === 'VIEWER') {
    return role
  }
  return 'COLLABORATOR'
}

// Memoized per-request: avoids redundant DB queries when multiple
// server components / actions call getSessionContext in the same request.
export const getSessionContext = cache(_getSessionContextImpl)

async function _getSessionContextImpl(): Promise<SessionContext | null> {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || !session.user.email) {
    return null
  }

  // Una sola query que trae el usuario + todas sus memberships activas.
  // A partir de ahí derivamos `businesses` y `activeBusiness` sin round-trips extra.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      defaultBusinessId: true,
      memberships: {
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        select: {
          role: true,
          businessId: true,
          business: { select: { id: true, name: true } },
        },
      },
    },
  })

  const memberships = user?.memberships ?? []
  const businesses: ActiveBusinessContext[] = memberships.map((m) => ({
    id: m.business.id,
    name: m.business.name,
    role: normalizeRole(m.role),
  }))

  const preferredId = session.activeBusiness?.id ?? null
  let activeMembership = preferredId
    ? memberships.find((m) => m.businessId === preferredId)
    : undefined

  if (!activeMembership) {
    activeMembership =
      memberships.find((m) => m.businessId === user?.defaultBusinessId) ??
      (memberships.length === 1 ? memberships[0] : undefined)
  }

  const activeBusiness: ActiveBusinessContext | null = activeMembership
    ? {
        id: activeMembership.business.id,
        name: activeMembership.business.name,
        role: normalizeRole(activeMembership.role),
      }
    : null

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
      emailVerified: Boolean(session.user.emailVerified),
    },
    activeBusiness,
    businesses,
    auth: {
      provider: session.auth?.provider ?? 'credentials',
      challengeSatisfied: session.auth?.challengeSatisfied ?? false,
    },
  }
}
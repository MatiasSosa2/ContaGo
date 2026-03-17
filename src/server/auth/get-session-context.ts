import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'

import {
  ensureUserBusinessMembership,
  listUserBusinesses,
  resolveUserActiveBusiness,
  type ActiveBusinessContext,
} from './business-context'

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

export async function getSessionContext(): Promise<SessionContext | null> {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || !session.user.email) {
    return null
  }

  const [businesses, activeBusiness] = await Promise.all([
    listUserBusinesses(session.user.id),
    session.activeBusiness?.id
      ? ensureUserBusinessMembership(session.user.id, session.activeBusiness.id)
      : resolveUserActiveBusiness(session.user.id),
  ])

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
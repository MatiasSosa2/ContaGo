import { redirect } from 'next/navigation'

import { requireAuth } from './require-auth'

export async function requirePageSession() {
  const sessionContext = await requireAuth()

  if (sessionContext.businesses.length === 0) {
    redirect('/auth/error?error=NoBusinessAccess')
  }

  if (!sessionContext.activeBusiness) {
    redirect('/select-business')
  }

  return sessionContext
}

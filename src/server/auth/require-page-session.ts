import { redirect } from 'next/navigation'

import { getSessionContext } from './get-session-context'

export async function requirePageSession() {
  const sessionContext = await getSessionContext()

  if (!sessionContext) {
    redirect('/auth/login')
  }

  if (sessionContext.businesses.length === 0) {
    redirect('/auth/error?error=NoBusinessAccess')
  }

  if (!sessionContext.activeBusiness) {
    redirect('/select-business')
  }

  return sessionContext
}

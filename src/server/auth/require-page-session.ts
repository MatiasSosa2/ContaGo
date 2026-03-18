import { redirect } from 'next/navigation'

import { buildAuthChallengeRedirectPath } from './challenge-routing'
import { getSessionContext } from './get-session-context'

export async function requirePageSession() {
  const sessionContext = await getSessionContext()

  if (!sessionContext) {
    redirect('/auth/login')
  }

  const challengeRedirectPath = buildAuthChallengeRedirectPath(sessionContext)

  if (challengeRedirectPath) {
    redirect(challengeRedirectPath)
  }

  if (sessionContext.businesses.length === 0) {
    redirect('/auth/error?error=NoBusinessAccess')
  }

  if (!sessionContext.activeBusiness) {
    redirect('/select-business')
  }

  return sessionContext
}

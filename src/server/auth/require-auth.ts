import { redirect } from 'next/navigation'
import { resolveRequiredAuthChallenge } from './challenge-routing'
import { getSessionContext, type SessionContext } from './get-session-context'

export async function requireAuth(): Promise<SessionContext> {
  const sessionContext = await getSessionContext()

  if (!sessionContext) {
    redirect('/auth/login')
  }

  if (resolveRequiredAuthChallenge(sessionContext)) {
    redirect('/auth/verify-code')
  }

  return sessionContext
}
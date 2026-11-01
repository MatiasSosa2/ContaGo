import { redirect } from 'next/navigation'
import { resolveRequiredAuthChallenge } from './challenge-routing'
import { getSessionContext, type SessionContext } from './get-session-context'
import { isAuthenticationUnavailable } from './auth-errors'

export async function requireAuth(): Promise<SessionContext> {
  let sessionContext: SessionContext | null
  try {
    sessionContext = await getSessionContext()
  } catch (error) {
    if (isAuthenticationUnavailable(error)) {
      redirect('/auth/error?error=AuthenticationUnavailable')
    }
    throw error
  }

  if (!sessionContext) {
    redirect('/auth/login')
  }

  if (resolveRequiredAuthChallenge(sessionContext)) {
    redirect('/auth/verify-code')
  }

  return sessionContext
}
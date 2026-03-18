import { resolveRequiredAuthChallenge } from './challenge-routing'
import { getSessionContext, type SessionContext } from './get-session-context'

export async function requireAuth(): Promise<SessionContext> {
  const sessionContext = await getSessionContext()

  if (!sessionContext) {
    throw new Error('Autenticacion requerida.')
  }

  if (resolveRequiredAuthChallenge(sessionContext)) {
    throw new Error('Debes verificar tu acceso antes de continuar.')
  }

  return sessionContext
}
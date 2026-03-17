import { getSessionContext, type SessionContext } from './get-session-context'

export async function requireAuth(): Promise<SessionContext> {
  const sessionContext = await getSessionContext()

  if (!sessionContext) {
    throw new Error('Autenticacion requerida.')
  }

  return sessionContext
}
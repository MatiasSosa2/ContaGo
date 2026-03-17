import type { ActiveBusinessContext } from './business-context'
import type { SessionContext } from './get-session-context'

import { requireAuth } from './require-auth'

export type BusinessSessionContext = SessionContext & {
  activeBusiness: ActiveBusinessContext
}

export async function requireBusinessContext(): Promise<BusinessSessionContext> {
  const sessionContext = await requireAuth()

  if (!sessionContext.activeBusiness) {
    throw new Error('No hay un negocio activo seleccionado para esta sesion.')
  }

  return sessionContext as BusinessSessionContext
}
import { redirect } from 'next/navigation'
import type { ActiveBusinessContext } from './business-context'
import type { SessionContext } from './get-session-context'

import { requireAuth } from './require-auth'

export type BusinessSessionContext = SessionContext & {
  activeBusiness: ActiveBusinessContext
}

export async function requireBusinessContext(): Promise<BusinessSessionContext> {
  const sessionContext = await requireAuth()

  if (!sessionContext.activeBusiness) {
    redirect('/select-business')
  }

  return sessionContext as BusinessSessionContext
}

export async function requireBusinessWriteContext(): Promise<BusinessSessionContext> {
  const sessionContext = await requireBusinessContext()

  if (sessionContext.activeBusiness.role === 'VIEWER') {
    redirect('/auth/error?error=AccessDenied')
  }

  return sessionContext
}
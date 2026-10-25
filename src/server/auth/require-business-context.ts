import { redirect } from 'next/navigation'
import type { ActiveBusinessContext } from './business-context'
import type { SessionContext } from './get-session-context'
import { canAdministerBusiness, canWriteBusiness } from './business-access'

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

  if (!canWriteBusiness(sessionContext.activeBusiness.role)) {
    redirect('/auth/error?error=AccessDenied')
  }

  return sessionContext
}

export async function requireBusinessAdminContext(): Promise<BusinessSessionContext> {
  const sessionContext = await requireBusinessContext()

  if (!canAdministerBusiness(sessionContext.activeBusiness.role)) {
    redirect('/auth/error?error=AccessDenied')
  }

  return sessionContext
}
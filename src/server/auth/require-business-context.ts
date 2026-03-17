import { requireAuth } from './require-auth'

export async function requireBusinessContext() {
  const sessionContext = await requireAuth()

  if (!sessionContext.activeBusiness) {
    throw new Error('No hay un negocio activo seleccionado para esta sesion.')
  }

  return sessionContext
}
export type AppRole = 'ADMIN' | 'COLLABORATOR' | 'VIEWER'

export function canWriteBusiness(role: AppRole): boolean {
  return role !== 'VIEWER'
}

export function canAdministerBusiness(role: AppRole): boolean {
  return role === 'ADMIN'
}

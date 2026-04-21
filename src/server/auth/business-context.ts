import prisma from '@/lib/prisma'

export type AppRole = 'ADMIN' | 'COLLABORATOR' | 'VIEWER'

export type ActiveBusinessContext = {
  id: string
  name: string
  role: AppRole
}

export type UserBusinessOption = ActiveBusinessContext

function normalizeRole(role: string | null | undefined): AppRole {
  if (role === 'ADMIN' || role === 'COLLABORATOR' || role === 'VIEWER') {
    return role
  }

  return 'COLLABORATOR'
}

export async function ensureUserBusinessMembership(
  userId: string,
  businessId: string,
): Promise<ActiveBusinessContext | null> {
  const membership = await prisma.businessMember.findFirst({
    where: {
      userId,
      businessId,
      status: 'ACTIVE',
    },
    select: {
      role: true,
      business: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!membership) {
    return null
  }

  return {
    id: membership.business.id,
    name: membership.business.name,
    role: normalizeRole(membership.role),
  }
}
import prisma from '@/lib/prisma'

export type AppRole = 'ADMIN' | 'COLLABORATOR' | 'VIEWER'

export type OperatingModel = 'SERVICES' | 'PRODUCTS' | 'BOTH'

export type ActiveBusinessContext = {
  id: string
  name: string
  role: AppRole
  operatingModel: OperatingModel
}

export type UserBusinessOption = ActiveBusinessContext

function normalizeRole(role: string | null | undefined): AppRole {
  if (role === 'ADMIN' || role === 'COLLABORATOR' || role === 'VIEWER') {
    return role
  }

  return 'COLLABORATOR'
}

export function normalizeOperatingModel(model: string | null | undefined): OperatingModel {
  if (model === 'SERVICES' || model === 'PRODUCTS' || model === 'BOTH') {
    return model
  }
  return 'BOTH'
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
          operatingModel: true,
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
    operatingModel: normalizeOperatingModel(membership.business.operatingModel),
  }
}
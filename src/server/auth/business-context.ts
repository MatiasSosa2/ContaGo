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

export async function resolveUserActiveBusiness(
  userId: string,
  preferredBusinessId?: string | null,
): Promise<ActiveBusinessContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      defaultBusinessId: true,
      memberships: {
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        select: {
          role: true,
          businessId: true,
          business: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  })

  if (!user || user.memberships.length === 0) {
    return null
  }

  const selectedMembership =
    user.memberships.find((membership) => membership.businessId === user.defaultBusinessId) ??
    user.memberships.find((membership) => membership.businessId === preferredBusinessId)

  if (selectedMembership) {
    return {
      id: selectedMembership.business.id,
      name: selectedMembership.business.name,
      role: normalizeRole(selectedMembership.role),
    }
  }

  if (user.memberships.length !== 1) {
    return null
  }

  const [singleMembership] = user.memberships

  return {
    id: singleMembership.business.id,
    name: singleMembership.business.name,
    role: normalizeRole(singleMembership.role),
  }
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

export async function listUserBusinesses(userId: string): Promise<UserBusinessOption[]> {
  const memberships = await prisma.businessMember.findMany({
    where: {
      userId,
      status: 'ACTIVE',
    },
    orderBy: { createdAt: 'asc' },
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

  return memberships.map((membership) => ({
    id: membership.business.id,
    name: membership.business.name,
    role: normalizeRole(membership.role),
  }))
}
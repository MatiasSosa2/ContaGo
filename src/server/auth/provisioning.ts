import type { Prisma } from '@prisma/client'

import prisma from '@/lib/prisma'
import { setupContableAccountsForBusiness } from '@/server/accounting/setup-contable-accounts'

const DEFAULT_EXPENSE_CATEGORIES = ['Sueldos', 'Alquiler', 'Publicidad', 'Impuestos']

export async function createInitialBusinessForUser(
  tx: Prisma.TransactionClient,
  input: {
    userId: string
    businessName: string
    operatingModel: 'SERVICES' | 'PRODUCTS' | 'BOTH'
  },
) {
  const business = await tx.business.create({
    data: {
      name: input.businessName,
      currency: 'ARS',
      operatingModel: input.operatingModel,
    },
    select: { id: true },
  })

  await tx.account.create({
    data: {
      name: 'Caja principal',
      type: 'CASH',
      currency: 'ARS',
      currentBalance: 0,
      businessId: business.id,
    },
  })

  await tx.businessMember.create({
    data: {
      userId: input.userId,
      businessId: business.id,
      role: 'ADMIN',
      status: 'ACTIVE',
      acceptedAt: new Date(),
    },
  })

  for (const name of DEFAULT_EXPENSE_CATEGORIES) {
    await tx.category.create({
      data: { name, type: 'EXPENSE', businessId: business.id },
    })
  }

  await setupContableAccountsForBusiness(business.id, tx)

  await tx.user.update({
    where: { id: input.userId },
    data: { defaultBusinessId: business.id },
  })

  return business
}

export async function ensureOAuthUserBusiness(userId: string) {
  return prisma.$transaction(async (tx) => {
    const existingMembership = await tx.businessMember.findFirst({
      where: { userId, status: 'ACTIVE' },
      select: { businessId: true },
    })

    if (existingMembership) {
      return existingMembership.businessId
    }

    const priorMembership = await tx.businessMember.findFirst({
      where: { userId },
      select: { businessId: true },
    })
    if (priorMembership) {
      return null
    }

    const business = await createInitialBusinessForUser(tx, {
      userId,
      businessName: 'Mi negocio',
      operatingModel: 'BOTH',
    })

    return business.id
  })
}

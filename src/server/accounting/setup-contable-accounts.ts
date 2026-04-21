/**
 * setup-contable-accounts.ts
 *
 * Inicializa el plan de cuentas contable del sistema para un negocio.
 * Se llama al crear un negocio nuevo y como parte de la migración retroactiva.
 *
 * CUENTAS DEL SISTEMA (isSystemAccount = true, invisibles en UX):
 *   - Clientes / CxC   → ASSET / RECEIVABLE
 *   - Proveedores / CxP → LIABILITY / PAYABLE
 *
 * CUENTAS FÍSICAS EXISTENTES (CASH | BANK | WALLET):
 *   → Se clasifican como ASSET
 *
 * CATEGORÍAS:
 *   → Cada categoría obtiene su Account contable (INCOME o EXPENSE)
 */

import type { Prisma } from '@prisma/client'

// Tipo que acepta tanto el cliente directo como un cliente de $transaction
type PrismaTx = Prisma.TransactionClient

// ─── Constantes de subtipos contables ─────────────────────────────────────────
export const CONTABLE_SUBTYPE = {
  RECEIVABLE: 'RECEIVABLE', // Clientes / CxC
  PAYABLE: 'PAYABLE',       // Proveedores / CxP
  CASH: 'CASH',
  BANK: 'BANK',
  SALES: 'SALES',
  EXPENSE_GEN: 'EXPENSE_GEN',
} as const

// ─── Función principal ─────────────────────────────────────────────────────────
export async function setupContableAccountsForBusiness(
  businessId: string,
  tx: PrismaTx,
): Promise<void> {
  // 1. Clasificar cuentas físicas existentes (CASH/BANK/WALLET → ASSET)
  await tx.account.updateMany({
    where: {
      businessId,
      isSystemAccount: false,
      contableType: null,
      type: { in: ['CASH', 'BANK', 'WALLET'] },
    },
    data: { contableType: 'ASSET' },
  })

  // También setear subtype según type físico
  await tx.account.updateMany({
    where: { businessId, isSystemAccount: false, type: 'CASH', subtype: null },
    data: { subtype: CONTABLE_SUBTYPE.CASH },
  })
  await tx.account.updateMany({
    where: {
      businessId,
      isSystemAccount: false,
      type: { in: ['BANK', 'WALLET'] },
      subtype: null,
    },
    data: { subtype: CONTABLE_SUBTYPE.BANK },
  })

  // 2. Crear cuenta sistema Clientes / CxC si no existe
  const existingCxC = await tx.account.findFirst({
    where: { businessId, isSystemAccount: true, subtype: CONTABLE_SUBTYPE.RECEIVABLE },
  })
  if (!existingCxC) {
    await tx.account.create({
      data: {
        name: 'Clientes / CxC',
        type: 'SYSTEM',
        contableType: 'ASSET',
        subtype: CONTABLE_SUBTYPE.RECEIVABLE,
        isSystemAccount: true,
        currency: 'ARS',
        currentBalance: 0,
        businessId,
      },
    })
  }

  // 3. Crear cuenta sistema Proveedores / CxP si no existe
  const existingCxP = await tx.account.findFirst({
    where: { businessId, isSystemAccount: true, subtype: CONTABLE_SUBTYPE.PAYABLE },
  })
  if (!existingCxP) {
    await tx.account.create({
      data: {
        name: 'Proveedores / CxP',
        type: 'SYSTEM',
        contableType: 'LIABILITY',
        subtype: CONTABLE_SUBTYPE.PAYABLE,
        isSystemAccount: true,
        currency: 'ARS',
        currentBalance: 0,
        businessId,
      },
    })
  }

  // 4. Crear cuenta contable para cada categoría que aún no tiene una
  const categories = await tx.category.findMany({
    where: { businessId, contableAccountId: null },
  })

  for (const cat of categories) {
    const contableType = cat.type === 'INCOME' ? 'INCOME' : 'EXPENSE'
    const subtype = cat.type === 'INCOME' ? CONTABLE_SUBTYPE.SALES : CONTABLE_SUBTYPE.EXPENSE_GEN

    const contableAccount = await tx.account.create({
      data: {
        name: cat.name,
        type: 'SYSTEM',
        contableType,
        subtype,
        isSystemAccount: true,
        currency: 'ARS',
        currentBalance: 0,
        businessId,
      },
    })

    await tx.category.update({
      where: { id: cat.id },
      data: { contableAccountId: contableAccount.id },
    })
  }
}

// ─── Crear cuenta contable para una categoría individual ──────────────────────
// Se usa en createCategory() al agregar una nueva categoría
export async function createContableAccountForCategory(
  categoryId: string,
  categoryName: string,
  categoryType: string, // 'INCOME' | 'EXPENSE'
  businessId: string,
  tx: PrismaTx,
): Promise<void> {
  const contableType = categoryType === 'INCOME' ? 'INCOME' : 'EXPENSE'
  const subtype = categoryType === 'INCOME' ? CONTABLE_SUBTYPE.SALES : CONTABLE_SUBTYPE.EXPENSE_GEN

  const contableAccount = await tx.account.create({
    data: {
      name: categoryName,
      type: 'SYSTEM',
      contableType,
      subtype,
      isSystemAccount: true,
      currency: 'ARS',
      currentBalance: 0,
      businessId,
    },
  })

  await tx.category.update({
    where: { id: categoryId },
    data: { contableAccountId: contableAccount.id },
  })
}

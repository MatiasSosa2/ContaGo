/**
 * Helpers comunes de las acciones: negocio activo, fechas de movimientos, períodos y búsquedas acotadas al negocio.
 * Las expone src/app/actions.ts (que elige entre datos reales y demo).
 */

import prisma from '@/lib/prisma'
import { requireBusinessContext, requireBusinessWriteContext } from '@/server/auth/require-business-context'
import { createContableAccountForCategory } from '@/server/accounting/setup-contable-accounts'
import { whereInBusiness } from './business-scope'

export { whereInBusiness } from './business-scope'

export async function getBusinessId(writeAccess = false) {
  const sessionContext = writeAccess
    ? await requireBusinessWriteContext()
    : await requireBusinessContext()
  return sessionContext.activeBusiness.id
}

// Calendario argentino (módulo puro, testeable): se reexporta para no cambiar imports.
import { BUSINESS_TZ } from '@/lib/art-calendar'
export {
  BUSINESS_TZ,
  artStartOfDay,
  artEndOfDay,
  getArtCalendarParts,
  dueDateEndOfDay,
  computePeriodRange,
  type DashboardPeriodKey,
} from '@/lib/art-calendar'

/**
 * Fecha de un movimiento a partir del "yyyy-mm-dd" del formulario.
 * `new Date('2026-09-25')` es medianoche UTC = 24/09 21 h en Argentina, y el movimiento
 * caía en el día (y a veces el período) anterior. Si es hoy usamos la hora actual;
 * si es otro día, el mediodía de ese día en Argentina.
 */
export function parseMovementDate(dateStr: string | undefined | null): Date {
  if (!dateStr) return new Date()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return new Date(dateStr)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ }).format(new Date())
  if (dateStr === today) return new Date()
  return new Date(`${dateStr}T12:00:00-03:00`)
}

export async function getScopedAccount(id: string, businessId: string) {
  return prisma.account.findFirst({
    where: whereInBusiness(businessId, { id }),
    select: { id: true, currentBalance: true, isSystemAccount: true, currency: true },
  })
}

/**
 * Obtiene (o crea) una categoría por defecto para asignar automáticamente cuando
 * el formulario no envía categoría (ej: venta de producto, otros ingresos, etc).
 * Garantiza que toda transacción genere asiento contable.
 */
export async function getOrCreateDefaultCategory(
  businessId: string,
  type: 'INCOME' | 'EXPENSE',
  subType: string | undefined,
): Promise<string | null> {
  const name =
    subType === 'SALE' || subType === 'SALE_PRODUCT' ? 'Ventas de mercadería' :
    subType === 'SALE_SERVICE' ? 'Ventas de servicios' :
    subType === 'SALE_BIEN_USO' ? 'Resultado por venta de bienes de uso' :
    subType === 'COBRO_CREDITO' ? 'Cobros de crédito' :
    subType === 'DIFERENCIA_CAJA' ? 'Diferencias de caja' :
    subType === 'PURCHASE' || subType === 'PURCHASE_PRODUCT' ? 'Compras' :
    type === 'INCOME' ? 'Otros ingresos' : 'Otros egresos'

  const existing = await prisma.category.findFirst({
    where: { businessId, name, type },
    select: { id: true, contableAccountId: true },
  })
  if (existing) {
    if (!existing.contableAccountId) {
      await createContableAccountForCategory(existing.id, name, type, businessId, prisma as never)
    }
    return existing.id
  }

  const created = await prisma.category.create({
    data: { name, type, businessId },
    select: { id: true },
  })
  await createContableAccountForCategory(created.id, name, type, businessId, prisma as never)
  return created.id
}

export type DateRange = { from?: Date; to?: Date }

/** Fin del día (hora Argentina) de un "yyyy-mm-dd"; sin fecha, ahora. */
export function endOfMovementDay(dateStr?: string | null): Date {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return new Date()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ }).format(new Date())
  if (dateStr === today) return new Date()
  return new Date(`${dateStr}T23:59:59.999-03:00`)
}

export const round2 = (v: number) => Math.round(v * 100) / 100

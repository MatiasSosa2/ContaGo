/**
 * Helpers comunes de las acciones: negocio activo, fechas de movimientos, períodos y búsquedas acotadas al negocio.
 * Las expone src/app/actions.ts (que elige entre datos reales y demo).
 */

import prisma from '@/lib/prisma'
import { requireBusinessContext } from '@/server/auth/require-business-context'
import { createContableAccountForCategory } from '@/server/accounting/setup-contable-accounts'

export async function getBusinessId() {
  const sessionContext = await requireBusinessContext()
  return sessionContext.activeBusiness.id
}

const BUSINESS_TZ = 'America/Argentina/Buenos_Aires'

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
    where: { id, businessId },
    select: { id: true, currentBalance: true },
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

export type DashboardPeriodKey = 'diario' | 'semanal' | 'mensual' | 'anual' | 'custom'

export function computePeriodRange(
  period: DashboardPeriodKey,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
  selectedDay?: string,
  selectedWeekStart?: string,
): { from: Date; to: Date; prevFrom: Date; prevTo: Date; label: string } {
  const now = new Date()
  let from: Date, to: Date, prevFrom: Date, prevTo: Date, label: string

  switch (period) {
    case 'diario': {
      const target = selectedDay ? new Date(selectedDay + 'T12:00:00') : now
      from = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0)
      to = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 23, 59, 59, 999)
      const prev = new Date(from); prev.setDate(prev.getDate() - 1)
      prevFrom = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate(), 0, 0, 0)
      prevTo = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate(), 23, 59, 59, 999)
      const isToday = from.getTime() === new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      label = isToday
        ? 'Hoy'
        : from.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
      break
    }
    case 'semanal': {
      let weekStart: Date
      if (selectedWeekStart) {
        weekStart = new Date(selectedWeekStart + 'T12:00:00')
        weekStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate(), 0, 0, 0)
      } else {
        const dayOfWeek = now.getDay()
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
        weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset, 0, 0, 0)
      }
      from = weekStart
      to = new Date(from); to.setDate(to.getDate() + 6); to.setHours(23, 59, 59, 999)
      prevFrom = new Date(from); prevFrom.setDate(prevFrom.getDate() - 7)
      prevTo = new Date(from); prevTo.setDate(prevTo.getDate() - 1); prevTo.setHours(23, 59, 59, 999)
      const fmtDate = (d: Date) => d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
      label = `${fmtDate(from)} – ${fmtDate(to)}`
      break
    }
    case 'mensual': {
      const targetYear = selectedYear ?? now.getFullYear()
      const targetMonthIndex = (selectedMonth ?? (now.getMonth() + 1)) - 1
      const isCurrentMonth = targetYear === now.getFullYear() && targetMonthIndex === now.getMonth()

      from = new Date(targetYear, targetMonthIndex, 1, 0, 0, 0)
      to = isCurrentMonth
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
        : new Date(targetYear, targetMonthIndex + 1, 0, 23, 59, 59, 999)
      prevFrom = new Date(targetYear, targetMonthIndex - 1, 1, 0, 0, 0)
      prevTo = isCurrentMonth
        ? new Date(
            targetYear,
            targetMonthIndex - 1,
            Math.min(now.getDate(), new Date(targetYear, targetMonthIndex, 0).getDate()),
            23,
            59,
            59,
            999,
          )
        : new Date(targetYear, targetMonthIndex, 0, 23, 59, 59, 999)
      label = from.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
      label = label.charAt(0).toUpperCase() + label.slice(1)
      break
    }
    case 'anual': {
      const targetYear = selectedYear ?? now.getFullYear()
      const isCurrentYear = targetYear === now.getFullYear()
      from = new Date(targetYear, 0, 1, 0, 0, 0)
      to = isCurrentYear
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
        : new Date(targetYear, 11, 31, 23, 59, 59, 999)
      prevFrom = new Date(targetYear - 1, 0, 1, 0, 0, 0)
      prevTo = isCurrentYear
        ? new Date(targetYear - 1, now.getMonth(), now.getDate(), 23, 59, 59, 999)
        : new Date(targetYear - 1, 11, 31, 23, 59, 59, 999)
      label = `Año ${targetYear}`
      break
    }
    case 'custom': {
      from = customFrom ? new Date(customFrom + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
      to = customTo ? new Date(customTo + 'T23:59:59.999') : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      const durationMs = to.getTime() - from.getTime()
      prevTo = new Date(from.getTime() - 1)
      prevFrom = new Date(prevTo.getTime() - durationMs)
      prevFrom.setHours(0, 0, 0, 0)
      prevTo.setHours(23, 59, 59, 999)
      const fmtDate = (d: Date) => d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
      label = `${fmtDate(from)} – ${fmtDate(to)}`
      break
    }
  }

  return { from, to, prevFrom, prevTo, label }
}

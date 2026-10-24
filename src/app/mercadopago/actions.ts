'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import type { ActionResult } from '@/lib/validations'
import { getSessionContext } from '@/server/auth/get-session-context'
import { createTransaction } from '@/server/db/transactions'
import { getScopedAccount } from '@/server/db/shared'
import { MercadoPagoError, searchApprovedPayments, toReviewRow } from '@/server/mercadopago/client'
import { getConnection, getValidAccessToken } from '@/server/mercadopago/connection'

const MAX_RANGE_DAYS = 366
const DAY_MS = 24 * 60 * 60 * 1000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

async function requireAdmin() {
  const session = await getSessionContext()
  if (!session?.activeBusiness || session.activeBusiness.role !== 'ADMIN') {
    return null
  }
  return { businessId: session.activeBusiness.id }
}

function argentinaDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(date)
}

export async function syncMercadoPagoPayments(
  fromDate: string,
  toDate: string,
): Promise<ActionResult<{ encontrados: number; nuevos: number }>> {
  const admin = await requireAdmin()
  if (!admin) return { success: false, error: 'Solo un administrador puede sincronizar Mercado Pago' }

  if (!DATE_RE.test(fromDate) || !DATE_RE.test(toDate)) {
    return { success: false, error: 'Las fechas no son válidas' }
  }
  const from = new Date(`${fromDate}T00:00:00.000-03:00`)
  const to = new Date(`${toDate}T23:59:59.999-03:00`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return { success: false, error: 'El rango de fechas no es válido' }
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
    return { success: false, error: `El rango máximo es de ${MAX_RANGE_DAYS} días` }
  }

  try {
    const connection = await getConnection(admin.businessId)
    if (!connection) return { success: false, error: 'Primero vinculá tu cuenta de Mercado Pago' }

    const accessToken = await getValidAccessToken(admin.businessId)
    const payments = await searchApprovedPayments(accessToken, from.toISOString(), to.toISOString())
    const rows = payments.map(toReviewRow)

    // Se omiten pagos ya presentes en revisión, importados o ignorados.
    const existing = await prisma.mercadoPagoPayment.findMany({
      where: { businessId: admin.businessId, mpPaymentId: { in: rows.map((r) => r.mpPaymentId) } },
      select: { mpPaymentId: true },
    })
    const known = new Set(existing.map((e) => e.mpPaymentId))
    const nuevos = rows.filter((r) => !known.has(r.mpPaymentId))

    if (nuevos.length > 0) {
      await prisma.mercadoPagoPayment.createMany({
        data: nuevos.map((r) => ({ ...r, businessId: admin.businessId })),
      })
    }
    await prisma.mercadoPagoConnection.update({
      where: { businessId: admin.businessId },
      data: { lastSyncAt: new Date() },
    })

    revalidatePath('/mercadopago')
    return { success: true, data: { encontrados: rows.length, nuevos: nuevos.length } }
  } catch (error) {
    if (error instanceof MercadoPagoError) return { success: false, error: error.message }
    console.error('Error al sincronizar Mercado Pago')
    return { success: false, error: 'No se pudo sincronizar con Mercado Pago' }
  }
}

export async function importMercadoPagoPayment(
  paymentId: string,
  accountId: string,
  categoryId?: string,
): Promise<ActionResult> {
  const admin = await requireAdmin()
  if (!admin) return { success: false, error: 'Solo un administrador puede importar movimientos' }

  const row = await prisma.mercadoPagoPayment.findFirst({
    where: { id: paymentId, businessId: admin.businessId, importStatus: 'PENDING' },
  })
  if (!row) return { success: false, error: 'El pago ya no está pendiente de revisión' }

  const account = await getScopedAccount(accountId, admin.businessId)
  if (!account) return { success: false, error: 'Cuenta inválida' }

  // Se registra el neto (lo que llega a la cuenta); bruto y comisión quedan en la descripción.
  const detalle = `Mercado Pago #${row.mpPaymentId} (bruto ${row.amountGross}, comisión ${row.feeAmount})`
  const description = (row.description ? `${row.description} - ${detalle}` : detalle).slice(0, 200)

  const formData = new FormData()
  formData.set('amount', String(row.amountNet))
  formData.set('description', description)
  formData.set('type', 'INCOME')
  formData.set('subType', 'OTHER_INCOME')
  formData.set('accountId', accountId)
  if (categoryId) formData.set('categoryId', categoryId)
  formData.set('date', argentinaDate(row.dateApproved))
  formData.set('currency', row.currency)
  formData.set('esCredito', 'false')
  formData.set('estado', 'COBRADO')

  const result = await createTransaction(formData)
  if (!result.success) return { success: false, error: result.error }

  await prisma.mercadoPagoPayment.update({
    where: { id: row.id },
    data: { importStatus: 'IMPORTED', transactionId: result.data?.transactionId ?? null },
  })

  revalidatePath('/mercadopago')
  return { success: true }
}

export async function ignoreMercadoPagoPayment(paymentId: string): Promise<ActionResult> {
  const admin = await requireAdmin()
  if (!admin) return { success: false, error: 'Solo un administrador puede modificar Mercado Pago' }

  await prisma.mercadoPagoPayment.updateMany({
    where: { id: paymentId, businessId: admin.businessId, importStatus: 'PENDING' },
    data: { importStatus: 'IGNORED' },
  })

  revalidatePath('/mercadopago')
  return { success: true }
}

export async function disconnectMercadoPago(): Promise<ActionResult> {
  const admin = await requireAdmin()
  if (!admin) return { success: false, error: 'Solo un administrador puede desvincular Mercado Pago' }

  await prisma.$transaction([
    prisma.mercadoPagoPayment.deleteMany({ where: { businessId: admin.businessId, importStatus: 'PENDING' } }),
    prisma.mercadoPagoConnection.deleteMany({ where: { businessId: admin.businessId } }),
  ])

  revalidatePath('/mercadopago')
  return { success: true }
}

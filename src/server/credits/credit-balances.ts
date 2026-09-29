/**
 * credit-balances.ts
 *
 * Créditos (a cobrar) y deudas (a pagar) agrupados por cliente / proveedor, con el
 * saldo neteado de cobros y pagos a una fecha. Misma regla que el Balance general
 * (getAssetSnapshotAsOf): saldo de cada crédito = monto − cobros/pagos vinculados
 * hasta esa fecha. Así el total de la pestaña Créditos coincide con el del Balance.
 */

import prisma from '@/lib/prisma'

export type CreditMovement = {
  id: string
  date: Date
  /** CREDITO: venta/compra a crédito (suma al saldo). PAGO: cobro/pago (resta). */
  kind: 'CREDITO' | 'PAGO'
  description: string
  amount: number
  /** Caja donde impactó (solo cobros/pagos) */
  account: string | null
}

export type PendingInstallment = {
  id: string
  description: string
  cuotaNumero: number | null
  cuotasTotal: number | null
  fechaVencimiento: Date | null
  /** Lo que falta de esta cuota */
  saldo: number
  vencida: boolean
}

export type CreditAccount = {
  key: string
  contactId: string | null
  name: string
  type: 'INCOME' | 'EXPENSE'
  currency: string
  total: number
  aplicado: number
  saldo: number
  proximoVencimiento: Date | null
  vencido: boolean
  /** Cuota pendiente más vieja: la que se preselecciona al cobrar/pagar */
  primeraPendienteId: string | null
  cuotasPendientes: PendingInstallment[]
  movimientos: CreditMovement[]
}

const round2 = (v: number) => Math.round(v * 100) / 100

export async function getCreditAccountsData(businessId: string, asOf: Date): Promise<CreditAccount[]> {
  const creditos = await prisma.transaction.findMany({
    where: { businessId, esCredito: true, date: { lte: asOf } },
    orderBy: { date: 'asc' },
    select: {
      id: true, type: true, amount: true, currency: true, date: true, description: true,
      fechaVencimiento: true, cuotaNumero: true, cuotasTotal: true, operacionId: true,
      contact: { select: { id: true, name: true } },
    },
  })
  if (creditos.length === 0) return []

  const pagos = await prisma.transaction.findMany({
    where: { businessId, linkedCreditoId: { in: creditos.map((c) => c.id) }, date: { lte: asOf } },
    orderBy: { date: 'asc' },
    select: { id: true, amount: true, date: true, description: true, operacionId: true, linkedCreditoId: true, account: { select: { name: true } } },
  })
  const aplicadoPor = new Map<string, number>()
  for (const p of pagos) aplicadoPor.set(p.linkedCreditoId!, (aplicadoPor.get(p.linkedCreditoId!) ?? 0) + p.amount)

  const now = new Date()
  const cuentas = new Map<string, CreditAccount>()
  const creditoCuenta = new Map<string, CreditAccount>()
  // Movimientos de una misma operación (cuotas, o un cobro que salda varias) van en una sola línea
  const lineas = new Map<string, CreditMovement>()

  for (const c of creditos) {
    const type = c.type === 'INCOME' ? 'INCOME' : 'EXPENSE'
    const key = `${type}:${c.contact?.id ?? 'sin'}:${c.currency}`
    let cuenta = cuentas.get(key)
    if (!cuenta) {
      cuenta = {
        key, contactId: c.contact?.id ?? null,
        name: c.contact?.name ?? (type === 'INCOME' ? 'Sin cliente' : 'Sin proveedor'),
        type, currency: c.currency, total: 0, aplicado: 0, saldo: 0,
        proximoVencimiento: null, vencido: false, primeraPendienteId: null, cuotasPendientes: [], movimientos: [],
      }
      cuentas.set(key, cuenta)
    }
    creditoCuenta.set(c.id, cuenta)
    cuenta.total += c.amount

    const saldo = round2(Math.max(0, c.amount - (aplicadoPor.get(c.id) ?? 0)))
    if (saldo > 0.009) {
      const vencida = Boolean(c.fechaVencimiento && c.fechaVencimiento < now)
      cuenta.cuotasPendientes.push({
        id: c.id, description: c.description.replace(/ · cuota \d+\/\d+$/, ''),
        cuotaNumero: c.cuotaNumero, cuotasTotal: c.cuotasTotal, fechaVencimiento: c.fechaVencimiento, saldo, vencida,
      })
      if (vencida) cuenta.vencido = true
      if (c.fechaVencimiento && (!cuenta.proximoVencimiento || c.fechaVencimiento < cuenta.proximoVencimiento)) {
        cuenta.proximoVencimiento = c.fechaVencimiento
      }
    }

    const lineKey = c.operacionId ? `C:${c.operacionId}` : `C:${c.id}`
    const linea = lineas.get(lineKey)
    if (linea) linea.amount += c.amount
    else {
      const l: CreditMovement = { id: lineKey, date: c.date, kind: 'CREDITO', description: c.description.replace(/ · cuota \d+\/\d+$/, ''), amount: c.amount, account: null }
      lineas.set(lineKey, l)
      cuenta.movimientos.push(l)
    }
  }

  for (const p of pagos) {
    const cuenta = creditoCuenta.get(p.linkedCreditoId!)
    if (!cuenta) continue
    cuenta.aplicado += p.amount
    const lineKey = p.operacionId ? `P:${p.operacionId}` : `P:${p.id}`
    const linea = lineas.get(lineKey)
    if (linea) linea.amount += p.amount
    else {
      const l: CreditMovement = { id: lineKey, date: p.date, kind: 'PAGO', description: p.description, amount: p.amount, account: p.account?.name ?? null }
      lineas.set(lineKey, l)
      cuenta.movimientos.push(l)
    }
  }

  return [...cuentas.values()].map((c) => {
    c.cuotasPendientes.sort((a, b) => (a.fechaVencimiento?.getTime() ?? Infinity) - (b.fechaVencimiento?.getTime() ?? Infinity))
    c.movimientos.sort((a, b) => b.date.getTime() - a.date.getTime())
    return {
      ...c,
      total: round2(c.total),
      aplicado: round2(c.aplicado),
      saldo: round2(c.cuotasPendientes.reduce((s, q) => s + q.saldo, 0)),
      primeraPendienteId: c.cuotasPendientes[0]?.id ?? null,
    }
  })
}

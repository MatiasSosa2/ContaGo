/**
 * cash-statement.ts
 *
 * Detalle del Estado de flujo de efectivo (de todas las cajas de una moneda o de una sola):
 * - Ingresos por tipo: Ventas cobradas (por producto), Cobros de créditos (por cliente),
 *   Venta de bienes de uso (por bien), Sobrantes de caja y categorías propias.
 * - Egresos por tipo: Operativos (mercadería por proveedor, sueldos, alquiler...),
 *   Inversiones (bienes de uso) y Deudas (pagos a proveedores, por proveedor).
 * - Cambios de caja: con una caja elegida, lo que entra o sale de ella hacia otras cajas es
 *   "Cambio de caja" en ingresos o egresos (saldo inicial + ingresos − egresos = saldo final).
 *   Con todas las cajas, los de la misma moneda se compensan y los de otra moneda quedan en
 *   "Cambio de moneda".
 * Cada renglón trae sus movimientos para verlos en detalle. Mismos números que Cajas
 * (src/server/cash/cash-flow.ts): solo lo que movió caja (sin créditos hasta que se cobran).
 */

import prisma from '@/lib/prisma'
import { CASH_ACCOUNT_TYPES, getCashBalancesAt } from './cash-flow'

export type CashMov = { id: string; date: Date; description: string; amount: number; account: string | null }
export type CashLine = { label: string; amount: number; movs: CashMov[]; children?: CashLine[] }
export type CashKind = { label: string; amount: number; lines: CashLine[] }

export type CashStatement = {
  currency: string
  accountId: string | null
  saldoInicial: number
  saldoFinal: number
  ingresos: CashLine[]
  totalIngresos: number
  egresos: CashKind[]
  totalEgresos: number
  /** Solo con todas las cajas: neto de cambios con cajas de otra moneda */
  cambioMoneda: number
  exchangeNotes: string[]
  accounts: { id: string; name: string; type: string; inicio: number; cierre: number }[]
}

/** Agrupa movimientos en renglones (y sub-renglones) sumando montos */
class Lines {
  private map = new Map<string, { amount: number; movs: CashMov[]; children: Map<string, { amount: number; movs: CashMov[] }> }>()
  add(label: string, mov: CashMov, child?: string | null) {
    const line = this.map.get(label) ?? { amount: 0, movs: [] as CashMov[], children: new Map<string, { amount: number; movs: CashMov[] }>() }
    line.amount += mov.amount
    line.movs.push(mov)
    if (child) {
      const c = line.children.get(child) ?? { amount: 0, movs: [] }
      c.amount += mov.amount
      c.movs.push(mov)
      line.children.set(child, c)
    }
    this.map.set(label, line)
  }
  build(): CashLine[] {
    const byDate = (m: CashMov[]) => [...m].sort((a, b) => b.date.getTime() - a.date.getTime())
    return [...this.map.entries()]
      .map(([label, l]) => ({
        label,
        amount: l.amount,
        movs: byDate(l.movs),
        children: l.children.size > 0
          ? [...l.children.entries()].map(([cl, c]) => ({ label: cl, amount: c.amount, movs: byDate(c.movs) })).sort((a, b) => b.amount - a.amount)
          : undefined,
      }))
      .sort((a, b) => b.amount - a.amount)
  }
}

const sum = (lines: { amount: number }[]) => lines.reduce((s, l) => s + l.amount, 0)

export async function getCashStatementData(businessId: string, from: Date, to: Date, currency: string, accountId?: string | null): Promise<CashStatement> {
  const cajas = await prisma.account.findMany({
    where: { businessId, isSystemAccount: false, type: { in: [...CASH_ACCOUNT_TYPES] }, currency },
    select: { id: true, name: true, type: true },
    orderBy: { name: 'asc' },
  })
  const elegida = accountId ? cajas.find((c) => c.id === accountId) ?? null : null
  const ids = elegida ? [elegida.id] : cajas.map((c) => c.id)
  const idSet = new Set(ids)

  const [txs, transfers, inicio, cierre] = await Promise.all([
    prisma.transaction.findMany({
      where: { businessId, esCredito: false, accountId: { in: ids }, date: { gte: from, lte: to } },
      select: {
        id: true, type: true, subType: true, amount: true, date: true, description: true,
        account: { select: { name: true } },
        category: { select: { name: true } },
        subcategory: { select: { name: true } },
        contact: { select: { name: true } },
        bienDeUso: { select: { nombre: true } },
        producto: { select: { nombre: true } },
        operacion: { select: { subtotal: true, items: { select: { subtotal: true, producto: { select: { nombre: true } } } } } },
      },
    }),
    prisma.cashTransfer.findMany({
      where: { businessId, date: { gte: from, lte: to }, OR: [{ fromAccountId: { in: ids } }, { toAccountId: { in: ids } }] },
      select: {
        id: true, date: true, description: true, amountFrom: true, amountTo: true, exchangeRate: true, fromAccountId: true, toAccountId: true,
        fromAccount: { select: { name: true, currency: true } },
        toAccount: { select: { name: true, currency: true } },
      },
    }),
    getCashBalancesAt(businessId, new Date(from.getTime() - 1)),
    getCashBalancesAt(businessId, to),
  ])

  const ingresos = new Lines()
  const egresos = { Operativos: new Lines(), Inversiones: new Lines(), Deudas: new Lines(), 'Cambio de caja': new Lines() }

  for (const tx of txs) {
    const mov: CashMov = { id: tx.id, date: tx.date, description: tx.description, amount: tx.amount, account: tx.account?.name ?? null }
    const sub = tx.subType ?? ''
    if (tx.type === 'INCOME') {
      if (sub === 'SALE_PRODUCT' || sub === 'SALE') {
        // Lo cobrado de una venta se reparte entre sus productos según su peso en la venta
        const items = tx.operacion?.items ?? []
        const base = items.reduce((s, i) => s + i.subtotal, 0)
        if (items.length > 0 && base > 0) {
          for (const it of items) ingresos.add('Ventas cobradas', { ...mov, amount: (tx.amount * it.subtotal) / base }, it.producto.nombre)
        } else {
          ingresos.add('Ventas cobradas', mov, tx.producto?.nombre ?? 'Sin detalle')
        }
      } else if (sub === 'COBRO_CREDITO') ingresos.add('Cobros de créditos', mov, tx.contact?.name ?? 'Sin cliente')
      else if (sub === 'SALE_BIEN_USO') ingresos.add('Venta de bienes de uso', mov, tx.bienDeUso?.nombre ?? 'Sin detalle')
      else if (sub === 'DIFERENCIA_CAJA') ingresos.add('Sobrantes de caja', mov)
      else ingresos.add(tx.category?.name ?? 'Otros ingresos', mov, tx.subcategory?.name)
    } else {
      if (sub === 'PURCHASE_PRODUCT' || sub === 'PURCHASE') egresos.Operativos.add('Compras de mercadería', mov, tx.contact?.name ?? 'Sin proveedor')
      else if (sub === 'PAGO_DEUDA') egresos.Deudas.add('Pago de deudas', mov, tx.contact?.name ?? 'Sin proveedor')
      else if (sub === 'PURCHASE_BIEN_USO') egresos.Inversiones.add('Compra de bienes de uso', mov, tx.bienDeUso?.nombre ?? 'Sin detalle')
      else if (sub === 'DIFERENCIA_CAJA') egresos.Operativos.add('Faltantes de caja', mov)
      else egresos.Operativos.add(tx.category?.name ?? 'Otros egresos', mov, tx.subcategory?.name)
    }
  }

  // Cambios de caja
  let cambioMoneda = 0
  const exchangeNotes: string[] = []
  const fmtN = (v: number) => Math.round(v).toLocaleString('es-AR')
  for (const t of transfers) {
    const sale = idSet.has(t.fromAccountId)
    const entra = idSet.has(t.toAccountId)
    if (sale && entra) continue // entre cajas del conjunto: se compensa
    const cruzaMoneda = t.fromAccount.currency !== t.toAccount.currency
    if (!elegida) {
      // Todas las cajas: solo quedan los que cruzan de moneda
      if (!cruzaMoneda) continue
      cambioMoneda += entra ? t.amountTo : -t.amountFrom
      const compra = t.toAccount.currency === 'USD'
      const dolares = compra ? t.amountTo : t.amountFrom
      exchangeNotes.push(`${compra ? 'Compra' : 'Venta'} de US$${fmtN(dolares)}${t.exchangeRate ? ` a $${fmtN(t.exchangeRate)}` : ''}`)
      continue
    }
    if (entra) {
      ingresos.add('Cambio de caja', { id: `${t.id}-in`, date: t.date, description: t.description ?? 'Cambio de caja', amount: t.amountTo, account: t.toAccount.name }, `Desde ${t.fromAccount.name}`)
    } else {
      egresos['Cambio de caja'].add(`Hacia ${t.toAccount.name}`, { id: `${t.id}-out`, date: t.date, description: t.description ?? 'Cambio de caja', amount: t.amountFrom, account: t.fromAccount.name })
    }
  }

  const ingresosLines = ingresos.build()
  const egresosKinds: CashKind[] = (Object.entries(egresos) as [string, Lines][])
    .map(([label, l]) => { const lines = l.build(); return { label, amount: sum(lines), lines } })
    .filter((k) => k.lines.length > 0)

  const saldoDe = (b: Record<string, number>) => ids.reduce((s, id) => s + (b[id] ?? 0), 0)

  return {
    currency,
    accountId: elegida?.id ?? null,
    saldoInicial: saldoDe(inicio),
    saldoFinal: saldoDe(cierre),
    ingresos: ingresosLines,
    totalIngresos: sum(ingresosLines),
    egresos: egresosKinds,
    totalEgresos: sum(egresosKinds),
    cambioMoneda,
    exchangeNotes,
    accounts: cajas.map((c) => ({ id: c.id, name: c.name, type: c.type, inicio: inicio[c.id] ?? 0, cierre: cierre[c.id] ?? 0 })),
  }
}

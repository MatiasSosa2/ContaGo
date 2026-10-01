/**
 * balance-sheet.ts
 *
 * Estado patrimonial a una fecha de corte (todo al mismo día):
 * - Activo: Caja y bancos (por caja; las cajas en dólares convertidas a pesos),
 *   Créditos a cobrar (por cliente, neto de cobros), Mercadería (por producto, valuada a lo
 *   que costó cada compra: se reproducen los movimientos hasta esa fecha) y Bienes de uso
 *   (por bien: comprados hasta esa fecha y no vendidos; sin amortización).
 * - Pasivo: Deudas (por proveedor, neto de pagos).
 * - Patrimonio neto = Activo − Pasivo.
 * Todo en pesos; "rate" es la última cotización registrada hasta la fecha (pesos por dólar),
 * para mostrar el estado en dólares.
 */

import prisma from '@/lib/prisma'
import { CASH_ACCOUNT_TYPES, getCashBalancesAt } from '@/server/cash/cash-flow'
import { getCreditAccountsData } from '@/server/credits/credit-balances'

export type BalanceItem = { label: string; amount: number; note?: string }
export type BalanceRubro = { key: 'caja' | 'creditos' | 'mercaderia' | 'bienes' | 'deudas'; label: string; amount: number; items: BalanceItem[] }

export type BalanceSheet = {
  asOf: Date
  /** Pesos por dólar a la fecha (null si nunca se registró una cotización) */
  rate: number | null
  activo: BalanceRubro[]
  pasivo: BalanceRubro[]
  totalActivo: number
  totalPasivo: number
  patrimonio: number
}

const sum = (items: { amount: number }[]) => items.reduce((s, i) => s + i.amount, 0)
const byAmount = (a: BalanceItem, b: BalanceItem) => b.amount - a.amount

/** Valor de la mercadería de cada producto a la fecha (reproduciendo compras y ventas) */
async function mercaderiaAt(businessId: string, asOf: Date): Promise<BalanceItem[]> {
  const productos = await prisma.producto.findMany({ where: { businessId, activo: true }, select: { id: true, nombre: true, precioCosto: true } })
  const movs = await prisma.movimientoStock.findMany({
    where: { producto: { businessId, activo: true }, fecha: { lte: asOf } },
    orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
    select: { productoId: true, tipo: true, cantidad: true, precio: true, costoUnitario: true },
  })
  const estado = new Map<string, { stock: number; valor: number }>()
  const costoActual = new Map(productos.map((p) => [p.id, p.precioCosto ?? 0]))
  for (const m of movs) {
    const e = estado.get(m.productoId) ?? { stock: 0, valor: 0 }
    const cpp = e.stock > 0 ? e.valor / e.stock : costoActual.get(m.productoId) ?? 0
    if (m.tipo === 'ENTRADA') { e.stock += m.cantidad; e.valor += m.cantidad * (m.precio > 0 ? m.precio : cpp) }
    else if (m.tipo === 'SALIDA') { e.stock -= m.cantidad; e.valor -= m.cantidad * (m.costoUnitario ?? cpp) }
    else { e.stock = m.cantidad; e.valor = m.cantidad * cpp }
    estado.set(m.productoId, e)
  }
  return productos
    .map((p) => {
      const e = estado.get(p.id)
      return { label: p.nombre, amount: Math.max(0, e?.valor ?? 0), note: e && e.stock > 0 ? `${Math.round(e.stock).toLocaleString('es-AR')} u.` : undefined }
    })
    .filter((i) => i.amount > 0.5)
    .sort(byAmount)
}

/** Bienes de uso comprados hasta la fecha y no vendidos antes (valor de compra, sin amortizar) */
async function bienesAt(businessId: string, asOf: Date): Promise<BalanceItem[]> {
  const [bienes, ventas] = await Promise.all([
    prisma.bienDeUso.findMany({
      where: { businessId, fechaAdquisicion: { lte: asOf } },
      select: { id: true, nombre: true, valorAdquisicion: true, depreciacionAcumulada: true },
    }),
    prisma.transaction.findMany({
      where: { businessId, subType: 'SALE_BIEN_USO', date: { lte: asOf }, bienDeUsoId: { not: null } },
      select: { bienDeUsoId: true },
    }),
  ])
  const vendidos = new Set(ventas.map((v) => v.bienDeUsoId))
  return bienes
    .filter((b) => !vendidos.has(b.id))
    .map((b) => ({ label: b.nombre, amount: Math.max(0, b.valorAdquisicion - b.depreciacionAcumulada) }))
    .sort(byAmount)
}

/** Última cotización (pesos por dólar) registrada en un cambio de caja hasta la fecha */
async function rateAt(businessId: string, asOf: Date): Promise<number | null> {
  const t = await prisma.cashTransfer.findFirst({
    where: { businessId, exchangeRate: { not: null }, date: { lte: asOf } },
    orderBy: { date: 'desc' },
    select: { exchangeRate: true },
  })
  return t?.exchangeRate ?? null
}

export async function getBalanceSheetData(businessId: string, asOf: Date): Promise<BalanceSheet> {
  const [cajas, saldos, creditos, mercaderia, bienes, rate] = await Promise.all([
    prisma.account.findMany({
      where: { businessId, isSystemAccount: false, type: { in: [...CASH_ACCOUNT_TYPES] } },
      select: { id: true, name: true, currency: true },
      orderBy: { name: 'asc' },
    }),
    getCashBalancesAt(businessId, asOf),
    getCreditAccountsData(businessId, asOf),
    mercaderiaAt(businessId, asOf),
    bienesAt(businessId, asOf),
    rateAt(businessId, asOf),
  ])

  // Montos en otra moneda se pasan a pesos con la cotización (sin cotización no se pueden sumar)
  const aPesos = (amount: number, currency: string) => (currency === 'USD' ? (rate ? amount * rate : 0) : amount)
  const fmtUsd = (v: number) => `US$${Math.round(v).toLocaleString('es-AR')}`

  const cajaItems: BalanceItem[] = cajas
    .map((c) => {
      const saldo = saldos[c.id] ?? 0
      return { label: c.name, amount: aPesos(saldo, c.currency), note: c.currency === 'USD' ? fmtUsd(saldo) : undefined }
    })
    .filter((i) => Math.abs(i.amount) > 0.5)
    .sort(byAmount)

  const porContacto = (type: 'INCOME' | 'EXPENSE') => creditos
    .filter((c) => c.type === type && c.saldo > 0.5)
    .map((c) => ({ label: c.name, amount: aPesos(c.saldo, c.currency), note: c.currency === 'USD' ? fmtUsd(c.saldo) : undefined }))
    .sort(byAmount)

  const activo: BalanceRubro[] = [
    { key: 'caja' as const, label: 'Caja y bancos', items: cajaItems },
    { key: 'creditos' as const, label: 'Créditos a cobrar', items: porContacto('INCOME') },
    { key: 'mercaderia' as const, label: 'Mercadería', items: mercaderia },
    { key: 'bienes' as const, label: 'Bienes de uso', items: bienes },
  ].map((r) => ({ ...r, amount: sum(r.items) }))
  const pasivo: BalanceRubro[] = [{ key: 'deudas' as const, label: 'Deudas', items: porContacto('EXPENSE') }]
    .map((r) => ({ ...r, amount: sum(r.items) }))

  const totalActivo = sum(activo)
  const totalPasivo = sum(pasivo)
  return { asOf, rate, activo, pasivo, totalActivo, totalPasivo, patrimonio: totalActivo - totalPasivo }
}

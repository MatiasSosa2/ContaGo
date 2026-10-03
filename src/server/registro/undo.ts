/**
 * undo.ts
 *
 * "Deshacer" del aviso que aparece al registrar: revierte por completo lo que acaba de
 * crear el "+" (movimientos, asientos, saldos de caja, stock y costo promedio, bien de
 * uso, estado de las cuotas saldadas o el cambio de caja).
 *
 * Solo vale para registros recién creados (UNDO_WINDOW_MS) y del negocio activo: no es
 * una forma general de borrar movimientos.
 */

import prisma from '@/lib/prisma'
import { UNDO_WINDOW_MS, type UndoRef } from '@/lib/registro'

const round2 = (v: number) => Math.round(v * 100) / 100

export async function undoRegistroData(businessId: string, ref: UndoRef): Promise<{ success: true } | { success: false; error: string }> {
  const desde = new Date(Date.now() - UNDO_WINDOW_MS)

  if (ref.kind === 'transfer') {
    const transfer = await prisma.cashTransfer.findFirst({
      where: { id: ref.id, businessId, createdAt: { gte: desde } },
      select: { id: true, fromAccountId: true, toAccountId: true, amountFrom: true, amountTo: true },
    })
    if (!transfer) return { success: false, error: 'Ya no se puede deshacer' }
    await prisma.$transaction(async (tx) => {
      await tx.account.update({ where: { id: transfer.fromAccountId }, data: { currentBalance: { increment: transfer.amountFrom } } })
      await tx.account.update({ where: { id: transfer.toAccountId }, data: { currentBalance: { decrement: transfer.amountTo } } })
      // El asiento se borra en cascada
      await tx.cashTransfer.delete({ where: { id: transfer.id } })
    })
    return { success: true }
  }

  const ids = [...new Set(ref.ids)]
  if (ids.length === 0) return { success: false, error: 'Nada para deshacer' }
  const txs = await prisma.transaction.findMany({
    where: { id: { in: ids }, businessId, createdAt: { gte: desde } },
    select: { id: true, type: true, amount: true, esCredito: true, accountId: true, operacionId: true, bienDeUsoId: true, cobrosAplicados: { select: { id: true } } },
  })
  if (txs.length !== ids.length) return { success: false, error: 'Ya no se puede deshacer' }
  // Si a una cuota recién creada ya se le aplicó un cobro aparte, no se toca
  if (txs.some((t) => t.cobrosAplicados.some((c) => !ids.includes(c.id)))) {
    return { success: false, error: 'Ya tiene cobros aplicados: borralo desde Cajas' }
  }
  if (ref.operacionId && txs.some((t) => t.operacionId !== ref.operacionId)) return { success: false, error: 'Datos inválidos' }
  if (ref.bienCreadoId && txs.some((t) => t.bienDeUsoId !== ref.bienCreadoId)) return { success: false, error: 'Datos inválidos' }
  if (ref.bienVendidoId && txs.some((t) => t.bienDeUsoId !== ref.bienVendidoId)) return { success: false, error: 'Datos inválidos' }

  const movimientos = ref.movimientoIds?.length
    ? await prisma.movimientoStock.findMany({
        where: { id: { in: ref.movimientoIds }, createdAt: { gte: desde }, producto: { businessId } },
        select: { id: true, tipo: true, cantidad: true, precio: true, productoId: true },
      })
    : []
  if (movimientos.length !== (ref.movimientoIds?.length ?? 0)) return { success: false, error: 'Ya no se puede deshacer' }

  await prisma.$transaction(async (tx) => {
    // Saldos de caja (las cuotas a crédito no movieron caja)
    for (const t of txs) {
      if (t.esCredito) continue
      await tx.account.update({
        where: { id: t.accountId },
        data: { currentBalance: t.type === 'INCOME' ? { decrement: t.amount } : { increment: t.amount } },
      })
    }
    await tx.journalEntry.deleteMany({ where: { transactionId: { in: ids }, businessId } })
    await tx.transaction.deleteMany({ where: { id: { in: ids }, businessId } })

    // Stock: la venta devuelve unidades; la compra las saca y vuelve al costo promedio anterior
    for (const m of movimientos) {
      const producto = await tx.producto.findUniqueOrThrow({ where: { id: m.productoId }, select: { stockActual: true, precioCosto: true } })
      if (m.tipo === 'SALIDA') {
        await tx.producto.update({ where: { id: m.productoId }, data: { stockActual: { increment: m.cantidad } } })
      } else {
        const stockPrevio = producto.stockActual - m.cantidad
        const costo = producto.precioCosto ?? 0
        const costoPrevio = stockPrevio > 0 ? round2((producto.stockActual * costo - m.cantidad * (m.precio ?? 0)) / stockPrevio) : costo
        await tx.producto.update({
          where: { id: m.productoId },
          data: { stockActual: { decrement: m.cantidad }, precioCosto: Math.max(0, costoPrevio) },
        })
      }
      await tx.movimientoStock.delete({ where: { id: m.id } })
    }

    if (ref.operacionId) await tx.operacion.deleteMany({ where: { id: ref.operacionId, businessId } })
    if (ref.bienCreadoId) await tx.bienDeUso.deleteMany({ where: { id: ref.bienCreadoId, businessId } })
    if (ref.bienVendidoId) await tx.bienDeUso.updateMany({ where: { id: ref.bienVendidoId, businessId }, data: { activo: true } })

    // Cuotas saldadas: vuelven a pendiente o parcial según lo que quede aplicado
    for (const creditoId of ref.creditoIds ?? []) {
      const credito = await tx.transaction.findFirst({
        where: { id: creditoId, businessId, esCredito: true },
        select: { amount: true, cobrosAplicados: { select: { amount: true } } },
      })
      if (!credito) continue
      const aplicado = credito.cobrosAplicados.reduce((s, c) => s + c.amount, 0)
      await tx.transaction.update({
        where: { id: creditoId },
        data: { estado: aplicado <= 0.001 ? 'PENDIENTE' : 'PARCIAL' },
      })
    }
  })

  return { success: true }
}

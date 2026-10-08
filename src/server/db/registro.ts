/**
 * Registro desde el "+": ventas/compras de productos, conceptos (otros ingresos/egresos, bienes de uso, cobros y pagos), cambios y diferencias de caja, y Deshacer.
 * Las expone src/app/actions.ts (que elige entre datos reales y demo).
 */

import prisma from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { createCashTransferSchema, createCashAdjustmentSchema, productOperationSchema, conceptOperationSchema, type ActionResult } from '@/lib/validations'
import { generateJournalLines } from '@/server/accounting/journal-engine'
import { CASH_ACCOUNT_TYPES, getCashBalanceOf } from '@/server/cash/cash-flow'
import { undoRegistroData } from '@/server/registro/undo'
import type { UndoRef } from '@/lib/registro'
import { getBusinessId, parseMovementDate, getOrCreateDefaultCategory, endOfMovementDay, round2 } from './shared'
import { createTransaction } from './transactions'

export async function createCashTransfer(formData: FormData): Promise<ActionResult<{ undo: UndoRef }>> {
  const rateRaw = parseFloat(formData.get('exchangeRate') as string)
  const parsed = createCashTransferSchema.safeParse({
    fromAccountId: formData.get('fromAccountId') as string,
    toAccountId: formData.get('toAccountId') as string,
    amount: parseFloat(formData.get('amount') as string),
    exchangeRate: isNaN(rateRaw) ? undefined : rateRaw,
    date: (formData.get('date') as string) || undefined,
    description: ((formData.get('description') as string) || '').trim() || undefined,
  })
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { fromAccountId, toAccountId, amount, exchangeRate, date: dateStr, description } = parsed.data

  const businessId = await getBusinessId(true)
  const accounts = await prisma.account.findMany({
    where: {
      id: { in: [fromAccountId, toAccountId] },
      businessId,
      isSystemAccount: false,
      type: { in: [...CASH_ACCOUNT_TYPES] },
    },
    select: { id: true, name: true, currency: true },
  })
  const from = accounts.find((a) => a.id === fromAccountId)
  const to = accounts.find((a) => a.id === toAccountId)
  if (!from || !to) return { success: false, error: 'Caja no encontrada' }

  // Cotización en pesos por dólar: ARS → USD divide, USD → ARS multiplica
  let amountTo = amount
  if (from.currency !== to.currency) {
    if (!exchangeRate) return { success: false, error: 'Ingresá la cotización' }
    if (from.currency === 'ARS' && to.currency === 'USD') amountTo = amount / exchangeRate
    else if (from.currency === 'USD' && to.currency === 'ARS') amountTo = amount * exchangeRate
    else return { success: false, error: 'Combinación de monedas no soportada' }
    amountTo = Math.round(amountTo * 100) / 100
  }

  const date = parseMovementDate(dateStr)
  const note = description || `Cambio de caja: ${from.name} → ${to.name}`

  const transferId = await prisma.$transaction(async (tx) => {
    const transfer = await tx.cashTransfer.create({
      data: {
        date,
        description: note,
        amountFrom: amount,
        amountTo,
        exchangeRate: from.currency !== to.currency ? exchangeRate : null,
        fromAccount: { connect: { id: from.id } },
        toAccount: { connect: { id: to.id } },
        business: { connect: { id: businessId } },
      },
      select: { id: true },
    })
    await tx.account.update({ where: { id: from.id }, data: { currentBalance: { decrement: amount } } })
    await tx.account.update({ where: { id: to.id }, data: { currentBalance: { increment: amountTo } } })
    // Asiento: entra a la caja destino (DEBE), sale de la caja origen (HABER)
    await tx.journalEntry.create({
      data: {
        date,
        description: note,
        cashTransfer: { connect: { id: transfer.id } },
        business: { connect: { id: businessId } },
        lines: {
          create: [
            { accountId: to.id, debit: amountTo, credit: 0, description: note },
            { accountId: from.id, debit: 0, credit: amount, description: note },
          ],
        },
      },
    })
    return transfer.id
  })

  revalidateTag(`dashboard:${businessId}`, 'max')
  revalidatePath('/')
  return { success: true, data: { undo: { kind: 'transfer', id: transferId } } }
}

export async function createCashAdjustment(formData: FormData): Promise<ActionResult<{ difference: number; undo?: UndoRef }>> {
  const countedRaw = parseFloat(formData.get('counted') as string)
  const parsed = createCashAdjustmentSchema.safeParse({
    accountId: formData.get('accountId') as string,
    counted: countedRaw,
    date: (formData.get('date') as string) || undefined,
    description: ((formData.get('description') as string) || '').trim() || undefined,
  })
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { accountId, counted, date: dateStr, description } = parsed.data

  const businessId = await getBusinessId(true)
  const account = await prisma.account.findFirst({
    where: { id: accountId, businessId, isSystemAccount: false, type: { in: [...CASH_ACCOUNT_TYPES] } },
    select: { id: true, currency: true },
  })
  if (!account) return { success: false, error: 'Caja no encontrada' }

  // La diferencia se calcula acá, contra el saldo del sistema a esa fecha
  const systemBalance = await getCashBalanceOf(businessId, accountId, endOfMovementDay(dateStr))
  if (systemBalance === null) return { success: false, error: 'Caja no encontrada' }
  const difference = Math.round((counted - systemBalance) * 100) / 100
  if (Math.abs(difference) < 0.01) return { success: false, error: 'No hay diferencia: lo contado coincide con el sistema' }

  const isSobrante = difference > 0
  const fd = new FormData()
  fd.set('amount', String(Math.abs(difference)))
  fd.set('description', description || (isSobrante ? 'Sobrante de caja' : 'Faltante de caja'))
  fd.set('type', isSobrante ? 'INCOME' : 'EXPENSE')
  fd.set('subType', 'DIFERENCIA_CAJA')
  fd.set('accountId', accountId)
  fd.set('currency', account.currency)
  fd.set('esCredito', 'false')
  fd.set('estado', isSobrante ? 'COBRADO' : 'PAGADO')
  if (dateStr) fd.set('date', dateStr)
  // createTransaction valida estos campos como texto (vacío = sin dato), no como ausentes
  for (const field of ['categoryId', 'contactId', 'areaNegocioId', 'empleadoId', 'productoId', 'bienDeUsoId', 'linkedCreditoId']) {
    fd.set(field, '')
  }

  const result = await createTransaction(fd)
  if (!result.success) return { success: false, error: result.error }
  // El movimiento recién creado, para poder deshacerlo
  const creado = await prisma.transaction.findFirst({
    where: { businessId, accountId, subType: 'DIFERENCIA_CAJA' },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  return { success: true, data: { difference, undo: creado ? { kind: 'transactions', ids: [creado.id] } : undefined } }
}

// ---- Venta / compra con varios productos y pago dividido ----

/**
 * Registra una venta o una compra de productos como Operacion.
 *
 * Venta:  los ítems descuentan stock guardando su CPP (base del CMV) y cada parte del
 *         cobro —o cada cuota a crédito— es una Transaction INCOME SALE_PRODUCT.
 * Compra: los ítems suman stock y recalculan el CPP con el costo neto de descuento;
 *         cada parte del pago —o cada cuota de la deuda— es una Transaction EXPENSE
 *         PURCHASE_PRODUCT.
 * Así Ventas, CMV, Inventario, Cajas, Flujo y Créditos salen de los mismos datos que
 * una operación simple.
 */
export async function createProductOperation(formData: FormData): Promise<ActionResult<{ operacionId: string; undo: UndoRef }>> {
  let payload: unknown
  try {
    payload = JSON.parse((formData.get('payload') as string) || '{}')
  } catch {
    return { success: false, error: 'Datos inválidos' }
  }
  const parsed = productOperationSchema.safeParse(payload)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { tipo, items, descuento, pagos, contactId, empleadoId, description: note, date: dateStr } = parsed.data
  const esVenta = tipo === 'VENTA'

  const subtotal = round2(items.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0))
  if (descuento > subtotal) return { success: false, error: 'El descuento no puede superar el subtotal' }
  const total = round2(subtotal - descuento)
  if (total <= 0) return { success: false, error: 'El total debe ser mayor a 0' }
  const pagado = round2(pagos.reduce((s, p) => s + p.monto, 0))
  if (Math.abs(pagado - total) > 0.01) return { success: false, error: 'La suma de las formas de pago no coincide con el total' }

  const businessId = await getBusinessId(true)

  // Productos (del negocio)
  const productoIds = [...new Set(items.map((i) => i.productoId))]
  const productos = await prisma.producto.findMany({
    where: { id: { in: productoIds }, businessId },
    select: { id: true, nombre: true, tipo: true, precioCosto: true, stockActual: true },
  })
  if (productos.length !== productoIds.length) return { success: false, error: 'Algún producto no existe' }
  const productoById = new Map(productos.map((p) => [p.id, p]))

  // Venta: no se vende más de lo que hay en stock (mercadería)
  if (esVenta) {
    const cantidadPorProducto = new Map<string, number>()
    for (const i of items) cantidadPorProducto.set(i.productoId, (cantidadPorProducto.get(i.productoId) ?? 0) + i.cantidad)
    for (const [id, cantidad] of cantidadPorProducto) {
      const p = productoById.get(id)!
      if (p.tipo === 'MERCADERIA' && cantidad > p.stockActual + 1e-9) {
        return { success: false, error: `No hay stock suficiente de ${p.nombre} (quedan ${p.stockActual.toLocaleString('es-AR')})` }
      }
    }
  }

  // Cajas: la operación es en pesos
  const cashAccounts = await prisma.account.findMany({
    where: { businessId, isSystemAccount: false, type: { in: [...CASH_ACCOUNT_TYPES] }, currency: 'ARS' },
    select: { id: true, type: true },
  })
  const accountById = new Map(cashAccounts.map((a) => [a.id, a]))
  for (const p of pagos) {
    if (p.metodo === 'CREDITO') {
      const cuotas = p.cuotas ?? []
      if (cuotas.length === 0) return { success: false, error: 'La parte a crédito necesita al menos una cuota' }
      const sumaCuotas = round2(cuotas.reduce((s, c) => s + c.monto, 0))
      if (Math.abs(sumaCuotas - p.monto) > 0.01) return { success: false, error: 'Las cuotas no suman el monto a crédito' }
      continue
    }
    const acc = p.accountId ? accountById.get(p.accountId) : undefined
    if (!acc) return { success: false, error: 'Elegí la caja de cada pago' }
    if (p.metodo === 'EFECTIVO' && acc.type !== 'CASH') return { success: false, error: 'El pago en efectivo tiene que ir a una caja de efectivo' }
    if (p.metodo === 'VIRTUAL' && acc.type === 'CASH') return { success: false, error: 'El pago virtual tiene que ir a una cuenta bancaria o billetera' }
  }
  // Las cuotas necesitan una caja de referencia (no mueven saldo hasta cobrarse/pagarse)
  const creditAccountId = pagos.find((p) => p.accountId)?.accountId ?? cashAccounts[0]?.id
  if (!creditAccountId) return { success: false, error: 'No hay cajas en pesos cargadas' }

  if (contactId) {
    const contact = await prisma.contact.findFirst({ where: { id: contactId, businessId }, select: { id: true } })
    if (!contact) return { success: false, error: esVenta ? 'Cliente no encontrado' : 'Proveedor no encontrado' }
  }
  if (empleadoId) {
    const employee = await prisma.empleado.findFirst({ where: { id: empleadoId, businessId }, select: { id: true } })
    if (!employee) return { success: false, error: 'El empleado no pertenece al negocio activo' }
  }

  const txType = esVenta ? 'INCOME' : 'EXPENSE'
  const subType = esVenta ? 'SALE_PRODUCT' : 'PURCHASE_PRODUCT'
  const categoryId = await getOrCreateDefaultCategory(businessId, txType, subType)
  const date = parseMovementDate(dateStr)
  const nombres = items.map((i) => productoById.get(i.productoId)!.nombre)
  const listado = nombres.length > 2 ? `${nombres.slice(0, 2).join(', ')} y ${nombres.length - 2} más` : nombres.join(', ')
  const baseDescription = note || `${esVenta ? 'Venta' : 'Compra'}: ${listado}`
  // Compra: el descuento general baja el costo de cada unidad en la misma proporción
  const factorNeto = subtotal > 0 ? total / subtotal : 1

  try {
    const txIds: string[] = []
    const movimientoIds: string[] = []
    const operacionId = await prisma.$transaction(async (tx) => {
      const [categoryWithContable, cxcAccount, cxpAccount, inventoryAccount, cogsAccount] = await Promise.all([
        categoryId ? tx.category.findFirst({ where: { id: categoryId, businessId }, select: { contableAccountId: true } }) : null,
        tx.account.findFirst({ where: { businessId, isSystemAccount: true, subtype: 'RECEIVABLE' }, select: { id: true } }),
        tx.account.findFirst({ where: { businessId, isSystemAccount: true, subtype: 'PAYABLE' }, select: { id: true } }),
        tx.account.findFirst({ where: { businessId, isSystemAccount: true, subtype: 'INVENTORY' }, select: { id: true } }),
        tx.account.findFirst({ where: { businessId, isSystemAccount: true, subtype: 'COGS' }, select: { id: true } }),
      ])

      const operacion = await tx.operacion.create({
        data: {
          tipo,
          date,
          description: note || null,
          subtotal,
          descuento: round2(descuento),
          total,
          contact: contactId ? { connect: { id: contactId } } : undefined,
          empleado: empleadoId ? { connect: { id: empleadoId } } : undefined,
          business: { connect: { id: businessId } },
        },
        select: { id: true },
      })

      let cmv = 0
      for (const item of items) {
        const producto = await tx.producto.findFirst({
          where: { id: item.productoId, businessId },
          select: { id: true, nombre: true, tipo: true, precioCosto: true, stockActual: true },
        })
        if (!producto) throw new Error('Algún producto ya no pertenece al negocio activo')
        const esMercaderia = producto.tipo === 'MERCADERIA'
        const costoActual = producto.precioCosto ?? 0
        const costoNeto = round2(item.precioUnitario * factorNeto)
        await tx.operacionItem.create({
          data: {
            operacion: { connect: { id: operacion.id } },
            producto: { connect: { id: producto.id } },
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: round2(item.cantidad * item.precioUnitario),
            costoUnitario: esMercaderia ? (esVenta ? costoActual : costoNeto) : null,
          },
        })
        if (!esMercaderia) continue

        if (esVenta) {
          // Venta: sale stock a su CPP del momento
          cmv += item.cantidad * costoActual
          const stockUpdate = await tx.producto.updateMany({
            where: { id: producto.id, businessId, stockActual: { gte: item.cantidad } },
            data: { stockActual: { decrement: item.cantidad } },
          })
          if (stockUpdate.count === 0) throw new Error(`No hay stock suficiente de ${producto.nombre}`)
          const mov = await tx.movimientoStock.create({
            data: {
              tipo: 'SALIDA', cantidad: item.cantidad, precio: item.precioUnitario, costoUnitario: costoActual,
              motivo: baseDescription, fecha: date, producto: { connect: { id: producto.id } },
            },
            select: { id: true },
          })
          movimientoIds.push(mov.id)
        } else {
          // Compra: entra stock y se recalcula el costo promedio ponderado
          const stockPrevio = Math.max(0, producto.stockActual)
          const stockNuevo = stockPrevio + item.cantidad
          const cpp = stockNuevo > 0 ? (stockPrevio * costoActual + item.cantidad * costoNeto) / stockNuevo : costoNeto
          await tx.producto.update({
            where: { id: producto.id },
            data: { stockActual: { increment: item.cantidad }, precioCosto: cpp },
          })
          const mov = await tx.movimientoStock.create({
            data: {
              tipo: 'ENTRADA', cantidad: item.cantidad, precio: costoNeto,
              motivo: baseDescription, fecha: date, producto: { connect: { id: producto.id } },
            },
            select: { id: true },
          })
          movimientoIds.push(mov.id)
        }
      }

      // Una Transaction por parte cobrada/pagada y una por cada cuota a crédito
      type Parte = { amount: number; esCredito: boolean; accountId: string; fechaVencimiento?: Date; cuota?: [number, number] }
      const partes: Parte[] = pagos.flatMap((p): Parte[] => {
        if (p.metodo !== 'CREDITO') return [{ amount: p.monto, esCredito: false, accountId: p.accountId! }]
        const cuotas = p.cuotas ?? []
        return cuotas.map((c, i) => ({
          amount: c.monto,
          esCredito: true,
          accountId: creditAccountId,
          fechaVencimiento: new Date(`${c.fecha}T12:00:00-03:00`),
          cuota: [i + 1, cuotas.length] as [number, number],
        }))
      })

      let cmvPendiente = round2(cmv)
      for (const parte of partes) {
        const description = parte.cuota
          ? `${baseDescription} · cuota ${parte.cuota[0]}/${parte.cuota[1]}`
          : baseDescription
        const newTx = await tx.transaction.create({
          data: {
            amount: parte.amount,
            description,
            type: txType,
            subType,
            date,
            currency: 'ARS',
            esCredito: parte.esCredito,
            estado: parte.esCredito ? 'PENDIENTE' : (esVenta ? 'COBRADO' : 'PAGADO'),
            fechaVencimiento: parte.fechaVencimiento ?? null,
            cuotaNumero: parte.cuota?.[0] ?? null,
            cuotasTotal: parte.cuota?.[1] ?? null,
            account: { connect: { id: parte.accountId } },
            business: { connect: { id: businessId } },
            operacion: { connect: { id: operacion.id } },
            category: categoryId ? { connect: { id: categoryId } } : undefined,
            contact: contactId ? { connect: { id: contactId } } : undefined,
            empleado: empleadoId ? { connect: { id: empleadoId } } : undefined,
          },
          select: { id: true },
        })
        txIds.push(newTx.id)
        if (!parte.esCredito) {
          await tx.account.update({
            where: { id: parte.accountId },
            data: { currentBalance: esVenta ? { increment: parte.amount } : { decrement: parte.amount } },
          })
        }

        // Asiento. Venta: el costo de la mercadería va una sola vez, en el primer movimiento.
        const journal = generateJournalLines({
          amount: parte.amount,
          type: txType,
          esCredito: parte.esCredito,
          physicalAccountId: parte.accountId,
          categoryContableAccountId: categoryWithContable?.contableAccountId ?? null,
          cxcAccountId: cxcAccount?.id ?? null,
          cxpAccountId: cxpAccount?.id ?? null,
          description,
          mode: esVenta ? (cmvPendiente > 0 ? 'SALE_PRODUCT' : 'STANDARD') : 'PURCHASE_PRODUCT',
          costoMercaderia: esVenta && cmvPendiente > 0 ? cmvPendiente : undefined,
          inventoryAccountId: inventoryAccount?.id ?? null,
          cogsAccountId: cogsAccount?.id ?? null,
        })
        if (!journal.ok) throw new Error('No se pudo generar el asiento contable. Verificá las cuentas del negocio.')
        if (journal.ok) {
          await tx.journalEntry.create({
            data: { date, description, transactionId: newTx.id, businessId, lines: { create: journal.lines } },
          })
          if (esVenta) cmvPendiente = 0
        }
      }

      return operacion.id
    })

    revalidateTag(`dashboard:${businessId}`, 'max')
    revalidatePath('/')
    revalidatePath('/stock')
    revalidatePath('/creditos')
    return { success: true, data: { operacionId, undo: { kind: 'transactions', ids: txIds, operacionId, movimientoIds } } }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : `Error al registrar la ${esVenta ? 'venta' : 'compra'}` }
  }
}

// ---- Resto de las categorías con pago combinado / cuotas ----

type ConceptResult = ActionResult<{ clienteSaldado?: boolean; clienteNombre?: string; proveedorSaldado?: boolean; proveedorNombre?: string; undo?: UndoRef }>

/**
 * Registra las categorías que no son de productos con el mismo esquema de pago que las
 * ventas/compras de productos (medios combinados, crédito en cuotas):
 * - OTRO_INGRESO / OTRO_EGRESO: categorías propias (con subcategoría si corresponde).
 * - VENTA_BIEN / COMPRA_BIEN: bienes de uso (baja o alta del activo, una sola vez).
 * - COBRO / PAGO_DEUDA: saldan una o varias cuotas pendientes; lo pagado se aplica a
 *   las cuotas en el orden recibido (sin crédito: es el pago de uno).
 * Si el pago tiene más de una parte, las Transactions se agrupan en una Operacion
 * (una sola fila en Cajas).
 */
export async function createConceptOperation(formData: FormData): Promise<ConceptResult> {
  let payload: unknown
  try {
    payload = JSON.parse((formData.get('payload') as string) || '{}')
  } catch {
    return { success: false, error: 'Datos inválidos' }
  }
  const parsed = conceptOperationSchema.safeParse(payload)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { kind, monto: montoRaw, pagos, contactId, empleadoId, description: note, date: dateStr } = parsed.data
  const monto = round2(montoRaw)

  const esIngreso = kind === 'OTRO_INGRESO' || kind === 'VENTA_BIEN' || kind === 'COBRO'
  const esSaldo = kind === 'COBRO' || kind === 'PAGO_DEUDA'
  const txType = esIngreso ? 'INCOME' : 'EXPENSE'
  const subType =
    kind === 'OTRO_INGRESO' ? 'OTHER_INCOME'
      : kind === 'OTRO_EGRESO' ? 'PAGO'
      : kind === 'VENTA_BIEN' ? 'SALE_BIEN_USO'
      : kind === 'COMPRA_BIEN' ? 'PURCHASE_BIEN_USO'
      : kind === 'COBRO' ? 'COBRO_CREDITO'
      : 'PAGO_DEUDA'

  const pagado = round2(pagos.reduce((s, p) => s + p.monto, 0))
  if (Math.abs(pagado - monto) > 0.01) return { success: false, error: 'La suma de las formas de pago no coincide con el monto' }
  if (esSaldo && pagos.some((p) => p.metodo === 'CREDITO')) {
    return { success: false, error: 'Un cobro o pago de deuda no puede ser a crédito' }
  }

  const businessId = await getBusinessId(true)

  // Cajas en pesos
  const cashAccounts = await prisma.account.findMany({
    where: { businessId, isSystemAccount: false, type: { in: [...CASH_ACCOUNT_TYPES] }, currency: 'ARS' },
    select: { id: true, type: true },
  })
  const accountById = new Map(cashAccounts.map((a) => [a.id, a]))
  for (const p of pagos) {
    if (p.metodo === 'CREDITO') {
      const cuotas = p.cuotas ?? []
      if (cuotas.length === 0) return { success: false, error: 'La parte a crédito necesita al menos una cuota' }
      const suma = round2(cuotas.reduce((s, c) => s + c.monto, 0))
      if (Math.abs(suma - p.monto) > 0.01) return { success: false, error: 'Las cuotas no suman el monto a crédito' }
      continue
    }
    const acc = p.accountId ? accountById.get(p.accountId) : undefined
    if (!acc) return { success: false, error: 'Elegí la caja de cada pago' }
    if (p.metodo === 'EFECTIVO' && acc.type !== 'CASH') return { success: false, error: 'El pago en efectivo tiene que ir a una caja de efectivo' }
    if (p.metodo === 'VIRTUAL' && acc.type === 'CASH') return { success: false, error: 'El pago virtual tiene que ir a una cuenta bancaria o billetera' }
  }
  const creditAccountId = pagos.find((p) => p.accountId)?.accountId ?? cashAccounts[0]?.id
  if (!creditAccountId) return { success: false, error: 'No hay cajas en pesos cargadas' }

  if (contactId) {
    const contact = await prisma.contact.findFirst({ where: { id: contactId, businessId }, select: { id: true } })
    if (!contact) return { success: false, error: 'Contacto no encontrado' }
  }
  if (empleadoId) {
    const employee = await prisma.empleado.findFirst({ where: { id: empleadoId, businessId }, select: { id: true } })
    if (!employee) return { success: false, error: 'El empleado no pertenece al negocio activo' }
  }

  // ── Datos propios de cada tipo ──
  let categoryId: string | null = null
  let subcategoryId: string | null = null
  let bienVenta: { id: string; nombre: string; valorNeto: number } | null = null
  let creditos: { id: string; amount: number; saldo: number; contactId: string | null; contactName: string | null; estado: string }[] = []
  let label = ''

  if (kind === 'OTRO_INGRESO' || kind === 'OTRO_EGRESO') {
    if (!parsed.data.categoryId) return { success: false, error: 'Elegí una categoría' }
    const category = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, businessId, type: txType },
      select: { id: true, name: true, subcategories: { select: { id: true, name: true } } },
    })
    if (!category) return { success: false, error: 'Categoría no encontrada' }
    const sub = category.subcategories.find((s) => s.id === parsed.data.subcategoryId)
    if (category.subcategories.length > 0 && !sub) return { success: false, error: 'Elegí una subcategoría' }
    categoryId = category.id
    subcategoryId = sub?.id ?? null
    label = sub ? sub.name : category.name
  } else {
    categoryId = await getOrCreateDefaultCategory(businessId, txType, subType)
  }

  if (kind === 'VENTA_BIEN') {
    const bien = await prisma.bienDeUso.findFirst({
      where: { id: parsed.data.bienDeUsoId ?? '', businessId, activo: true },
      select: { id: true, nombre: true, valorAdquisicion: true, depreciacionAcumulada: true },
    })
    if (!bien) return { success: false, error: 'Elegí un bien de uso' }
    bienVenta = { id: bien.id, nombre: bien.nombre, valorNeto: Math.max(0, bien.valorAdquisicion - bien.depreciacionAcumulada) }
    label = `Venta de ${bien.nombre}`
  }
  if (kind === 'COMPRA_BIEN') {
    if (!parsed.data.bien) return { success: false, error: 'Indicá el nombre del bien' }
    label = `Compra de ${parsed.data.bien.nombre}`
  }

  if (esSaldo) {
    const ids = parsed.data.creditoIds ?? []
    if (ids.length === 0) return { success: false, error: kind === 'COBRO' ? 'Elegí qué cuotas se cobran' : 'Elegí qué cuotas se pagan' }
    label = kind === 'COBRO' ? 'Cobro de crédito' : 'Pago de deuda'
  }

  const date = parseMovementDate(dateStr)
  const baseDescription = note || label

  // Partes: una por medio no a crédito y una por cada cuota
  type Parte = { amount: number; esCredito: boolean; accountId: string; fechaVencimiento?: Date; cuota?: [number, number] }
  const partes: Parte[] = pagos.flatMap((p): Parte[] => {
    if (p.metodo !== 'CREDITO') return [{ amount: p.monto, esCredito: false, accountId: p.accountId! }]
    const cuotas = p.cuotas ?? []
    return cuotas.map((c, i) => ({
      amount: c.monto,
      esCredito: true,
      accountId: creditAccountId,
      fechaVencimiento: new Date(`${c.fecha}T12:00:00-03:00`),
      cuota: [i + 1, cuotas.length] as [number, number],
    }))
  })

  let clienteSaldado = false
  let clienteNombre: string | undefined
  let proveedorSaldado = false
  let proveedorNombre: string | undefined
  const undo: Extract<UndoRef, { kind: 'transactions' }> = { kind: 'transactions', ids: [] }

  try {
    await prisma.$transaction(async (tx) => {
      if (esSaldo) {
        const ids = parsed.data.creditoIds ?? []
        const uniqueIds = [...new Set(ids)]
        if (uniqueIds.length !== ids.length) throw new Error('No repitas una cuota en la misma operación')

        const candidates = await tx.transaction.findMany({
          where: { id: { in: uniqueIds }, businessId, esCredito: true, type: txType, estado: { in: ['PENDIENTE', 'PARCIAL', 'VENCIDO'] } },
          select: { id: true, estado: true },
        })
        if (candidates.length !== uniqueIds.length) throw new Error('Alguna cuota ya no está pendiente')

        const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]))
        for (const id of [...uniqueIds].sort()) {
          const candidate = candidateById.get(id)!
          const reserved = await tx.transaction.updateMany({
            where: { id, businessId, esCredito: true, estado: candidate.estado },
            data: { estado: 'PROCESSING' },
          })
          if (reserved.count !== 1) throw new Error('Una cuota está siendo actualizada. Volvé a intentarlo.')
        }

        const rows = await tx.transaction.findMany({
          where: { id: { in: uniqueIds }, businessId, esCredito: true, type: txType, estado: 'PROCESSING' },
          select: {
            id: true,
            amount: true,
            currency: true,
            estado: true,
            contactId: true,
            fechaVencimiento: true,
            contact: { select: { name: true } },
            cobrosAplicados: { where: { businessId }, select: { amount: true } },
          },
        })
        const byId = new Map(rows.map((row) => [row.id, row]))
        creditos = uniqueIds.map((id) => {
          const row = byId.get(id)!
          if (row.currency !== 'ARS') throw new Error('Los cobros y pagos de deuda deben registrarse en la moneda base ARS')
          const appliedAmount = row.cobrosAplicados.reduce((sum, payment) => sum + payment.amount, 0)
          return {
            id: row.id,
            amount: row.amount,
            saldo: round2(row.amount - appliedAmount),
            contactId: row.contactId,
            contactName: row.contact?.name ?? null,
            estado: candidateById.get(id)!.estado,
          }
        })
        const saldoTotal = round2(creditos.reduce((sum, credit) => sum + credit.saldo, 0))
        if (monto > saldoTotal + 0.01) {
          throw new Error(`El monto supera el saldo pendiente (${saldoTotal.toLocaleString('es-AR')})`)
        }
      }

      const [categoryWithContable, cxcAccount, cxpAccount, fixedAccount] = await Promise.all([
        categoryId ? tx.category.findFirst({ where: { id: categoryId, businessId }, select: { contableAccountId: true } }) : null,
        tx.account.findFirst({ where: { businessId, isSystemAccount: true, subtype: 'RECEIVABLE' }, select: { id: true } }),
        tx.account.findFirst({ where: { businessId, isSystemAccount: true, subtype: 'PAYABLE' }, select: { id: true } }),
        tx.account.findFirst({ where: { businessId, isSystemAccount: true, subtype: 'FIXED_ASSET' }, select: { id: true } }),
      ])

      // Más de una parte → se agrupan en una Operacion
      const operacion = partes.length > 1 || (esSaldo && creditos.length > 1)
        ? await tx.operacion.create({
            data: {
              tipo: kind,
              date,
              description: note || null,
              subtotal: monto,
              descuento: 0,
              total: monto,
              contact: contactId ? { connect: { id: contactId } } : undefined,
              empleado: empleadoId ? { connect: { id: empleadoId } } : undefined,
              business: { connect: { id: businessId } },
            },
            select: { id: true },
          })
        : null

      // Bienes de uso: la baja o el alta del activo se hace una sola vez
      undo.operacionId = operacion?.id ?? null
      let bienId: string | null = bienVenta?.id ?? null
      if (bienVenta) {
        await tx.bienDeUso.update({ where: { id: bienVenta.id }, data: { activo: false } })
        undo.bienVendidoId = bienVenta.id
      }
      if (kind === 'COMPRA_BIEN' && parsed.data.bien) {
        const nuevo = await tx.bienDeUso.create({
          data: {
            nombre: parsed.data.bien.nombre,
            categoria: parsed.data.bien.categoria || null,
            marca: parsed.data.bien.marca || null,
            valorAdquisicion: monto,
            valorResidual: 0,
            depreciacionAcumulada: 0,
            fechaAdquisicion: date,
            activo: true,
            businessId,
          },
          select: { id: true },
        })
        bienId = nuevo.id
        undo.bienCreadoId = nuevo.id
      }

      const crearMovimiento = async (parte: Parte, extra: { linkedCreditoId?: string; contactId?: string | null; journalMode: Parameters<typeof generateJournalLines>[0]['mode']; valorNeto?: number }) => {
        const description = parte.cuota ? `${baseDescription} · cuota ${parte.cuota[0]}/${parte.cuota[1]}` : baseDescription
        const contacto = extra.contactId !== undefined ? extra.contactId : (contactId || null)
        const newTx = await tx.transaction.create({
          data: {
            amount: parte.amount,
            description,
            type: txType,
            subType,
            date,
            currency: 'ARS',
            esCredito: parte.esCredito,
            estado: parte.esCredito ? 'PENDIENTE' : (esIngreso ? 'COBRADO' : 'PAGADO'),
            fechaVencimiento: parte.fechaVencimiento ?? null,
            cuotaNumero: parte.cuota?.[0] ?? null,
            cuotasTotal: parte.cuota?.[1] ?? null,
            account: { connect: { id: parte.accountId } },
            business: { connect: { id: businessId } },
            operacion: operacion ? { connect: { id: operacion.id } } : undefined,
            category: categoryId && !esSaldo ? { connect: { id: categoryId } } : undefined,
            subcategory: subcategoryId ? { connect: { id: subcategoryId } } : undefined,
            bienDeUso: bienId ? { connect: { id: bienId } } : undefined,
            linkedCredito: extra.linkedCreditoId ? { connect: { id: extra.linkedCreditoId } } : undefined,
            contact: contacto ? { connect: { id: contacto } } : undefined,
            empleado: empleadoId ? { connect: { id: empleadoId } } : undefined,
          },
          select: { id: true },
        })
        undo.ids.push(newTx.id)
        if (!parte.esCredito) {
          await tx.account.update({
            where: { id: parte.accountId },
            data: { currentBalance: esIngreso ? { increment: parte.amount } : { decrement: parte.amount } },
          })
        }
        const journal = generateJournalLines({
          amount: parte.amount,
          type: txType,
          esCredito: parte.esCredito,
          physicalAccountId: parte.accountId,
          categoryContableAccountId: categoryWithContable?.contableAccountId ?? null,
          cxcAccountId: cxcAccount?.id ?? null,
          cxpAccountId: cxpAccount?.id ?? null,
          description,
          mode: extra.journalMode,
          fixedAssetAccountId: fixedAccount?.id ?? null,
          bienValorNetoEnLibros: extra.valorNeto,
        })
        if (!journal.ok) throw new Error('No se pudo generar el asiento contable. Verificá las cuentas del negocio.')
        if (journal.ok) {
          await tx.journalEntry.create({
            data: { date, description, transactionId: newTx.id, businessId, lines: { create: journal.lines } },
          })
        }
      }

      if (esSaldo) {
        // Lo pagado se aplica a las cuotas en orden; cada tramo es un cobro/pago vinculado
        const saldos = creditos.map((c) => ({ ...c }))
        let ci = 0
        for (const parte of partes) {
          let resto = parte.amount
          while (resto > 0.001 && ci < saldos.length) {
            const credito = saldos[ci]
            const aplicar = round2(Math.min(resto, credito.saldo))
            if (aplicar > 0) {
              await crearMovimiento({ ...parte, amount: aplicar }, {
                linkedCreditoId: credito.id,
                contactId: credito.contactId,
                journalMode: kind === 'COBRO' ? 'COBRO_CREDITO' : 'PAGO_DEUDA',
              })
              credito.saldo = round2(credito.saldo - aplicar)
              resto = round2(resto - aplicar)
            }
            if (credito.saldo <= 0.001) ci++
          }
        }
        undo.creditoIds = creditos.map((c) => c.id)
        // Estado de cada cuota
        for (const c of saldos) {
          const original = creditos.find((x) => x.id === c.id)!
          const appliedAmount = original.amount - c.saldo
          const nextState = c.saldo <= 0.001
            ? kind === 'COBRO' ? 'COBRADO' : 'PAGADO'
            : appliedAmount > 0.001
              ? 'PARCIAL'
              : original.estado
          await tx.transaction.update({
            where: { id: c.id },
            data: { estado: nextState },
          })
        }
        // ¿El cliente / proveedor quedó sin deuda?
        const contacto = creditos[0].contactId
        if (contacto) {
          const [pendiente, aplicado] = await Promise.all([
            tx.transaction.aggregate({
              where: { businessId, contactId: contacto, esCredito: true, type: txType, estado: { in: ['PENDIENTE', 'PARCIAL', 'VENCIDO'] } },
              _sum: { amount: true },
            }),
            tx.transaction.aggregate({
              where: { businessId, linkedCredito: { contactId: contacto, esCredito: true, type: txType, estado: { in: ['PENDIENTE', 'PARCIAL', 'VENCIDO'] } } },
              _sum: { amount: true },
            }),
          ])
          if ((pendiente._sum.amount ?? 0) - (aplicado._sum.amount ?? 0) <= 0.001) {
            if (kind === 'COBRO') { clienteSaldado = true; clienteNombre = creditos[0].contactName ?? undefined }
            else { proveedorSaldado = true; proveedorNombre = creditos[0].contactName ?? undefined }
          }
        }
        return
      }

      // Resto: un movimiento por parte. Venta de bien: el valor neto sale una sola vez.
      let valorNetoPendiente = bienVenta?.valorNeto ?? 0
      for (const parte of partes) {
        const mode =
          kind === 'VENTA_BIEN' ? 'SALE_BIEN_USO'
            : kind === 'COMPRA_BIEN' ? 'PURCHASE_BIEN_USO'
            : 'STANDARD'
        await crearMovimiento(parte, { journalMode: mode, valorNeto: kind === 'VENTA_BIEN' ? valorNetoPendiente : undefined })
        valorNetoPendiente = 0
      }
    })
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error al registrar la operación' }
  }

  revalidateTag(`dashboard:${businessId}`, 'max')
  revalidatePath('/')
  revalidatePath('/creditos')
  revalidatePath('/bienes-de-uso')
  return { success: true, data: { clienteSaldado, clienteNombre, proveedorSaldado, proveedorNombre, undo } }
}

/** "Deshacer" del aviso que aparece al registrar desde el "+" */
export async function undoRegistro(ref: UndoRef): Promise<ActionResult> {
  const businessId = await getBusinessId()
  const result = await undoRegistroData(businessId, ref)
  if (!result.success) return result
  revalidateTag(`dashboard:${businessId}`, 'max')
  revalidatePath('/')
  revalidatePath('/stock')
  revalidatePath('/creditos')
  revalidatePath('/bienes-de-uso')
  return { success: true }
}

// ---- Subcategory CRUD ----

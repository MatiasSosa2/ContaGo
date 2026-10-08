/**
 * Movimientos sueltos: alta simple (la usa la diferencia de caja), baja y listados.
 * Las expone src/app/actions.ts (que elige entre datos reales y demo).
 */

import prisma from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { ActionResult } from '@/lib/validations'
import { generateJournalLines } from '@/server/accounting/journal-engine'
import { getBusinessId, parseMovementDate, getScopedAccount, getOrCreateDefaultCategory, type DashboardPeriodKey, computePeriodRange } from './shared'

export async function createTransaction(formData: FormData): Promise<ActionResult<{ clienteSaldado?: boolean; clienteNombre?: string; proveedorSaldado?: boolean; proveedorNombre?: string }>> {
  const esCreditoRaw = formData.get('esCredito') as string
  const cantidadRaw = parseFloat(formData.get('cantidad') as string)
  const precioUnitarioRaw = parseFloat(formData.get('precioUnitario') as string)
  const raw = {
    amount: parseFloat(formData.get('amount') as string),
    description: (formData.get('description') as string)?.trim(),
    type: formData.get('type') as string,
    subType: (formData.get('subType') as string) || undefined,
    accountId: formData.get('accountId') as string,
    categoryId: formData.get('categoryId') as string,
    subcategoryId: (formData.get('subcategoryId') as string) || '',
    contactId: formData.get('contactId') as string,
    areaNegocioId: formData.get('areaNegocioId') as string,
    empleadoId: formData.get('empleadoId') as string,
    productoId: formData.get('productoId') as string,
    bienDeUsoId: formData.get('bienDeUsoId') as string,
    linkedCreditoId: formData.get('linkedCreditoId') as string,
    cantidad: isNaN(cantidadRaw) ? undefined : cantidadRaw,
    precioUnitario: isNaN(precioUnitarioRaw) ? undefined : precioUnitarioRaw,
    date: formData.get('date') as string,
    currency: (formData.get('currency') as string) || 'ARS',
    esCredito: esCreditoRaw === 'true' || esCreditoRaw === '1',
    estado: (formData.get('estado') as string) || 'COBRADO',
    fechaVencimiento: (formData.get('fechaVencimiento') as string) || undefined,
  }

  // Campos específicos para PURCHASE_BIEN_USO (quick-create)
  const bienNombreNuevo = ((formData.get('bienNombre') as string) || '').trim()
  const bienCategoriaNuevo = ((formData.get('bienCategoria') as string) || '').trim()
  const bienMarcaNuevo = ((formData.get('bienMarca') as string) || '').trim()

  const { createTransactionSchema } = await import('@/lib/validations')
  const parsed = createTransactionSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue.path.join('.')
    console.error('[createTransaction] validation failed', { field, message: issue.message, raw })
    return { success: false, error: `${field}: ${issue.message}` }
  }

  const {
    amount, description, type, subType, accountId, categoryId, subcategoryId, contactId,
    areaNegocioId, empleadoId, productoId, bienDeUsoId, linkedCreditoId,
    cantidad, precioUnitario,
    date: dateStr, currency, esCredito, estado, fechaVencimiento,
  } = parsed.data
  if (esCredito && !['PENDIENTE', 'VENCIDO'].includes(estado)) {
    return { success: false, error: 'Un crédito nuevo debe quedar pendiente; el estado pagado se registra mediante un cobro.' }
  }

  const businessId = await getBusinessId(true)
  const account = await getScopedAccount(accountId, businessId)
  if (!account || account.isSystemAccount) return { success: false, error: 'Elegí una cuenta física del negocio' }
  if (account.currency !== currency) {
    return { success: false, error: 'La moneda del movimiento debe coincidir con la moneda de la cuenta' }
  }

  const [category, contact, area, empleado, productoRef] = await Promise.all([
    categoryId ? prisma.category.findFirst({ where: { id: categoryId, businessId, type }, select: { id: true } }) : null,
    contactId ? prisma.contact.findFirst({ where: { id: contactId, businessId }, select: { id: true } }) : null,
    areaNegocioId ? prisma.areaNegocio.findFirst({ where: { id: areaNegocioId, businessId }, select: { id: true } }) : null,
    empleadoId ? prisma.empleado.findFirst({ where: { id: empleadoId, businessId }, select: { id: true } }) : null,
    productoId ? prisma.producto.findFirst({ where: { id: productoId, businessId }, select: { id: true } }) : null,
  ])
  if (categoryId && !category) return { success: false, error: 'La categoría no pertenece al negocio activo' }
  if (contactId && !contact) return { success: false, error: 'El contacto no pertenece al negocio activo' }
  if (areaNegocioId && !area) return { success: false, error: 'El área no pertenece al negocio activo' }
  if (empleadoId && !empleado) return { success: false, error: 'El empleado no pertenece al negocio activo' }
  if (productoId && !productoRef) return { success: false, error: 'El producto no pertenece al negocio activo' }

  const isCobroCredito = subType === 'COBRO_CREDITO'
  const isPagoDeuda = subType === 'PAGO_DEUDA'
  const isSaleBienUso = subType === 'SALE_BIEN_USO'
  const isPurchaseBienUso = subType === 'PURCHASE_BIEN_USO'
  const isSaleProduct = subType === 'SALE_PRODUCT' || subType === 'SALE'
  const isPurchaseProduct = subType === 'PURCHASE_PRODUCT' || subType === 'PURCHASE'

  if (isCobroCredito && (!linkedCreditoId || linkedCreditoId === '')) {
    return { success: false, error: 'Tenés que seleccionar un crédito para cobrar' }
  }
  if (isPagoDeuda && (!linkedCreditoId || linkedCreditoId === '')) {
    return { success: false, error: 'Tenés que seleccionar una deuda para pagar' }
  }
  if (isSaleBienUso && (!bienDeUsoId || bienDeUsoId === '')) {
    return { success: false, error: 'Tenés que seleccionar un bien de uso para vender' }
  }
  if (isPurchaseBienUso && bienNombreNuevo === '') {
    return { success: false, error: 'Indicá el nombre del bien a comprar' }
  }

  // Subcategoría: debe pertenecer a la categoría elegida, y es obligatoria si la categoría tiene
  if (categoryId) {
    const subs = await prisma.subcategory.findMany({
      where: { categoryId, businessId },
      select: { id: true },
    })
    if (subs.length > 0 && !subcategoryId) {
      return { success: false, error: 'Elegí una subcategoría' }
    }
    if (subcategoryId && !subs.some((s) => s.id === subcategoryId)) {
      return { success: false, error: 'La subcategoría no corresponde a la categoría' }
    }
  } else if (subcategoryId) {
    return { success: false, error: 'La subcategoría no corresponde a la categoría' }
  }

  let effectiveCategoryId = categoryId
  if (!effectiveCategoryId || effectiveCategoryId === '') {
    const defaultId = await getOrCreateDefaultCategory(
      businessId,
      type as 'INCOME' | 'EXPENSE',
      subType,
    )
    effectiveCategoryId = defaultId ?? ''
  }

  const date = parseMovementDate(dateStr)
  const fVenc = fechaVencimiento ? new Date(fechaVencimiento) : null

  let clienteSaldado = false
  let clienteNombre: string | undefined
  let proveedorSaldado = false
  let proveedorNombre: string | undefined

  try {
    await prisma.$transaction(async (tx) => {
      // ============ COBRO DE CRÉDITO ============
      if (isCobroCredito && linkedCreditoId) {
        const credito = await tx.transaction.findFirst({
          where: { id: linkedCreditoId, businessId, esCredito: true, type: 'INCOME', estado: { in: ['PENDIENTE', 'PARCIAL', 'VENCIDO'] } },
          select: { id: true, amount: true, currency: true, estado: true, contactId: true, contact: { select: { id: true, name: true } } },
        })
        if (!credito) throw new Error('Crédito no encontrado')
        if (credito.currency !== currency) throw new Error('La moneda del cobro debe coincidir con la del crédito')

        const reserved = await tx.transaction.updateMany({
          where: { id: credito.id, businessId, esCredito: true, estado: credito.estado },
          data: { estado: 'PROCESSING' },
        })
        if (reserved.count !== 1) throw new Error('El crédito está siendo actualizado. Volvé a intentarlo.')

        const cobrosPrev = await tx.transaction.aggregate({
          where: { businessId, linkedCreditoId: credito.id },
          _sum: { amount: true },
        })
        const yaCobrado = cobrosPrev._sum.amount ?? 0
        const saldoPendiente = credito.amount - yaCobrado
        if (amount > saldoPendiente + 0.001) {
          throw new Error(`El monto excede el saldo pendiente ($${saldoPendiente.toFixed(2)})`)
        }

        const newTx = await tx.transaction.create({
          data: {
            amount,
            description,
            type: 'INCOME',
            subType: 'COBRO_CREDITO',
            date,
            currency,
            esCredito: false,
            estado: 'COBRADO',
            account: { connect: { id: accountId } },
            business: { connect: { id: businessId } },
            linkedCredito: { connect: { id: credito.id } },
            contact: credito.contactId ? { connect: { id: credito.contactId } } : undefined,
          },
          select: { id: true },
        })

        await tx.account.update({
          where: { id: accountId },
          data: { currentBalance: { increment: amount } },
        })

        const nuevoCobrado = yaCobrado + amount
        const nuevoEstado = Math.abs(credito.amount - nuevoCobrado) < 0.001 ? 'COBRADO' : 'PARCIAL'
        await tx.transaction.update({ where: { id: credito.id }, data: { estado: nuevoEstado } })

        const cxc = await tx.account.findFirst({
          where: { businessId, isSystemAccount: true, subtype: 'RECEIVABLE' },
          select: { id: true },
        })
        const journalResult = generateJournalLines({
          amount,
          type: 'INCOME',
          esCredito: false,
          physicalAccountId: accountId,
          categoryContableAccountId: null,
          cxcAccountId: cxc?.id ?? null,
          cxpAccountId: null,
          description,
          mode: 'COBRO_CREDITO',
        })
        if (!journalResult.ok) throw new Error('No se pudo generar el asiento contable. Verificá las cuentas del negocio.')
        if (journalResult.ok) {
          await tx.journalEntry.create({
            data: { date, description, transactionId: newTx.id, businessId, lines: { create: journalResult.lines } },
          })
        }

        if (credito.contactId) {
          const totalContacto = await tx.transaction.aggregate({
            where: {
              businessId,
              contactId: credito.contactId,
              esCredito: true,
              type: 'INCOME',
              estado: { in: ['PENDIENTE', 'PARCIAL', 'VENCIDO'] },
            },
            _sum: { amount: true },
          })
          const cobradoContacto = await tx.transaction.aggregate({
            where: { businessId, linkedCredito: { contactId: credito.contactId } },
            _sum: { amount: true },
          })
          const deudaTotal = (totalContacto._sum.amount ?? 0) - (cobradoContacto._sum.amount ?? 0)
          if (deudaTotal <= 0.001) {
            clienteSaldado = true
            clienteNombre = credito.contact?.name
          }
        }
        return
      }

      // ============ PAGO DE DEUDA (mirror de cobro) ============
      if (isPagoDeuda && linkedCreditoId) {
        const deuda = await tx.transaction.findFirst({
          where: { id: linkedCreditoId, businessId, esCredito: true, type: 'EXPENSE', estado: { in: ['PENDIENTE', 'PARCIAL', 'VENCIDO'] } },
          select: { id: true, amount: true, currency: true, estado: true, contactId: true, contact: { select: { id: true, name: true } } },
        })
        if (!deuda) throw new Error('Deuda no encontrada')
        if (deuda.currency !== currency) throw new Error('La moneda del pago debe coincidir con la de la deuda')

        const reserved = await tx.transaction.updateMany({
          where: { id: deuda.id, businessId, esCredito: true, estado: deuda.estado },
          data: { estado: 'PROCESSING' },
        })
        if (reserved.count !== 1) throw new Error('La deuda está siendo actualizada. Volvé a intentarlo.')

        const pagosPrev = await tx.transaction.aggregate({
          where: { businessId, linkedCreditoId: deuda.id },
          _sum: { amount: true },
        })
        const yaPagado = pagosPrev._sum.amount ?? 0
        const saldoPendiente = deuda.amount - yaPagado
        if (amount > saldoPendiente + 0.001) {
          throw new Error(`El monto excede el saldo pendiente ($${saldoPendiente.toFixed(2)})`)
        }

        const newTx = await tx.transaction.create({
          data: {
            amount,
            description,
            type: 'EXPENSE',
            subType: 'PAGO_DEUDA',
            date,
            currency,
            esCredito: false,
            estado: 'PAGADO',
            account: { connect: { id: accountId } },
            business: { connect: { id: businessId } },
            linkedCredito: { connect: { id: deuda.id } },
            contact: deuda.contactId ? { connect: { id: deuda.contactId } } : undefined,
          },
          select: { id: true },
        })

        await tx.account.update({
          where: { id: accountId },
          data: { currentBalance: { decrement: amount } },
        })

        const nuevoPagado = yaPagado + amount
        const nuevoEstado = Math.abs(deuda.amount - nuevoPagado) < 0.001 ? 'PAGADO' : 'PARCIAL'
        await tx.transaction.update({ where: { id: deuda.id }, data: { estado: nuevoEstado } })

        const cxp = await tx.account.findFirst({
          where: { businessId, isSystemAccount: true, subtype: 'PAYABLE' },
          select: { id: true },
        })
        const journalResult = generateJournalLines({
          amount,
          type: 'EXPENSE',
          esCredito: false,
          physicalAccountId: accountId,
          categoryContableAccountId: null,
          cxcAccountId: null,
          cxpAccountId: cxp?.id ?? null,
          description,
          mode: 'PAGO_DEUDA',
        })
        if (!journalResult.ok) throw new Error('No se pudo generar el asiento contable. Verificá las cuentas del negocio.')
        if (journalResult.ok) {
          await tx.journalEntry.create({
            data: { date, description, transactionId: newTx.id, businessId, lines: { create: journalResult.lines } },
          })
        }

        if (deuda.contactId) {
          const totalContacto = await tx.transaction.aggregate({
            where: {
              businessId,
              contactId: deuda.contactId,
              esCredito: true,
              type: 'EXPENSE',
              estado: { in: ['PENDIENTE', 'PARCIAL', 'VENCIDO'] },
            },
            _sum: { amount: true },
          })
          const pagadoContacto = await tx.transaction.aggregate({
            where: { businessId, linkedCredito: { contactId: deuda.contactId } },
            _sum: { amount: true },
          })
          const deudaTotal = (totalContacto._sum.amount ?? 0) - (pagadoContacto._sum.amount ?? 0)
          if (deudaTotal <= 0.001) {
            proveedorSaldado = true
            proveedorNombre = deuda.contact?.name
          }
        }
        return
      }

      // ============ VENTA DE BIEN DE USO ============
      if (isSaleBienUso && bienDeUsoId) {
        const bien = await tx.bienDeUso.findFirst({
          where: { id: bienDeUsoId, businessId, activo: true },
          select: { id: true, valorAdquisicion: true, depreciacionAcumulada: true },
        })
        if (!bien) throw new Error('Bien de uso no encontrado')
        const valorNeto = Math.max(0, bien.valorAdquisicion - bien.depreciacionAcumulada)

        const newTx = await tx.transaction.create({
          data: {
            amount,
            description,
            type: 'INCOME',
            subType: 'SALE_BIEN_USO',
            date,
            currency,
            esCredito,
            estado: esCredito ? estado : 'COBRADO',
            fechaVencimiento: fVenc,
            account: { connect: { id: accountId } },
            business: { connect: { id: businessId } },
            bienDeUso: { connect: { id: bien.id } },
            category: effectiveCategoryId ? { connect: { id: effectiveCategoryId } } : undefined,
            contact: contactId && contactId !== '' ? { connect: { id: contactId } } : undefined,
          },
          select: { id: true },
        })

        await tx.bienDeUso.update({ where: { id: bien.id }, data: { activo: false } })

        if (!esCredito) {
          await tx.account.update({
            where: { id: accountId },
            data: { currentBalance: { increment: amount } },
          })
        }

        const [categoryWithContable, cxc, fixed] = await Promise.all([
          effectiveCategoryId
            ? tx.category.findFirst({ where: { id: effectiveCategoryId, businessId }, select: { contableAccountId: true } })
            : null,
          tx.account.findFirst({ where: { businessId, isSystemAccount: true, subtype: 'RECEIVABLE' }, select: { id: true } }),
          tx.account.findFirst({ where: { businessId, isSystemAccount: true, subtype: 'FIXED_ASSET' }, select: { id: true } }),
        ])
        const journalResult = generateJournalLines({
          amount,
          type: 'INCOME',
          esCredito,
          physicalAccountId: accountId,
          categoryContableAccountId: categoryWithContable?.contableAccountId ?? null,
          cxcAccountId: cxc?.id ?? null,
          cxpAccountId: null,
          description,
          mode: 'SALE_BIEN_USO',
          fixedAssetAccountId: fixed?.id ?? null,
          bienValorNetoEnLibros: valorNeto,
        })
        if (!journalResult.ok) throw new Error('No se pudo generar el asiento contable. Verificá las cuentas del negocio.')
        if (journalResult.ok) {
          await tx.journalEntry.create({
            data: { date, description, transactionId: newTx.id, businessId, lines: { create: journalResult.lines } },
          })
        }
        return
      }

      // ============ COMPRA DE BIEN DE USO (alta de activo fijo) ============
      if (isPurchaseBienUso) {
        const nuevoBien = await tx.bienDeUso.create({
          data: {
            nombre: bienNombreNuevo,
            categoria: bienCategoriaNuevo || null,
            marca: bienMarcaNuevo || null,
            valorAdquisicion: amount,
            valorResidual: 0,
            depreciacionAcumulada: 0,
            fechaAdquisicion: date,
            activo: true,
            businessId,
          },
          select: { id: true },
        })

        const newTx = await tx.transaction.create({
          data: {
            amount,
            description,
            type: 'EXPENSE',
            subType: 'PURCHASE_BIEN_USO',
            date,
            currency,
            esCredito,
            estado: esCredito ? estado : 'PAGADO',
            fechaVencimiento: fVenc,
            account: { connect: { id: accountId } },
            business: { connect: { id: businessId } },
            bienDeUso: { connect: { id: nuevoBien.id } },
            contact: contactId && contactId !== '' ? { connect: { id: contactId } } : undefined,
          },
          select: { id: true },
        })

        if (!esCredito) {
          await tx.account.update({
            where: { id: accountId },
            data: { currentBalance: { decrement: amount } },
          })
        }

        const [cxp, fixed] = await Promise.all([
          tx.account.findFirst({ where: { businessId, isSystemAccount: true, subtype: 'PAYABLE' }, select: { id: true } }),
          tx.account.findFirst({ where: { businessId, isSystemAccount: true, subtype: 'FIXED_ASSET' }, select: { id: true } }),
        ])
        const journalResult = generateJournalLines({
          amount,
          type: 'EXPENSE',
          esCredito,
          physicalAccountId: accountId,
          categoryContableAccountId: null,
          cxcAccountId: null,
          cxpAccountId: cxp?.id ?? null,
          description,
          mode: 'PURCHASE_BIEN_USO',
          fixedAssetAccountId: fixed?.id ?? null,
        })
        if (!journalResult.ok) throw new Error('No se pudo generar el asiento contable. Verificá las cuentas del negocio.')
        if (journalResult.ok) {
          await tx.journalEntry.create({
            data: { date, description, transactionId: newTx.id, businessId, lines: { create: journalResult.lines } },
          })
        }
        return
      }

      // ============ FLUJO ESTÁNDAR ============
      const newTx = await tx.transaction.create({
        data: {
          amount,
          description,
          type,
          subType: subType || null,
          date,
          currency,
          esCredito,
          estado: esCredito ? estado : (type === 'INCOME' ? 'COBRADO' : 'PAGADO'),
          fechaVencimiento: fVenc,
          cantidad: cantidad ?? null,
          precioUnitario: precioUnitario ?? null,
          account: { connect: { id: accountId } },
          business: { connect: { id: businessId } },
          category: effectiveCategoryId && effectiveCategoryId !== '' ? { connect: { id: effectiveCategoryId } } : undefined,
          subcategory: subcategoryId ? { connect: { id: subcategoryId } } : undefined,
          contact: contactId && contactId !== '' ? { connect: { id: contactId } } : undefined,
          areaNegocio: areaNegocioId && areaNegocioId !== '' ? { connect: { id: areaNegocioId } } : undefined,
          empleado: empleadoId && empleadoId !== '' ? { connect: { id: empleadoId } } : undefined,
          producto: productoId && productoId !== '' ? { connect: { id: productoId } } : undefined,
        },
        select: { id: true },
      })

      if (!esCredito) {
        const balanceChange = type === 'INCOME' ? amount : -amount
        await tx.account.update({
          where: { id: accountId },
          data: { currentBalance: balanceChange > 0 ? { increment: balanceChange } : { decrement: -balanceChange } },
        })
      }

      const [categoryWithContable, cxcAccount, cxpAccount, inventoryAccount, cogsAccount] = await Promise.all([
        effectiveCategoryId && effectiveCategoryId !== ''
          ? tx.category.findFirst({ where: { id: effectiveCategoryId, businessId }, select: { contableAccountId: true } })
          : null,
        tx.account.findFirst({ where: { businessId, isSystemAccount: true, subtype: 'RECEIVABLE' }, select: { id: true } }),
        tx.account.findFirst({ where: { businessId, isSystemAccount: true, subtype: 'PAYABLE' }, select: { id: true } }),
        tx.account.findFirst({ where: { businessId, isSystemAccount: true, subtype: 'INVENTORY' }, select: { id: true } }),
        tx.account.findFirst({ where: { businessId, isSystemAccount: true, subtype: 'COGS' }, select: { id: true } }),
      ])

      let costoMercaderia = 0
      let producto: { id: string; tipo: string; stockActual: number; precioCosto: number } | null = null
      if ((isSaleProduct || isPurchaseProduct) && productoId && cantidad && cantidad > 0) {
        producto = await tx.producto.findFirst({
          where: { id: productoId, businessId },
          select: { id: true, tipo: true, stockActual: true, precioCosto: true },
        })
        if (producto && producto.tipo === 'MERCADERIA' && isSaleProduct) {
          costoMercaderia = cantidad * (producto.precioCosto ?? 0)
        }
        // Compra de mercadería con costeo PROMEDIO: actualizar precioCosto del producto
        if (producto && producto.tipo === 'MERCADERIA' && isPurchaseProduct && precioUnitario && precioUnitario > 0) {
          const stockActual = producto.stockActual
          const stockNuevo = stockActual + cantidad
          if (stockNuevo > 0) {
            const promedio = ((stockActual * (producto.precioCosto ?? 0)) + (cantidad * precioUnitario)) / stockNuevo
            await tx.producto.update({ where: { id: productoId }, data: { precioCosto: promedio } })
          }
        }
      }

      const useProductMode = isSaleProduct && producto?.tipo === 'MERCADERIA' && costoMercaderia > 0
      const usePurchaseMode = isPurchaseProduct

      const journalResult = generateJournalLines({
        amount,
        type: type as 'INCOME' | 'EXPENSE',
        esCredito,
        physicalAccountId: accountId,
        categoryContableAccountId: categoryWithContable?.contableAccountId ?? null,
        cxcAccountId: cxcAccount?.id ?? null,
        cxpAccountId: cxpAccount?.id ?? null,
        description,
        mode: useProductMode ? 'SALE_PRODUCT' : usePurchaseMode ? 'PURCHASE_PRODUCT' : 'STANDARD',
        costoMercaderia: useProductMode ? costoMercaderia : undefined,
        inventoryAccountId: inventoryAccount?.id ?? null,
        cogsAccountId: cogsAccount?.id ?? null,
      })

      if (!journalResult.ok) throw new Error('No se pudo generar el asiento contable. Verificá las cuentas del negocio.')
      if (journalResult.ok) {
        await tx.journalEntry.create({
          data: { date, description, transactionId: newTx.id, businessId, lines: { create: journalResult.lines } },
        })
      }

      if (productoId && productoId !== '' && cantidad && cantidad > 0 && producto) {
        let tipoMov: 'SALIDA' | 'ENTRADA' | null = null
        if ((subType === 'SALE' || subType === 'SALE_PRODUCT') && producto.tipo === 'MERCADERIA') tipoMov = 'SALIDA'
        else if (subType === 'PURCHASE' || subType === 'PURCHASE_PRODUCT') tipoMov = 'ENTRADA'
        if (tipoMov) {
          const stockUpdate = await tx.producto.updateMany({
            where: {
              id: productoId,
              businessId,
              ...(tipoMov === 'SALIDA' ? { stockActual: { gte: cantidad } } : {}),
            },
            data: { stockActual: tipoMov === 'SALIDA' ? { decrement: cantidad } : { increment: cantidad } },
          })
          if (stockUpdate.count === 0) throw new Error(`No hay stock suficiente de ${productoId}`)
          await tx.movimientoStock.create({
            data: {
              tipo: tipoMov,
              cantidad,
              precio: precioUnitario ?? 0,
              // CPP del momento de la venta (se leyó antes de cualquier recálculo): base del CMV
              costoUnitario: tipoMov === 'SALIDA' ? (producto.precioCosto ?? 0) : null,
              motivo: description,
              fecha: date,
              producto: { connect: { id: productoId } },
            },
          })
        }
      }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al registrar la operación'
    return { success: false, error: msg }
  }

  revalidateTag(`dashboard:${businessId}`, 'max')
  revalidatePath('/')
  revalidatePath('/stock')
  revalidatePath('/creditos')
  revalidatePath('/bienes-de-uso')
  return { success: true, data: { clienteSaldado, clienteNombre, proveedorSaldado, proveedorNombre } }
}

export async function getAllTransactions(
  period?: DashboardPeriodKey,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
  selectedDay?: string,
  selectedWeekStart?: string,
) {
  const businessId = await getBusinessId()
  const dateFilter = period
    ? (() => {
        const { from, to } = computePeriodRange(period, customFrom, customTo, selectedYear, selectedMonth, selectedDay, selectedWeekStart)
        return { date: { gte: from, lte: to } }
      })()
    : {}
  return await prisma.transaction.findMany({
    where: { businessId, ...dateFilter },
    orderBy: { date: 'desc' },
    include: {
      category: true, subcategory: { select: { name: true } }, account: true, contact: true, areaNegocio: true,
      operacion: { select: { total: true, descuento: true, items: { select: { cantidad: true, precioUnitario: true, subtotal: true, producto: { select: { nombre: true } } } } } },
    },
  })
}

export async function getLatestTransactionDate() {
  const businessId = await getBusinessId()
  const latest = await prisma.transaction.findFirst({
    where: { businessId },
    orderBy: { date: 'desc' },
    select: { date: true },
  })

  return latest?.date ?? null
}



export async function deleteTransaction(id: string): Promise<ActionResult> {
  await getBusinessId(true)
  void id
  return {
    success: false,
    error: 'No se eliminan movimientos financieros. Conservá el historial y registrá una reversión para corregirlo.',
  }
}


export async function getTransactions() {
  const businessId = await getBusinessId()
  return await prisma.transaction.findMany({
    where: { businessId },
    orderBy: { date: 'desc' },
    include: { category: true, subcategory: { select: { name: true } }, account: true, contact: true, areaNegocio: true },
    take: 100
  })
}

'use server'

import prisma from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { unstable_cache } from 'next/cache'
import { requireBusinessContext } from '@/server/auth/require-business-context'
import {
  updateAccountSchema,
  createContactSchema,
  createCategorySchema,
  createAreaNegocioSchema,
  createProductoSchema,
  createMovimientoStockSchema,
  type ActionResult,
} from '@/lib/validations'
import { generateJournalLines } from '@/server/accounting/journal-engine'
import { createContableAccountForCategory } from '@/server/accounting/setup-contable-accounts'

async function getBusinessId() {
  const sessionContext = await requireBusinessContext()
  return sessionContext.activeBusiness.id
}

async function getScopedAccount(id: string, businessId: string) {
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
async function getOrCreateDefaultCategory(
  businessId: string,
  type: 'INCOME' | 'EXPENSE',
  subType: string | undefined,
): Promise<string | null> {
  const name =
    subType === 'SALE' ? 'Ventas' :
    subType === 'PURCHASE' ? 'Compras' :
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

async function getScopedTransaction(id: string, businessId: string) {
  return prisma.transaction.findFirst({
    where: { id, businessId },
    select: {
      id: true,
      accountId: true,
      amount: true,
      type: true,
    },
  })
}

async function getScopedProducto(id: string, businessId: string) {
  return prisma.producto.findFirst({
    where: { id, businessId },
    select: { id: true, stockActual: true },
  })
}

export async function getAccounts(preBusinessId?: string) {
  const businessId = preBusinessId ?? await getBusinessId()
  return await prisma.account.findMany({
    where: { businessId },
  })
}

// Catálogos combinados para el modal de registro de movimientos.
// Corre todas las queries en paralelo dentro de un solo round-trip de server action.
export async function getModalCatalogs() {
  const businessId = await getBusinessId()
  const [accounts, categories, contacts, areas, productos, empleados] = await Promise.all([
    prisma.account.findMany({ where: { businessId } }),
    prisma.category.findMany({ where: { businessId } }),
    prisma.contact.findMany({ where: { businessId }, orderBy: { name: 'asc' } }),
    prisma.areaNegocio.findMany({ where: { businessId }, orderBy: { nombre: 'asc' } }),
    prisma.producto.findMany({ where: { businessId, activo: true }, orderBy: { nombre: 'asc' } }),
    prisma.empleado.findMany({ where: { businessId, activo: true }, orderBy: { nombre: 'asc' } }),
  ])
  return { accounts, categories, contacts, areas, productos, empleados }
}

export async function getCategories(preBusinessId?: string) {
  const businessId = preBusinessId ?? await getBusinessId()
  return await prisma.category.findMany({
    where: { businessId },
  })
}

export async function getTransactions() {
  const businessId = await getBusinessId()
  return await prisma.transaction.findMany({
    where: { businessId },
    orderBy: { date: 'desc' },
    include: { category: true, account: true, contact: true, areaNegocio: true },
    take: 100
  })
}

export async function getAreasNegocio(preBusinessId?: string) {
  const businessId = preBusinessId ?? await getBusinessId()
  return await prisma.areaNegocio.findMany({
    where: { businessId },
    orderBy: { nombre: 'asc' }
  })
}

export async function getContacts(preBusinessId?: string) {
  const businessId = preBusinessId ?? await getBusinessId()
  return await prisma.contact.findMany({
    where: { businessId },
    orderBy: { name: 'asc' }
  })
}

export async function createContact(formData: FormData): Promise<ActionResult> {
  void formData
  // TODO: Implementar con Auth (businessId)
  return { success: false, error: "Función deshabilitada temporalmente hasta configurar Auth." }
  /*
  const raw = {
    name: (formData.get('name') as string)?.trim(),
    type: formData.get('type') as string,
    phone: (formData.get('phone') as string)?.trim(),
    email: (formData.get('email') as string)?.trim(),
  }

  const parsed = createContactSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { name, type, phone, email } = parsed.data

  await prisma.contact.create({
    data: {
      name,
      type,
      phone: phone || null,
      email: email || null,
    }
  })

  revalidatePath('/')
  return { success: true }
  */
}

export async function createTransaction(formData: FormData): Promise<ActionResult> {
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
    contactId: formData.get('contactId') as string,
    areaNegocioId: formData.get('areaNegocioId') as string,
    empleadoId: formData.get('empleadoId') as string,
    productoId: formData.get('productoId') as string,
    cantidad: isNaN(cantidadRaw) ? undefined : cantidadRaw,
    precioUnitario: isNaN(precioUnitarioRaw) ? undefined : precioUnitarioRaw,
    date: formData.get('date') as string,
    currency: (formData.get('currency') as string) || 'ARS',
    esCredito: esCreditoRaw === 'true' || esCreditoRaw === '1',
    estado: (formData.get('estado') as string) || 'COBRADO',
    fechaVencimiento: (formData.get('fechaVencimiento') as string) || undefined,
  }

  const { createTransactionSchema } = await import('@/lib/validations')
  const parsed = createTransactionSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue.path.join('.')
    console.error('[createTransaction] validation failed', { field, message: issue.message, raw })
    return { success: false, error: `${field}: ${issue.message}` }
  }

  const {
    amount, description, type, subType, accountId, categoryId, contactId,
    areaNegocioId, empleadoId, productoId, cantidad, precioUnitario,
    date: dateStr, currency, esCredito, estado, fechaVencimiento,
  } = parsed.data

  const businessId = await getBusinessId()
  const account = await getScopedAccount(accountId, businessId)
  if (!account) return { success: false, error: 'Cuenta no encontrada' }

  // Auto-asignación de categoría: si el form no la envió, usar/crear una por defecto
  // según el tipo de movimiento. Así toda transacción tiene asiento contable.
  let effectiveCategoryId = categoryId
  if (!effectiveCategoryId || effectiveCategoryId === '') {
    const defaultId = await getOrCreateDefaultCategory(
      businessId,
      type as 'INCOME' | 'EXPENSE',
      subType,
    )
    effectiveCategoryId = defaultId ?? ''
  }

  const date = dateStr ? new Date(dateStr) : new Date()
  const fVenc = fechaVencimiento ? new Date(fechaVencimiento) : null

  await prisma.$transaction(async (tx) => {
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
        contact: contactId && contactId !== '' ? { connect: { id: contactId } } : undefined,
        areaNegocio: areaNegocioId && areaNegocioId !== '' ? { connect: { id: areaNegocioId } } : undefined,
        empleado: empleadoId && empleadoId !== '' ? { connect: { id: empleadoId } } : undefined,
        producto: productoId && productoId !== '' ? { connect: { id: productoId } } : undefined,
      },
      select: { id: true },
    })

    // Actualizar balance de la cuenta (caché — fuente de verdad es el journal)
    const balanceChange = type === 'INCOME' ? amount : -amount
    await tx.account.update({
      where: { id: accountId },
      data: { currentBalance: account.currentBalance + balanceChange },
    })

    // ── Motor de doble partida ───────────────────────────────────────────────
    // Obtener cuenta contable de la categoría y cuentas sistema del negocio
    const [categoryWithContable, cxcAccount, cxpAccount] = await Promise.all([
      effectiveCategoryId && effectiveCategoryId !== ''
        ? tx.category.findFirst({
            where: { id: effectiveCategoryId, businessId },
            select: { contableAccountId: true },
          })
        : null,
      tx.account.findFirst({
        where: { businessId, isSystemAccount: true, subtype: 'RECEIVABLE' },
        select: { id: true },
      }),
      tx.account.findFirst({
        where: { businessId, isSystemAccount: true, subtype: 'PAYABLE' },
        select: { id: true },
      }),
    ])

    const journalResult = generateJournalLines({
      amount,
      type: type as 'INCOME' | 'EXPENSE',
      esCredito,
      physicalAccountId: accountId,
      categoryContableAccountId: categoryWithContable?.contableAccountId ?? null,
      cxcAccountId: cxcAccount?.id ?? null,
      cxpAccountId: cxpAccount?.id ?? null,
      description,
    })

    if (journalResult.ok) {
      await tx.journalEntry.create({
        data: {
          date,
          description,
          transactionId: newTx.id,
          businessId,
          lines: {
            create: journalResult.lines,
          },
        },
      })
    }
    // Si journalResult.ok === false: degradación graceful, no se interrumpe la operación

    // Actualizar stock si hay producto vinculado
    if (productoId && productoId !== '' && cantidad && cantidad > 0) {
      const tipoMovimiento = subType === 'SALE' ? 'SALIDA' : subType === 'PURCHASE' ? 'ENTRADA' : null
      if (tipoMovimiento) {
        const producto = await getScopedProducto(productoId, businessId)
        if (producto) {
          const nuevoStock = tipoMovimiento === 'SALIDA'
            ? producto.stockActual - cantidad
            : producto.stockActual + cantidad
          await tx.producto.update({
            where: { id: productoId },
            data: { stockActual: nuevoStock },
          })
          await tx.movimientoStock.create({
            data: {
              tipo: tipoMovimiento,
              cantidad,
              precio: precioUnitario ?? 0,
              motivo: description,
              fecha: date,
              producto: { connect: { id: productoId } },
            },
          })
        }
      }
    }
  })

  revalidateTag(`dashboard:${businessId}`, 'max')
  revalidatePath('/')
  revalidatePath('/stock')
  revalidatePath('/creditos')
  return { success: true }
}

export async function deleteTransaction(id: string) {
  const businessId = await getBusinessId()
  const transaction = await getScopedTransaction(id, businessId)
  if (!transaction) return

  // Revert balance
  const account = await getScopedAccount(transaction.accountId, businessId)
  if (account) {
    const balanceChange = transaction.type === 'INCOME' ? -transaction.amount : transaction.amount
    await prisma.account.update({
      where: { id: transaction.accountId },
      data: { currentBalance: account.currentBalance + balanceChange }
    })
  }

  // Eliminar JournalEntry vinculado (cascade elimina JournalLines)
  await prisma.journalEntry.deleteMany({ where: { transactionId: id } })

  await prisma.transaction.deleteMany({ where: { id, businessId } })
  revalidateTag(`dashboard:${businessId}`, 'max')
  revalidatePath('/')
}

export async function createAccount(formData: FormData): Promise<ActionResult> {
  void formData
  // TODO: Implementar con Auth (businessId)
  return { success: false, error: "Función deshabilitada temporalmente hasta configurar Auth." }
  /*
  const raw = {
    name: (formData.get('name') as string)?.trim(),
    type: formData.get('type') as string,
    currency: formData.get('currency') as string,
  }

  const parsed = createAccountSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { name, type, currency } = parsed.data

  await prisma.account.create({
    data: { name, type, currency, currentBalance: 0 }
  })

  revalidatePath('/')
  return { success: true }
  */
}

export async function getAllTransactions() {
  const businessId = await getBusinessId()
  return await prisma.transaction.findMany({
    where: { businessId },
    orderBy: { date: 'desc' },
    include: { category: true, account: true, contact: true, areaNegocio: true },
  })
}

export type DateRange = { from?: Date; to?: Date }

export async function getReportData(range?: DateRange) {
  const businessId = await getBusinessId()
  const dateFilter = range?.from || range?.to
    ? { date: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } }
    : {}
  const allTx = await prisma.transaction.findMany({
    where: { businessId, ...dateFilter },
    orderBy: { date: 'desc' },
    include: { category: true, account: true, contact: true, areaNegocio: true },
  })

  // -- Totales por moneda --
  const totalsByCurrency: Record<string, { income: number; expense: number }> = {}
  for (const tx of allTx) {
    const cur = tx.currency || 'ARS'
    if (!totalsByCurrency[cur]) totalsByCurrency[cur] = { income: 0, expense: 0 }
    if (tx.type === 'INCOME') totalsByCurrency[cur].income += tx.amount
    else totalsByCurrency[cur].expense += tx.amount
  }

  // -- Evolución mensual últimos 12 meses por moneda --
  const monthlyMap: Record<string, Record<string, { income: number; expense: number }>> = {}
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlyMap[key] = {}
  }
  for (const tx of allTx) {
    const d = new Date(tx.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!monthlyMap[key]) continue
    const cur = tx.currency || 'ARS'
    if (!monthlyMap[key][cur]) monthlyMap[key][cur] = { income: 0, expense: 0 }
    if (tx.type === 'INCOME') monthlyMap[key][cur].income += tx.amount
    else monthlyMap[key][cur].expense += tx.amount
  }
  const monthlyHistory = Object.entries(monthlyMap).map(([month, byCur]) => ({ month, byCur }))

  // -- Top categorías por gasto --
  const categoryMap: Record<string, { name: string; income: number; expense: number; currency: string }> = {}
  for (const tx of allTx) {
    if (!tx.category) continue
    const id = tx.categoryId!
    if (!categoryMap[id]) categoryMap[id] = { name: tx.category.name, income: 0, expense: 0, currency: tx.currency || 'ARS' }
    if (tx.type === 'INCOME') categoryMap[id].income += tx.amount
    else categoryMap[id].expense += tx.amount
  }
  const topCategories = Object.values(categoryMap)
    .sort((a, b) => (b.income + b.expense) - (a.income + a.expense))
    .slice(0, 8)

  // -- Top contactos --
  const contactMap: Record<string, { name: string; income: number; expense: number; txCount: number }> = {}
  for (const tx of allTx) {
    if (!tx.contact) continue
    const id = tx.contactId!
    if (!contactMap[id]) contactMap[id] = { name: tx.contact.name, income: 0, expense: 0, txCount: 0 }
    if (tx.type === 'INCOME') contactMap[id].income += tx.amount
    else contactMap[id].expense += tx.amount
    contactMap[id].txCount++
  }
  const topContacts = Object.values(contactMap)
    .sort((a, b) => (b.income + b.expense) - (a.income + a.expense))
    .slice(0, 6)

  // -- Top áreas de negocio --
  const areaMap: Record<string, { nombre: string; income: number; expense: number }> = {}
  for (const tx of allTx) {
    if (!tx.areaNegocio) continue
    const id = tx.areaNegocioId!
    if (!areaMap[id]) areaMap[id] = { nombre: tx.areaNegocio.nombre, income: 0, expense: 0 }
    if (tx.type === 'INCOME') areaMap[id].income += tx.amount
    else areaMap[id].expense += tx.amount
  }
  const topAreas = Object.values(areaMap)
    .sort((a, b) => (b.income + b.expense) - (a.income + a.expense))

  // -- Balance real de cuentas (para Runway) --
  const accounts = await prisma.account.findMany({ where: { businessId } })
  const accountTotalByCurrency = accounts.reduce((acc, a) => {
    const c = a.currency || 'ARS'
    acc[c] = (acc[c] || 0) + a.currentBalance
    return acc
  }, {} as Record<string, number>)

  return { allTx, totalsByCurrency, monthlyHistory, topCategories, topContacts, topAreas, accountTotalByCurrency }
}

export async function getMonthlyStats() {
  const businessId = await getBusinessId()
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  
  const transactions = await prisma.transaction.findMany({
    where: { businessId, date: { gte: firstDay, lte: lastDay } }
  })

  const byCurrency: Record<string, { income: number, expense: number }> = {}
  transactions.forEach(t => {
    const cur = t.currency || 'ARS'
    if (!byCurrency[cur]) byCurrency[cur] = { income: 0, expense: 0 }
    if (t.type === 'INCOME') byCurrency[cur].income += t.amount
    else byCurrency[cur].expense += t.amount
  })

  if (!byCurrency['ARS']) byCurrency['ARS'] = { income: 0, expense: 0 }

  return Object.entries(byCurrency).map(([currency, { income, expense }]) => ({
    currency, income, expense, balance: income - expense,
  }))
}

export async function getWeeklyStats() {
  const businessId = await getBusinessId()
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=domingo
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOffset)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const transactions = await prisma.transaction.findMany({
    where: { businessId, date: { gte: monday, lte: sunday } }
  })

  const byCurrency: Record<string, { income: number, expense: number }> = {}
  transactions.forEach(t => {
    const cur = t.currency || 'ARS'
    if (!byCurrency[cur]) byCurrency[cur] = { income: 0, expense: 0 }
    if (t.type === 'INCOME') byCurrency[cur].income += t.amount
    else byCurrency[cur].expense += t.amount
  })

  if (!byCurrency['ARS']) byCurrency['ARS'] = { income: 0, expense: 0 }

  return Object.entries(byCurrency).map(([currency, { income, expense }]) => ({
    currency, income, expense, balance: income - expense,
  }))
}

// ---- Contact CRUD ----

export async function updateContact(id: string, formData: FormData): Promise<ActionResult> {
  const businessId = await getBusinessId()
  const raw = {
    name: (formData.get('name') as string)?.trim(),
    type: formData.get('type') as string,
    phone: (formData.get('phone') as string)?.trim(),
    email: (formData.get('email') as string)?.trim(),
  }

  const parsed = createContactSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { name, type, phone, email } = parsed.data

  const result = await prisma.contact.updateMany({
    where: { id, businessId },
    data: { name, type, phone: phone || null, email: email || null }
  })

  if (result.count === 0) {
    return { success: false, error: 'El contacto no existe o no pertenece al negocio activo' }
  }

  revalidatePath('/')
  return { success: true }
}

export async function deleteContact(id: string) {
  const businessId = await getBusinessId()
  // Desvincula transacciones antes de eliminar
  await prisma.transaction.updateMany({
    where: { contactId: id, businessId },
    data: { contactId: null }
  })
  await prisma.contact.deleteMany({ where: { id, businessId } })
  revalidatePath('/')
}

// ---- Account CRUD ----

export async function updateAccount(id: string, formData: FormData): Promise<ActionResult> {
  const businessId = await getBusinessId()
  const raw = { name: (formData.get('name') as string)?.trim() }

  const parsed = updateAccountSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const result = await prisma.account.updateMany({
    where: { id, businessId },
    data: { name: parsed.data.name }
  })

  if (result.count === 0) {
    return { success: false, error: 'La cuenta no existe o no pertenece al negocio activo' }
  }

  revalidatePath('/')
  return { success: true }
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  const businessId = await getBusinessId()
  const txCount = await prisma.transaction.count({ where: { accountId: id, businessId } })
  if (txCount > 0) {
    return { success: false, error: 'No se puede eliminar una cuenta con transacciones asociadas' }
  }
  const result = await prisma.account.deleteMany({ where: { id, businessId } })
  if (result.count === 0) {
    return { success: false, error: 'La cuenta no existe o no pertenece al negocio activo' }
  }
  revalidatePath('/')
  return { success: true }
}

// ---- Área de Negocio CRUD ----

export async function createAreaNegocio(formData: FormData): Promise<ActionResult> {
  const raw = {
    nombre: (formData.get('nombre') as string)?.trim(),
    descripcion: (formData.get('descripcion') as string)?.trim(),
  }

  const parsed = createAreaNegocioSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  try {
    // Obtenemos el ID del negocio para asociar el área
    const businessId = await getBusinessId()
    await prisma.areaNegocio.create({
      data: {
        nombre: parsed.data.nombre,
        descripcion: parsed.data.descripcion || null,
        businessId,
      }
    })
  } catch {
    return { success: false, error: 'Ya existe un área con ese nombre' }
  }

  revalidatePath('/')
  return { success: true }
}

export async function updateAreaNegocio(id: string, formData: FormData): Promise<ActionResult> {
  const businessId = await getBusinessId()
  const raw = {
    nombre: (formData.get('nombre') as string)?.trim(),
    descripcion: (formData.get('descripcion') as string)?.trim(),
  }

  const parsed = createAreaNegocioSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  try {
    const result = await prisma.areaNegocio.updateMany({
      where: { id, businessId },
      data: { nombre: parsed.data.nombre, descripcion: parsed.data.descripcion || null }
    })

    if (result.count === 0) {
      return { success: false, error: 'El área no existe o no pertenece al negocio activo' }
    }
  } catch {
    return { success: false, error: 'Ya existe un área con ese nombre' }
  }

  revalidatePath('/')
  return { success: true }
}

export async function deleteAreaNegocio(id: string) {
  const businessId = await getBusinessId()
  await prisma.transaction.updateMany({
    where: { areaNegocioId: id, businessId },
    data: { areaNegocioId: null }
  })
  await prisma.areaNegocio.deleteMany({ where: { id, businessId } })
  revalidatePath('/')
}

// ---- Category CRUD ----

export async function createCategory(formData: FormData): Promise<ActionResult> {
  const raw = {
    name: (formData.get('name') as string)?.trim(),
    type: formData.get('type') as string,
  }

  const parsed = createCategorySchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const businessId = await getBusinessId()
  await prisma.$transaction(async (tx) => {
    const category = await tx.category.create({
      data: { ...parsed.data, businessId },
    })
    // Crear cuenta contable del sistema para esta categoría
    await createContableAccountForCategory(
      category.id,
      category.name,
      category.type,
      businessId,
      tx,
    )
  })
  revalidatePath('/')
  return { success: true }
}

export async function updateCategory(id: string, formData: FormData): Promise<ActionResult> {
  const businessId = await getBusinessId()
  const raw = {
    name: (formData.get('name') as string)?.trim(),
    type: formData.get('type') as string,
  }

  const parsed = createCategorySchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const result = await prisma.category.updateMany({ where: { id, businessId }, data: parsed.data })
  if (result.count === 0) {
    return { success: false, error: 'La categoría no existe o no pertenece al negocio activo' }
  }
  revalidatePath('/')
  return { success: true }
}

export async function deleteCategory(id: string) {
  const businessId = await getBusinessId()
  // Desvincula transacciones
  await prisma.transaction.updateMany({
    where: { categoryId: id, businessId },
    data: { categoryId: null }
  })
  await prisma.category.deleteMany({ where: { id, businessId } })
  revalidatePath('/')
}

// ---- Créditos y Deudas ----

export async function getCreditosDeudas() {
  const businessId = await getBusinessId()
  return await prisma.transaction.findMany({
    where: { businessId, esCredito: true },
    orderBy: [{ estado: 'asc' }, { fechaVencimiento: 'asc' }],
    include: { contact: true, category: true, account: true, areaNegocio: true },
  })
}

export async function marcarEstadoCredito(id: string, estado: string): Promise<ActionResult> {
  const businessId = await getBusinessId()
  const valid = ['COBRADO', 'PAGADO', 'PENDIENTE', 'VENCIDO']
  if (!valid.includes(estado)) return { success: false, error: 'Estado inválido' }
  const result = await prisma.transaction.updateMany({
    where: { id, businessId, esCredito: true },
    data: { estado },
  })
  if (result.count === 0) {
    return { success: false, error: 'La transacción no existe o no pertenece al negocio activo' }
  }
  revalidateTag(`dashboard:${businessId}`, 'max')
  revalidatePath('/')
  revalidatePath('/creditos')
  return { success: true }
}

// ---- Empleados ----

export async function getEmpleados(preBusinessId?: string) {
  const businessId = preBusinessId ?? await getBusinessId()
  return await prisma.empleado.findMany({
    where: { businessId, activo: true },
    orderBy: { nombre: 'asc' },
  })
}

// ---- Stock: Productos ----

export async function getProductos() {
  const businessId = await getBusinessId()
  return await prisma.producto.findMany({
    where: { businessId, activo: true },
    orderBy: { nombre: 'asc' },
  })
}

export async function createProducto(formData: FormData): Promise<ActionResult> {
  const raw = {
    nombre: (formData.get('nombre') as string)?.trim(),
    descripcion: (formData.get('descripcion') as string)?.trim(),
    categoria: (formData.get('categoria') as string)?.trim(),
    marca: (formData.get('marca') as string)?.trim(),
    unidad: (formData.get('unidad') as string)?.trim() || 'unidad',
    metodoCosteo: (formData.get('metodoCosteo') as string) || 'PROMEDIO',
    precioVenta: parseFloat(formData.get('precioVenta') as string) || 0,
    precioCosto: parseFloat(formData.get('precioCosto') as string) || 0,
    stockActual: parseFloat(formData.get('stockActual') as string) || 0,
    enTransito: parseFloat(formData.get('enTransito') as string) || 0,
  }

  const parsed = createProductoSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const businessId = await getBusinessId()

  await prisma.producto.create({ data: {
    ...parsed.data,
    descripcion: parsed.data.descripcion || null,
    categoria: parsed.data.categoria || null,
    marca: parsed.data.marca || null,
    businessId,
  }})
  revalidatePath('/stock')
  return { success: true }
}

export async function updateProducto(id: string, formData: FormData): Promise<ActionResult> {
  const businessId = await getBusinessId()
  const raw = {
    nombre: (formData.get('nombre') as string)?.trim(),
    descripcion: (formData.get('descripcion') as string)?.trim(),
    categoria: (formData.get('categoria') as string)?.trim(),
    marca: (formData.get('marca') as string)?.trim(),
    unidad: (formData.get('unidad') as string)?.trim() || 'unidad',
    metodoCosteo: (formData.get('metodoCosteo') as string) || 'PROMEDIO',
    precioVenta: parseFloat(formData.get('precioVenta') as string) || 0,
    precioCosto: parseFloat(formData.get('precioCosto') as string) || 0,
    stockActual: parseFloat(formData.get('stockActual') as string) || 0,
    enTransito: parseFloat(formData.get('enTransito') as string) || 0,
  }

  const parsed = createProductoSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const result = await prisma.producto.updateMany({ where: { id, businessId }, data: {
    ...parsed.data,
    descripcion: parsed.data.descripcion || null,
    categoria: parsed.data.categoria || null,
    marca: parsed.data.marca || null,
  }})

  if (result.count === 0) {
    return { success: false, error: 'El producto no existe o no pertenece al negocio activo' }
  }

  revalidatePath('/stock')
  return { success: true }
}

export async function deleteProducto(id: string) {
  const businessId = await getBusinessId()
  await prisma.producto.updateMany({ where: { id, businessId }, data: { activo: false } })
  revalidatePath('/stock')
}

// ---- Stock: Movimientos ----

export async function addMovimientoStock(formData: FormData): Promise<ActionResult> {
  const businessId = await getBusinessId()
  const raw = {
    productoId: formData.get('productoId') as string,
    tipo: formData.get('tipo') as string,
    cantidad: parseFloat(formData.get('cantidad') as string),
    precio: parseFloat(formData.get('precio') as string) || 0,
    motivo: (formData.get('motivo') as string)?.trim(),
    fecha: formData.get('fecha') as string,
  }

  const parsed = createMovimientoStockSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const { productoId, tipo, cantidad, precio, motivo, fecha: fechaStr } = parsed.data
  const fecha = fechaStr ? new Date(fechaStr) : new Date()
  const producto = await getScopedProducto(productoId, businessId)

  if (!producto) {
    return { success: false, error: 'El producto no existe o no pertenece al negocio activo' }
  }

  await prisma.movimientoStock.create({
    data: { productoId, tipo, cantidad, precio, motivo: motivo || null, fecha },
  })

  // Actualizar stockActual
  const delta = tipo === 'ENTRADA' ? cantidad : tipo === 'SALIDA' ? -cantidad : 0
  const nuevoStock = tipo === 'AJUSTE' ? cantidad : producto.stockActual + delta
  await prisma.producto.update({ where: { id: productoId }, data: { stockActual: nuevoStock } })

  revalidatePath('/stock')
  return { success: true }
}

export async function getMovimientosStock(productoId: string) {
  const businessId = await getBusinessId()
  return await prisma.movimientoStock.findMany({
    where: {
      productoId,
      producto: { businessId },
    },
    orderBy: { fecha: 'desc' },
    take: 50,
  })
}

// ---- Reportes: datos extendidos ----

export async function getReportDataExtended(range?: DateRange) {
  const businessId = await getBusinessId()
  const base = await getReportData(range)
  
  // Estado Patrimonial: cuentas como activos, créditos PENDIENTE como pasivos
  const cuentas = await prisma.account.findMany({ where: { businessId } })
  const creditosPendientes = await prisma.transaction.findMany({
    where: { businessId, esCredito: true, estado: { in: ['PENDIENTE', 'VENCIDO'] } },
  })
  const activosPorMoneda = cuentas.reduce((acc, c) => {
    const cur = c.currency || 'ARS'
    acc[cur] = (acc[cur] || 0) + c.currentBalance
    return acc
  }, {} as Record<string, number>)
  const pasivosPorMoneda = creditosPendientes.reduce((acc, t) => {
    const cur = t.currency || 'ARS'
    // CxP (debemos pagar) = EXPENSE pendiente
    if (t.type === 'EXPENSE') acc[cur] = (acc[cur] || 0) + t.amount
    return acc
  }, {} as Record<string, number>)
  const cxcPorMoneda = creditosPendientes.reduce((acc, t) => {
    const cur = t.currency || 'ARS'
    // CxC (nos deben cobrar) = INCOME pendiente
    if (t.type === 'INCOME') acc[cur] = (acc[cur] || 0) + t.amount
    return acc
  }, {} as Record<string, number>)

  // Flujo de Fondos: clasifica por categoría en Operativo / Inversión / Financiero
  const allTx = base.allTx
  const flujo: Record<string, { operativo: number; inversion: number; financiero: number }> = {}
  const inversionKeywords = ['inversion', 'equipo', 'activo', 'infraestructura', 'maquinaria']
  const financieroKeywords = ['prestamo', 'credito', 'financiamiento', 'dividendo', 'capital']

  for (const tx of allTx) {
    const cur = tx.currency || 'ARS'
    if (!flujo[cur]) flujo[cur] = { operativo: 0, inversion: 0, financiero: 0 }
    const desc = (tx.description + ' ' + (tx.category?.name || '')).toLowerCase()
    const sign = tx.type === 'INCOME' ? 1 : -1
    const val = tx.amount * sign
    if (financieroKeywords.some(k => desc.includes(k))) flujo[cur].financiero += val
    else if (inversionKeywords.some(k => desc.includes(k))) flujo[cur].inversion += val
    else flujo[cur].operativo += val
  }

  // Resumen anual
  const anualMap: Record<string, Record<string, { income: number; expense: number }>> = {}
  const thisYear = new Date().getFullYear()
  for (let y = thisYear - 1; y <= thisYear; y++) {
    anualMap[String(y)] = {}
  }
  for (const tx of allTx) {
    const yr = String(new Date(tx.date).getFullYear())
    if (!anualMap[yr]) continue
    const cur = tx.currency || 'ARS'
    if (!anualMap[yr][cur]) anualMap[yr][cur] = { income: 0, expense: 0 }
    if (tx.type === 'INCOME') anualMap[yr][cur].income += tx.amount
    else anualMap[yr][cur].expense += tx.amount
  }

  // CMV: Costo de Mercadería Vendida = suma de salidas de stock * precio
  const salidasStock = await prisma.movimientoStock.findMany({
    where: {
      tipo: 'SALIDA',
      producto: { businessId },
      ...(range?.from || range?.to
        ? {
            fecha: {
              ...(range.from ? { gte: range.from } : {}),
              ...(range.to ? { lte: range.to } : {}),
            },
          }
        : {}),
    },
  })
  const cmvTotal = salidasStock.reduce((acc, m) => acc + m.cantidad * m.precio, 0)

  // Stock: inventario actual
  const productosActivos = await prisma.producto.findMany({ where: { businessId, activo: true } })
  const valorInventario = productosActivos.reduce((acc, p) => acc + p.stockActual * p.precioCosto, 0)
  const valorInventarioVenta = productosActivos.reduce((acc, p) => acc + p.stockActual * p.precioVenta, 0)
  const margenBrutoInventario = valorInventarioVenta - valorInventario
  // Top 5 productos por valor de stock
  const topProductosPorStock = [...productosActivos]
    .sort((a, b) => (b.stockActual * b.precioCosto) - (a.stockActual * a.precioCosto))
    .slice(0, 5)
    .map(p => ({ nombre: p.nombre, marca: p.marca, stockActual: p.stockActual, precioCosto: p.precioCosto, valorTotal: p.stockActual * p.precioCosto }))

  return { ...base, activosPorMoneda, pasivosPorMoneda, cxcPorMoneda, flujo, anualMap, cmvTotal, valorInventario, valorInventarioVenta, margenBrutoInventario, topProductosPorStock }
}

// ---- Dashboard: datos del día ----

export async function getDailyStats() {
  const businessId = await getBusinessId()
  const now = new Date()
  const inicioHoy = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const finHoy = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  const txHoy = await prisma.transaction.findMany({
    where: { businessId, date: { gte: inicioHoy, lte: finHoy } },
    include: { category: true, account: true },
    orderBy: { date: 'desc' },
  })

  const byCurrency: Record<string, { income: number; expense: number; count: number }> = {}
  for (const tx of txHoy) {
    const cur = tx.currency || 'ARS'
    if (!byCurrency[cur]) byCurrency[cur] = { income: 0, expense: 0, count: 0 }
    if (tx.type === 'INCOME') byCurrency[cur].income += tx.amount
    else byCurrency[cur].expense += tx.amount
    byCurrency[cur].count++
  }

  return { txHoy, byCurrency }
}

// ---- Dashboard Stats (Período dinámico) ----

export type DashboardPeriodKey = 'diario' | 'ayer' | 'semanal' | 'mensual' | 'trimestral' | 'semestral' | 'anual' | 'custom'

export interface DashboardStatsResult {
  kpis: { income: number; expense: number; gain: number; marginPct: number }
  prevKpis: { income: number; expense: number; gain: number; marginPct: number }
  chartData: { label: string; income: number; expense: number; net: number }[]
  categoryBreakdown: { name: string; value: number; color: string }[]
  incomeCategoryBreakdown: { name: string; value: number; color: string }[]
  recentTx: {
    id: string; description: string; amount: number; currency: string; type: string;
    date: Date; category?: { name: string } | null; account?: { name: string } | null;
  }[]
  sparklines: { income: number[]; expense: number[]; balance: number[] }
  debtStatus: {
    vencidos: { count: number; total: number }
    en48hs: { count: number; total: number }
    futuros: { count: number; total: number }
    totalPendiente: number
    creditosDeudas: any[]
  }
  alerts: { severity: 'danger' | 'warning'; icon: 'runway' | 'margin' | 'spike'; title: string; message: string }[]
  periodLabel: string
}

export interface DashboardMonthOption {
  year: number
  month: number
  label: string
  shortYear: string
  key: string
}

export interface DashboardPresetSummary {
  period: Exclude<DashboardPeriodKey, 'custom'>
  periodLabel: string
  income: number
  expense: number
  gain: number
  incomeChangePct: number | null
  expenseChangePct: number | null
  gainChangePct: number | null
}

const DASHBOARD_MONTH_LABELS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function computePeriodRange(
  period: DashboardPeriodKey,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
): { from: Date; to: Date; prevFrom: Date; prevTo: Date; label: string } {
  const now = new Date()
  let from: Date, to: Date, prevFrom: Date, prevTo: Date, label: string

  switch (period) {
    case 'diario': {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      const ayer = new Date(from); ayer.setDate(ayer.getDate() - 1)
      prevFrom = new Date(ayer.getFullYear(), ayer.getMonth(), ayer.getDate(), 0, 0, 0)
      prevTo = new Date(ayer.getFullYear(), ayer.getMonth(), ayer.getDate(), 23, 59, 59, 999)
      label = 'Hoy'
      break
    }
    case 'ayer': {
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      from = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0)
      to = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999)
      const twoDaysAgo = new Date(yesterday)
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 1)
      prevFrom = new Date(twoDaysAgo.getFullYear(), twoDaysAgo.getMonth(), twoDaysAgo.getDate(), 0, 0, 0)
      prevTo = new Date(twoDaysAgo.getFullYear(), twoDaysAgo.getMonth(), twoDaysAgo.getDate(), 23, 59, 59, 999)
      label = 'Ayer'
      break
    }
    case 'semanal': {
      const dayOfWeek = now.getDay()
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset, 0, 0, 0)
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      prevFrom = new Date(from); prevFrom.setDate(prevFrom.getDate() - 7)
      prevTo = new Date(from); prevTo.setDate(prevTo.getDate() - 1); prevTo.setHours(23, 59, 59, 999)
      label = 'Esta semana'
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
      label = now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
      label = from.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
      label = label.charAt(0).toUpperCase() + label.slice(1)
      break
    }
    case 'trimestral': {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
      from = new Date(now.getFullYear(), quarterStartMonth, 1, 0, 0, 0)
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      prevFrom = new Date(now.getFullYear(), quarterStartMonth - 3, 1, 0, 0, 0)
      prevTo = new Date(now.getFullYear(), quarterStartMonth, 0, 23, 59, 59, 999)
      label = 'Trimestre actual'
      break
    }
    case 'semestral': {
      from = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate(), 0, 0, 0)
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      prevFrom = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate(), 0, 0, 0)
      prevTo = new Date(from); prevTo.setDate(prevTo.getDate() - 1); prevTo.setHours(23, 59, 59, 999)
      label = 'Último semestre'
      break
    }
    case 'anual': {
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0)
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      prevFrom = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0)
      prevTo = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999)
      label = `Año ${now.getFullYear()}`
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

function groupTransactions(
  txs: { date: Date; type: string; amount: number }[],
  period: DashboardPeriodKey,
  from: Date,
  to: Date
): { label: string; income: number; expense: number; net: number }[] {
  const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  // Decide grouping based on period or range duration
  const durationDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
  let mode: 'hour' | 'day' | 'month'
  if (period === 'diario' || period === 'ayer') mode = 'hour'
  else if (period === 'semanal') mode = 'day'
  else if (period === 'mensual') mode = 'day'
  else if (period === 'trimestral' || period === 'semestral' || period === 'anual') mode = 'month'
  else {
    // custom
    if (durationDays <= 2) mode = 'hour'
    else if (durationDays <= 62) mode = 'day'
    else mode = 'month'
  }

  const buckets: Record<string, { label: string; income: number; expense: number; order: number }> = {}

  if (mode === 'hour') {
    for (let h = 0; h < 24; h++) {
      const key = String(h)
      buckets[key] = { label: `${h}:00`, income: 0, expense: 0, order: h }
    }
    for (const tx of txs) {
      const d = new Date(tx.date)
      const key = String(d.getHours())
      if (buckets[key]) {
        if (tx.type === 'INCOME') buckets[key].income += tx.amount
        else buckets[key].expense += tx.amount
      }
    }
  } else if (mode === 'day') {
    // Generate day buckets from `from` to `to`
    const cursor = new Date(from)
    let order = 0
    while (cursor <= to) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      const lbl = period === 'semanal'
        ? DAY_LABELS[cursor.getDay()]
        : `${cursor.getDate()}/${cursor.getMonth() + 1}`
      buckets[key] = { label: lbl, income: 0, expense: 0, order: order++ }
      cursor.setDate(cursor.getDate() + 1)
    }
    for (const tx of txs) {
      const d = new Date(tx.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (buckets[key]) {
        if (tx.type === 'INCOME') buckets[key].income += tx.amount
        else buckets[key].expense += tx.amount
      }
    }
  } else {
    // month mode
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1)
    const endMonth = new Date(to.getFullYear(), to.getMonth(), 1)
    let order = 0
    while (cursor <= endMonth) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
      buckets[key] = { label: MONTH_LABELS[cursor.getMonth()], income: 0, expense: 0, order: order++ }
      cursor.setMonth(cursor.getMonth() + 1)
    }
    for (const tx of txs) {
      const d = new Date(tx.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (buckets[key]) {
        if (tx.type === 'INCOME') buckets[key].income += tx.amount
        else buckets[key].expense += tx.amount
      }
    }
  }

  return Object.values(buckets)
    .sort((a, b) => a.order - b.order)
    .map(b => ({ label: b.label, income: b.income, expense: b.expense, net: b.income - b.expense }))
}

function computeSparklines(
  txs: { date: Date; type: string; amount: number }[],
  period: DashboardPeriodKey,
  from: Date,
  to: Date
): { income: number[]; expense: number[]; balance: number[] } {
  // For sparklines we want 6 subdivisions of the period
  const NUM_POINTS = 6
  const totalMs = to.getTime() - from.getTime()
  const sliceMs = totalMs / NUM_POINTS

  const income: number[] = []
  const expense: number[] = []
  const balance: number[] = []

  for (let i = 0; i < NUM_POINTS; i++) {
    const sliceStart = from.getTime() + sliceMs * i
    const sliceEnd = from.getTime() + sliceMs * (i + 1)
    let inc = 0, exp = 0
    for (const tx of txs) {
      const t = new Date(tx.date).getTime()
      if (t >= sliceStart && t < sliceEnd) {
        if (tx.type === 'INCOME') inc += tx.amount
        else exp += tx.amount
      }
    }
    income.push(inc)
    expense.push(exp)
    balance.push(inc - exp)
  }

  return { income, expense, balance }
}

export async function getDashboardStats(
  period: DashboardPeriodKey,
  customFrom?: string,
  customTo?: string,
  /** Pre-resolved businessId — avoids redundant requireBusinessContext() calls */
  preBusinessId?: string,
  selectedYear?: number,
  selectedMonth?: number,
): Promise<DashboardStatsResult> {
  const businessId = preBusinessId ?? await getBusinessId()

  // Cache key includes businessId + period params → safe per-tenant isolation.
  // Revalidates every 15 s so rapid tab switches hit memory, not Turso.
  const cacheKey = `dashboard:${businessId}:${period}:${customFrom ?? ''}:${customTo ?? ''}:${selectedYear ?? ''}:${selectedMonth ?? ''}`
  const cached = unstable_cache(
    async () => _fetchDashboardStats(businessId, period, customFrom, customTo, selectedYear, selectedMonth),
    [cacheKey],
    { revalidate: 15, tags: [`dashboard:${businessId}`] },
  )
  return cached()
}

export async function getMonthlyDashboardStats(
  preBusinessId?: string,
): Promise<DashboardStatsResult> {
  return getDashboardStats('mensual', undefined, undefined, preBusinessId)
}

export async function getAvailableDashboardMonths(
  preBusinessId?: string,
): Promise<DashboardMonthOption[]> {
  const businessId = preBusinessId ?? await getBusinessId()
  const txs = await prisma.transaction.findMany({
    where: { businessId },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    select: { date: true },
    take: 2000,
  })

  const seen = new Set<string>()
  const months: DashboardMonthOption[] = []

  for (const tx of txs) {
    const date = new Date(tx.date)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const key = `${year}-${String(month).padStart(2, '0')}`

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    months.push({
      year,
      month,
      key,
      label: DASHBOARD_MONTH_LABELS[month - 1],
      shortYear: String(year).slice(2),
    })

  }

  if (months.length === 0) {
    const now = new Date()
    months.push({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      key: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      label: DASHBOARD_MONTH_LABELS[now.getMonth()],
      shortYear: String(now.getFullYear()).slice(2),
    })
  }

  while (months.length < 4) {
    const first = months[0]
    const previousDate = new Date(first.year, first.month - 2, 1)
    const year = previousDate.getFullYear()
    const month = previousDate.getMonth() + 1
    const key = `${year}-${String(month).padStart(2, '0')}`

    if (!seen.has(key)) {
      seen.add(key)
      months.unshift({
        year,
        month,
        key,
        label: DASHBOARD_MONTH_LABELS[month - 1],
        shortYear: String(year).slice(2),
      })
    }
  }

  return months.slice(-24)
}

export async function getDashboardPresetSummaries(
  preBusinessId?: string,
): Promise<DashboardPresetSummary[]> {
  const businessId = preBusinessId ?? await getBusinessId()
  const periods: Array<Exclude<DashboardPeriodKey, 'custom'>> = [
    'diario',
    'ayer',
    'semanal',
    'mensual',
    'trimestral',
    'semestral',
    'anual',
  ]

  const entries = await Promise.all(
    periods.map(async (period) => {
      const stats = await getDashboardStats(period, undefined, undefined, businessId)

      return {
        period,
        periodLabel: stats.periodLabel,
        income: stats.kpis.income,
        expense: stats.kpis.expense,
        gain: stats.kpis.gain,
        incomeChangePct: stats.prevKpis.income > 0 ? ((stats.kpis.income - stats.prevKpis.income) / stats.prevKpis.income) * 100 : null,
        expenseChangePct: stats.prevKpis.expense > 0 ? ((stats.kpis.expense - stats.prevKpis.expense) / stats.prevKpis.expense) * 100 : null,
        gainChangePct: stats.prevKpis.gain !== 0 ? ((stats.kpis.gain - stats.prevKpis.gain) / Math.abs(stats.prevKpis.gain)) * 100 : null,
      } satisfies DashboardPresetSummary
    }),
  )

  return entries
}

async function _fetchDashboardStats(
  businessId: string,
  period: DashboardPeriodKey,
  customFrom?: string,
  customTo?: string,
  selectedYear?: number,
  selectedMonth?: number,
): Promise<DashboardStatsResult> {
  const now = new Date()
  const { from, to, prevFrom, prevTo, label: periodLabel } = computePeriodRange(period, customFrom, customTo, selectedYear, selectedMonth)

  // ── Fetch current + previous period transactions in parallel ──
  // prevTxs only needs aggregates; creditosDeudas only needs amounts + status
  const [currentTxs, prevTxs, creditosDeudas, accounts] = await Promise.all([
    prisma.transaction.findMany({
      where: { businessId, date: { gte: from, lte: to } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true, description: true, amount: true, currency: true,
        type: true, date: true, createdAt: true,
        category: { select: { name: true } },
        account: { select: { name: true } },
      },
    }),
    prisma.transaction.findMany({
      where: { businessId, date: { gte: prevFrom, lte: prevTo } },
      select: { amount: true, type: true },
    }),
    prisma.transaction.findMany({
      where: { businessId, esCredito: true, estado: { in: ['PENDIENTE', 'VENCIDO'] } },
      select: { amount: true, estado: true, fechaVencimiento: true },
    }),
    prisma.account.findMany({
      where: { businessId },
      select: { currency: true, currentBalance: true },
    }),
  ])

  // ── KPIs current period ──
  let curIncome = 0, curExpense = 0
  for (const tx of currentTxs) {
    if (tx.type === 'INCOME') curIncome += tx.amount
    else curExpense += tx.amount
  }
  const curGain = curIncome - curExpense
  const curMargin = curIncome > 0 ? (curGain / curIncome) * 100 : 0

  // ── KPIs previous period ──
  let prevIncome = 0, prevExpense = 0
  for (const tx of prevTxs) {
    if (tx.type === 'INCOME') prevIncome += tx.amount
    else prevExpense += tx.amount
  }
  const prevGain = prevIncome - prevExpense
  const prevMargin = prevIncome > 0 ? (prevGain / prevIncome) * 100 : 0

  // ── Chart data (grouped dynamically) ──
  const chartData = groupTransactions(currentTxs, period, from, to)

  // ── Sparklines ──
  const sparklines = computeSparklines(currentTxs, period, from, to)

  // ── Category breakdown (period) ──
  const CAT_COLORS = ['#3A4D39', '#C5A065', '#5A7A57', '#d4ae84', '#6b8f65', '#c49a6c']
  const catMap: Record<string, { name: string; value: number }> = {}
  for (const tx of currentTxs) {
    if (tx.type !== 'EXPENSE') continue
    const catName = tx.category?.name || 'Sin categoría'
    if (!catMap[catName]) catMap[catName] = { name: catName, value: 0 }
    catMap[catName].value += tx.amount
  }
  const categoryBreakdown = Object.values(catMap)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map((c, i) => ({ ...c, color: CAT_COLORS[i % CAT_COLORS.length] }))

  // ── Income category breakdown (period) ──
  const incCatMap: Record<string, { name: string; value: number }> = {}
  for (const tx of currentTxs) {
    if (tx.type !== 'INCOME') continue
    const catName = tx.category?.name || 'Sin categoría'
    if (!incCatMap[catName]) incCatMap[catName] = { name: catName, value: 0 }
    incCatMap[catName].value += tx.amount
  }
  const INCOME_COLORS = ['#2D6A4F', '#5A7A57', '#6b8f65', '#81a87e', '#a3c49e', '#c5dfb8']
  const incomeCategoryBreakdown = Object.values(incCatMap)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map((c, i) => ({ ...c, color: INCOME_COLORS[i % INCOME_COLORS.length] }))

  // ── Recent transactions (last 7 in period) ──
  const recentTx = currentTxs.slice(0, 7).map(tx => ({
    id: tx.id,
    description: tx.description,
    amount: tx.amount,
    currency: tx.currency,
    type: tx.type,
    date: tx.date,
    category: tx.category ? { name: tx.category.name } : null,
    account: tx.account ? { name: tx.account.name } : null,
  }))

  // ── Debt status (independent of period) ──
  const now48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)
  const vencidos = creditosDeudas.filter(c =>
    c.estado === 'VENCIDO' || (c.fechaVencimiento && new Date(c.fechaVencimiento) < now && c.estado === 'PENDIENTE')
  )
  const en48hs = creditosDeudas.filter(c =>
    c.estado === 'PENDIENTE' && c.fechaVencimiento && new Date(c.fechaVencimiento) >= now && new Date(c.fechaVencimiento) <= now48h
  )
  const futuros = creditosDeudas.filter(c =>
    c.estado === 'PENDIENTE' && (!c.fechaVencimiento || new Date(c.fechaVencimiento) > now48h)
  )
  const debtStatus = {
    vencidos: { count: vencidos.length, total: vencidos.reduce((s, c) => s + c.amount, 0) },
    en48hs: { count: en48hs.length, total: en48hs.reduce((s, c) => s + c.amount, 0) },
    futuros: { count: futuros.length, total: futuros.reduce((s, c) => s + c.amount, 0) },
    totalPendiente: creditosDeudas.filter(c => c.estado === 'PENDIENTE' || c.estado === 'VENCIDO').reduce((s, c) => s + c.amount, 0),
    creditosDeudas: creditosDeudas as any[],
  }

  // ── Alerts (based on period data + account balances) ──
  const alerts: DashboardStatsResult['alerts'] = []

  if (curMargin < 20 && curIncome > 0) {
    alerts.push({
      severity: curMargin < 0 ? 'danger' : 'warning',
      icon: 'margin',
      title: 'Margen reducido',
      message: `El margen del período es ${curMargin.toFixed(1)}%. Analizá costos en Reportes.`,
    })
  }
  if (prevExpense > 0 && curExpense > prevExpense * 1.2) {
    const spikePct = ((curExpense - prevExpense) / prevExpense) * 100
    alerts.push({
      severity: spikePct > 50 ? 'danger' : 'warning',
      icon: 'spike',
      title: 'Gastos en alza',
      message: `Los gastos subieron un ${spikePct.toFixed(0)}% respecto al período anterior.`,
    })
  }

  return {
    kpis: { income: curIncome, expense: curExpense, gain: curGain, marginPct: curMargin },
    prevKpis: { income: prevIncome, expense: prevExpense, gain: prevGain, marginPct: prevMargin },
    chartData,
    categoryBreakdown,
    incomeCategoryBreakdown,
    recentTx,
    sparklines,
    debtStatus,
    alerts,
    periodLabel,
  }
}

// ---- Cajas: datos completos para la pestaña Cajas ----

export interface CajasAccountItem {
  id: string
  name: string
  type: string
  currency: string
  currentBalance: number
  recentMovements: number  // movimientos últimos 7 días
  todayVariation: number   // variación neta del día
}

export interface CajasGroupData {
  accounts: CajasAccountItem[]
  total: number
  todayVariation: number
}

export interface CajasData {
  efectivo: CajasGroupData
  virtual: CajasGroupData
  summaryMessage: string       // barra de consejo superior
  aiTipEfectivo: string        // consejo IA para efectivo
  aiTipVirtual: string         // consejo IA para virtual
}

export async function getCajasData(): Promise<CajasData> {
  const businessId = await getBusinessId()

  // Traer todas las cuentas del negocio
  const accounts = await prisma.account.findMany({
    where: { businessId },
  })

  // Fechas para cálculos
  const now = new Date()
  const inicioHoy = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const finHoy = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  const hace7dias = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Movimientos últimos 7 días agrupados por cuenta
  const recentTx = await prisma.transaction.findMany({
    where: { businessId, date: { gte: hace7dias } },
    select: { accountId: true, amount: true, type: true, date: true },
  })

  // Calcular movimientos recientes y variación diaria por cuenta
  const movCountByAccount: Record<string, number> = {}
  const todayVarByAccount: Record<string, number> = {}

  for (const tx of recentTx) {
    // Contar movimientos de últimos 7 días
    movCountByAccount[tx.accountId] = (movCountByAccount[tx.accountId] || 0) + 1

    // Variación de hoy
    if (tx.date >= inicioHoy && tx.date <= finHoy) {
      const delta = tx.type === 'INCOME' ? tx.amount : -tx.amount
      todayVarByAccount[tx.accountId] = (todayVarByAccount[tx.accountId] || 0) + delta
    }
  }

  // Clasificar: CASH = Efectivo, BANK/WALLET/otro = Virtual
  const efectivoAccounts: CajasAccountItem[] = []
  const virtualAccounts: CajasAccountItem[] = []

  for (const acc of accounts) {
    const item: CajasAccountItem = {
      id: acc.id,
      name: acc.name,
      type: acc.type,
      currency: acc.currency,
      currentBalance: acc.currentBalance,
      recentMovements: movCountByAccount[acc.id] || 0,
      todayVariation: todayVarByAccount[acc.id] || 0,
    }
    if (acc.type === 'CASH') {
      efectivoAccounts.push(item)
    } else {
      virtualAccounts.push(item)
    }
  }

  const totalEfectivo = efectivoAccounts.reduce((s, a) => s + a.currentBalance, 0)
  const totalVirtual = virtualAccounts.reduce((s, a) => s + a.currentBalance, 0)
  const todayVarEfectivo = efectivoAccounts.reduce((s, a) => s + a.todayVariation, 0)
  const todayVarVirtual = virtualAccounts.reduce((s, a) => s + a.todayVariation, 0)

  // Calcular resumen comparativo (últimos 30 días vs 30 días anteriores)
  const hace30dias = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const hace60dias = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  const tx30 = await prisma.transaction.findMany({
    where: { businessId, date: { gte: hace60dias } },
    select: { amount: true, type: true, date: true },
  })

  let incomeActual = 0, incomePrev = 0

  for (const tx of tx30) {
    if (tx.type === 'INCOME') {
      if (tx.date >= hace30dias) incomeActual += tx.amount
      else incomePrev += tx.amount
    }
  }

  const growth = incomePrev > 0 ? ((incomeActual - incomePrev) / incomePrev) * 100 : 0
  const totalGeneral = totalEfectivo + totalVirtual
  const summaryMessage = growth !== 0
    ? `Tus cajas suman $${totalGeneral.toLocaleString('es-AR')} en total. Tus ingresos ${growth >= 0 ? 'crecieron' : 'bajaron'} un ${Math.abs(growth).toFixed(1)}% respecto al mes anterior.`
    : `Tus cajas suman $${totalGeneral.toLocaleString('es-AR')} en total.`

  // Consejos IA (placeholder inteligentes basados en datos)
  const aiTipEfectivo = efectivoAccounts.length === 0
    ? 'No tenés cajas de efectivo registradas. Creá una para empezar a trackear tus movimientos físicos.'
    : todayVarEfectivo > 0
      ? `Hoy ingresaron $${todayVarEfectivo.toLocaleString('es-AR')} en efectivo. Buen día de caja.`
      : todayVarEfectivo < 0
        ? `Hoy salieron $${Math.abs(todayVarEfectivo).toLocaleString('es-AR')} en efectivo. Revisá si hay gastos no planificados.`
        : 'Sin movimientos de efectivo hoy. Todo estable.'

  const aiTipVirtual = virtualAccounts.length === 0
    ? 'No tenés cuentas virtuales registradas. Agregá tus bancos y billeteras digitales.'
    : todayVarVirtual > 0
      ? `Hoy ingresaron $${todayVarVirtual.toLocaleString('es-AR')} en cuentas virtuales.`
      : todayVarVirtual < 0
        ? `Hoy salieron $${Math.abs(todayVarVirtual).toLocaleString('es-AR')} de cuentas virtuales.`
        : 'Sin movimientos virtuales hoy.'

  return {
    efectivo: { accounts: efectivoAccounts, total: totalEfectivo, todayVariation: todayVarEfectivo },
    virtual: { accounts: virtualAccounts, total: totalVirtual, todayVariation: todayVarVirtual },
    summaryMessage,
    aiTipEfectivo,
    aiTipVirtual,
  }
}

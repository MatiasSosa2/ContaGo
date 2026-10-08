/**
 * Catálogos del negocio: cajas, contactos, categorías y subcategorías, áreas, empleados y lo que usa el formulario del "+".
 * Las expone src/app/actions.ts (que elige entre datos reales y demo).
 */

import prisma from '@/lib/prisma'
import { revalidatePath, updateTag, unstable_cache } from 'next/cache'
import { createContactSchema, createCategorySchema, createSubcategorySchema, createAccountSchema, updateAccountSchema, createAreaNegocioSchema, type ActionResult } from '@/lib/validations'
import { createContableAccountForCategory } from '@/server/accounting/setup-contable-accounts'
import { CASH_ACCOUNT_TYPES } from '@/server/cash/cash-flow'
import { getBusinessId } from './shared'

// Cacheado por business + select acotado para reducir payload Turso (latencia remota).
export async function getModalCatalogs() {
  const businessId = await getBusinessId()
  const cached = unstable_cache(
    async (bid: string) => {
      const [accounts, categories, subcategories, contacts, areas, productos, empleados, bienesDeUso, business] = await Promise.all([
        prisma.account.findMany({
          // Solo cajas propias: las cuentas contables del sistema no se eligen en formularios
          where: { businessId: bid, isSystemAccount: false, type: { in: [...CASH_ACCOUNT_TYPES] } },
          select: { id: true, name: true, currency: true, type: true },
          orderBy: { name: 'asc' },
        }),
        prisma.category.findMany({
          where: { businessId: bid },
          select: { id: true, name: true, type: true },
        }),
        prisma.subcategory.findMany({
          where: { businessId: bid },
          select: { id: true, name: true, categoryId: true },
          orderBy: { name: 'asc' },
        }),
        prisma.contact.findMany({
          where: { businessId: bid },
          select: { id: true, name: true, type: true },
          orderBy: { name: 'asc' },
        }),
        prisma.areaNegocio.findMany({
          where: { businessId: bid },
          select: { id: true, nombre: true },
          orderBy: { nombre: 'asc' },
        }),
        prisma.producto.findMany({
          where: { businessId: bid, activo: true },
          select: {
            id: true, nombre: true, categoria: true, marca: true,
            precioVenta: true, precioCosto: true, stockActual: true, tipo: true,
          },
          orderBy: { nombre: 'asc' },
        }),
        prisma.empleado.findMany({
          where: { businessId: bid, activo: true },
          select: { id: true, nombre: true, cargo: true },
          orderBy: { nombre: 'asc' },
        }),
        prisma.bienDeUso.findMany({
          where: { businessId: bid, activo: true },
          select: { id: true, nombre: true, categoria: true, marca: true, valorAdquisicion: true, depreciacionAcumulada: true },
          orderBy: { nombre: 'asc' },
        }),
        prisma.business.findUnique({
          where: { id: bid },
          select: { operatingModel: true },
        }),
      ])
      return {
        accounts, categories, subcategories, contacts, areas, productos, empleados, bienesDeUso,
        operatingModel: business?.operatingModel ?? 'BOTH',
      }
    },
    ['modal-catalogs'],
    { tags: [`dashboard:${businessId}`, `catalogs:${businessId}`], revalidate: 300 },
  )
  return cached(businessId)
}

/** Para comparar nombres sin importar mayúsculas, acentos ni espacios de más */
const normalizarNombre = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Alta rápida de cliente o proveedor desde el registro (solo el nombre). Si ya existe uno
 * con el mismo nombre (sin importar mayúsculas ni acentos) devuelve ese, así no se duplican.
 */
export async function createContact(formData: FormData): Promise<ActionResult<{ id: string; name: string; type: string }>> {
  const parsed = createContactSchema.safeParse({
    name: ((formData.get('name') as string) || '').replace(/\s+/g, ' ').trim(),
    type: formData.get('type') as string,
  })
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { name, type } = parsed.data

  const businessId = await getBusinessId()
  const mismos = await prisma.contact.findMany({ where: { businessId, type }, select: { id: true, name: true, type: true } })
  const existente = mismos.find((c) => normalizarNombre(c.name) === normalizarNombre(name))
  if (existente) return { success: true, data: existente }

  const creado = await prisma.contact.create({
    data: { name, type, businessId },
    select: { id: true, name: true, type: true },
  })
  updateTag(`catalogs:${businessId}`)
  revalidatePath('/creditos')
  return { success: true, data: creado }
}

export async function createCategory(formData: FormData): Promise<ActionResult> {
  const raw = {
    name: (formData.get('name') as string)?.trim(),
    type: formData.get('type') as string,
  }

  const parsed = createCategorySchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const businessId = await getBusinessId(true)
  await prisma.$transaction(async (tx) => {
    const category = await tx.category.create({ data: { ...parsed.data, businessId } })
    await createContableAccountForCategory(category.id, category.name, category.type, businessId, tx)
  })

  revalidatePath('/')
  return { success: true }
}

export async function deleteCategory(id: string) {
  const businessId = await getBusinessId(true)
  await prisma.$transaction(async (tx) => {
    await tx.transaction.updateMany({
      where: { categoryId: id, businessId },
      data: { categoryId: null },
    })
    await tx.category.deleteMany({ where: { id, businessId } })
  })
  updateTag(`catalogs:${businessId}`)
  revalidatePath('/')
}

// ---- Cambio de caja / Diferencia de caja ----

export async function createSubcategory(formData: FormData): Promise<ActionResult<{ id: string; name: string; categoryId: string }>> {
  const parsed = createSubcategorySchema.safeParse({
    name: (formData.get('name') as string)?.trim(),
    categoryId: formData.get('categoryId') as string,
  })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }
  const businessId = await getBusinessId(true)
  const category = await prisma.category.findFirst({
    where: { id: parsed.data.categoryId, businessId },
    select: { id: true },
  })
  if (!category) return { success: false, error: 'La categoría no existe' }

  const created = await prisma.subcategory.create({
    data: { name: parsed.data.name, categoryId: category.id, businessId },
    select: { id: true, name: true, categoryId: true },
  })
  updateTag(`catalogs:${businessId}`)
  revalidatePath('/')
  return { success: true, data: created }
}

export async function deleteSubcategory(id: string) {
  const businessId = await getBusinessId(true)
  // Los movimientos conservan la categoría padre y quedan sin subcategoría (onDelete: SetNull)
  await prisma.subcategory.deleteMany({ where: { id, businessId } })
  updateTag(`catalogs:${businessId}`)
  revalidatePath('/')
}

// ---- Créditos y Deudas ----

export async function createCategoryWithContable(formData: FormData): Promise<ActionResult<{ id: string; name: string }>> {
  const raw = {
    name: (formData.get('name') as string)?.trim(),
    type: (formData.get('type') as string) || 'INCOME',
  }
  const parsed = createCategorySchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }
  const businessId = await getBusinessId(true)
  const created = await prisma.$transaction(async (tx) => {
    const category = await tx.category.create({
      data: { name: parsed.data.name, type: parsed.data.type, businessId },
      select: { id: true, name: true },
    })
    await createContableAccountForCategory(category.id, category.name, parsed.data.type, businessId, tx)
    return category
  })
  updateTag(`catalogs:${businessId}`)
  revalidatePath('/')
  return { success: true, data: created }
}


export async function getEmpleados() {
  const businessId = await getBusinessId()
  return await prisma.empleado.findMany({
    where: { businessId, activo: true },
    orderBy: { nombre: 'asc' },
  })
}


export async function updateCategory(id: string, formData: FormData): Promise<ActionResult> {
  const businessId = await getBusinessId(true)
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


export async function deleteAreaNegocio(id: string) {
  const businessId = await getBusinessId(true)
  await prisma.$transaction(async (tx) => {
    await tx.transaction.updateMany({
      where: { areaNegocioId: id, businessId },
      data: { areaNegocioId: null },
    })
    await tx.areaNegocio.deleteMany({ where: { id, businessId } })
  })
  revalidatePath('/')
}


export async function updateAreaNegocio(id: string, formData: FormData): Promise<ActionResult> {
  const businessId = await getBusinessId(true)
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


export async function createAreaNegocio(formData: FormData): Promise<ActionResult> {
  const businessId = await getBusinessId(true)
  const raw = {
    nombre: (formData.get('nombre') as string)?.trim(),
    descripcion: (formData.get('descripcion') as string)?.trim(),
  }

  const parsed = createAreaNegocioSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  try {
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


export async function deleteAccount(id: string): Promise<ActionResult> {
  const businessId = await getBusinessId(true)
  const result = await prisma.$transaction(async (tx) => {
    const account = await tx.account.findFirst({
      where: { id, businessId, isSystemAccount: false },
      select: { id: true, currentBalance: true },
    })
    if (!account) return { success: false as const, error: 'La cuenta no existe o no pertenece al negocio activo' }
    if (Math.abs(account.currentBalance) > 0.001) {
      return { success: false as const, error: 'No se puede eliminar una cuenta con saldo distinto de cero' }
    }

    const [txCount, transferCount, journalLineCount] = await Promise.all([
      tx.transaction.count({ where: { accountId: id, businessId } }),
      tx.cashTransfer.count({ where: { businessId, OR: [{ fromAccountId: id }, { toAccountId: id }] } }),
      tx.journalLine.count({ where: { accountId: id, journalEntry: { businessId } } }),
    ])
    if (txCount > 0 || transferCount > 0 || journalLineCount > 0) {
      return { success: false as const, error: 'No se puede eliminar una cuenta con movimientos, transferencias o asientos asociados' }
    }

    const deleted = await tx.account.deleteMany({ where: { id, businessId, isSystemAccount: false } })
    if (deleted.count === 0) {
      return { success: false as const, error: 'La cuenta no existe o no pertenece al negocio activo' }
    }
    return { success: true as const }
  })
  if (!result.success) return result
  revalidatePath('/')
  return { success: true }
}


export async function updateAccount(id: string, formData: FormData): Promise<ActionResult> {
  const businessId = await getBusinessId(true)
  const raw = { name: (formData.get('name') as string)?.trim() }

  const parsed = updateAccountSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const result = await prisma.account.updateMany({
    where: { id, businessId, isSystemAccount: false },
    data: { name: parsed.data.name }
  })

  if (result.count === 0) {
    return { success: false, error: 'La cuenta no existe o no pertenece al negocio activo' }
  }

  revalidatePath('/')
  return { success: true }
}


export async function deleteContact(id: string) {
  const businessId = await getBusinessId(true)
  await prisma.$transaction(async (tx) => {
    await tx.transaction.updateMany({
      where: { contactId: id, businessId },
      data: { contactId: null },
    })
    await tx.contact.deleteMany({ where: { id, businessId } })
  })
  revalidatePath('/')
}


export async function updateContact(id: string, formData: FormData): Promise<ActionResult> {
  const businessId = await getBusinessId(true)
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


export async function createAccount(formData: FormData): Promise<ActionResult> {
  const parsed = createAccountSchema.safeParse({
    name: (formData.get('name') as string)?.trim(),
    type: (formData.get('type') as string) || 'CASH',
    currency: (formData.get('currency') as string) || 'ARS',
  })
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const businessId = await getBusinessId(true)
  await prisma.account.create({
    data: {
      ...parsed.data,
      currentBalance: 0,
      contableType: 'ASSET',
      subtype: parsed.data.type === 'CASH' ? 'CASH' : 'BANK',
      businessId,
    },
  })

  revalidatePath('/')
  return { success: true }
}


export async function getContacts() {
  const businessId = await getBusinessId()
  return await prisma.contact.findMany({
    where: { businessId },
    orderBy: { name: 'asc' }
  })
}


export async function getAreasNegocio() {
  const businessId = await getBusinessId()
  return await prisma.areaNegocio.findMany({
    where: { businessId },
    orderBy: { nombre: 'asc' }
  })
}


export async function getCategories() {
  const businessId = await getBusinessId()
  return await prisma.category.findMany({
    where: { businessId },
  })
}


export async function getAccounts() {
  const businessId = await getBusinessId()
  return await prisma.account.findMany({
    where: { businessId },
  })
}

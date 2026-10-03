/**
 * Catálogos del negocio: cajas, contactos, categorías y subcategorías, áreas, empleados y lo que usa el formulario del "+".
 * Las expone src/app/actions.ts (que elige entre datos reales y demo).
 */

import prisma from '@/lib/prisma'
import { revalidatePath, updateTag, unstable_cache } from 'next/cache'
import { createContactSchema, createCategorySchema, createSubcategorySchema, type ActionResult } from '@/lib/validations'
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

export async function deleteCategory(id: string) {
  const businessId = await getBusinessId()
  // Desvincula transacciones
  await prisma.transaction.updateMany({
    where: { categoryId: id, businessId },
    data: { categoryId: null }
  })
  await prisma.category.deleteMany({ where: { id, businessId } })
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
  const businessId = await getBusinessId()
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
  const businessId = await getBusinessId()
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
  const businessId = await getBusinessId()
  const created = await prisma.category.create({
    data: { name: parsed.data.name, type: parsed.data.type, businessId },
    select: { id: true, name: true },
  })
  await createContableAccountForCategory(created.id, created.name, parsed.data.type, businessId, prisma as never)
  updateTag(`catalogs:${businessId}`)
  revalidatePath('/')
  return { success: true, data: created }
}

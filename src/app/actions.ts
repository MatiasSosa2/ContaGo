'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import {
  createTransactionSchema,
  createAccountSchema,
  updateAccountSchema,
  createContactSchema,
  createCategorySchema,
  createAreaNegocioSchema,
  createProductoSchema,
  createMovimientoStockSchema,
  createBienDeUsoSchema,
  type ActionResult,
} from '@/lib/validations'

async function ensureDefaults() {
  // La inicialización automática global ya no es válida con multi-tenancy.
  // Los datos por defecto se deben crear al crear un nuevo Business.
  return;
}

// Helper temporal para obtener el contexto de negocio
// TODO: Reemplazar por obtención real desde sesión de usuario
async function getBusinessId() {
  // Intentamos obtener el primer negocio disponible
  const business = await prisma.business.findFirst()
  
  if (business) return business.id

  // Si no hay negocios, creamos uno por defecto (Demo) para que la app funcione
  const newBusiness = await prisma.business.create({
    data: {
      name: 'Empresa Demo',
      currency: 'ARS'
    }
  })
  return newBusiness.id
}

export async function getAccounts() {
  // await ensureDefaults() // Eliminado temporalmente
  return await prisma.account.findMany() // TODO: Filtrar por businessId
}

export async function getCategories() {
  // await ensureDefaults() // Eliminado temporalmente
  return await prisma.category.findMany() // TODO: Filtrar por businessId
}

export async function getTransactions() {
  return await prisma.transaction.findMany({
    orderBy: { date: 'desc' },
    include: { category: true, account: true, contact: true, areaNegocio: true },
    take: 100
  })
}

export async function getAreasNegocio() {
  return await prisma.areaNegocio.findMany({
    orderBy: { nombre: 'asc' }
  })
}

export async function getContacts() {
  return await prisma.contact.findMany({
    orderBy: { name: 'asc' }
  })
}

export async function createContact(formData: FormData): Promise<ActionResult> {
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
  // TODO: Implementar con Auth (businessId)
  return { success: false, error: "Función deshabilitada temporalmente hasta configurar Auth." }
  /*
  const esCreditoRaw = formData.get('esCredito') as string
  const raw = {
    amount: parseFloat(formData.get('amount') as string),
    description: (formData.get('description') as string)?.trim(),
    type: formData.get('type') as string,
    accountId: formData.get('accountId') as string,
    categoryId: formData.get('categoryId') as string,
    contactId: formData.get('contactId') as string,
    areaNegocioId: formData.get('areaNegocioId') as string,
    date: formData.get('date') as string,
    currency: formData.get('currency') as string || 'ARS',
    esCredito: esCreditoRaw === 'true' || esCreditoRaw === '1',
    estado: (formData.get('estado') as string) || 'COBRADO',
    fechaVencimiento: (formData.get('fechaVencimiento') as string) || undefined,
  }

  const parsed = createTransactionSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { amount, description, type, accountId, categoryId, contactId, areaNegocioId, date: dateStr, currency, esCredito, estado, fechaVencimiento } = parsed.data
  const date = dateStr ? new Date(dateStr) : new Date()
  const fVenc = fechaVencimiento ? new Date(fechaVencimiento) : null

  await prisma.transaction.create({
    data: {
      amount,
      description,
      type,
      date,
      currency,
      esCredito,
      estado: esCredito ? estado : (type === 'INCOME' ? 'COBRADO' : 'PAGADO'),
      fechaVencimiento: fVenc,
      account: { connect: { id: accountId } },
      category: categoryId && categoryId !== "" ? { connect: { id: categoryId } } : undefined,
      contact: contactId && contactId !== "" ? { connect: { id: contactId } } : undefined,
      areaNegocio: areaNegocioId && areaNegocioId !== "" ? { connect: { id: areaNegocioId } } : undefined,
    },
  })

  // Update account balance
  const account = await prisma.account.findUnique({ where: { id: accountId } })
  if (account) {
    const balanceChange = type === 'INCOME' ? amount : -amount
    await prisma.account.update({
      where: { id: accountId },
      data: { currentBalance: account.currentBalance + balanceChange }
    })
  }

  // Si es un bien de uso: crear el registro de activo fijo
  const esBienDeUso = formData.get('esBienDeUso') === 'true'
  if (type === 'EXPENSE' && esBienDeUso) {
    const bienCategoria = (formData.get('bienCategoria') as string) || 'OTRO'
    const bienVidaUtil = parseInt(formData.get('bienVidaUtil') as string) || 60
    const bienValorResidual = parseFloat(formData.get('bienValorResidual') as string) || 0
    await prisma.bienDeUso.create({
      data: {
        nombre: description,
        categoria: bienCategoria,
        fechaCompra: date,
        valorCompra: amount,
        currency,
        vidaUtilMeses: bienVidaUtil,
        valorResidual: bienValorResidual,
        estado: 'EN_USO',
      },
    })
    revalidatePath('/bienes')
  }

  revalidatePath('/')
  return { success: true }
  */
}

export async function deleteTransaction(id: string) {
  const transaction = await prisma.transaction.findUnique({ where: { id } })
  if (!transaction) return

  // Revert balance
  const account = await prisma.account.findUnique({ where: { id: transaction.accountId } })
  if (account) {
    // Si era INGRESO, RESTAMOS al saldo. Si era EGRESO, SUMAMOS al saldo.
    const balanceChange = transaction.type === 'INCOME' ? -transaction.amount : transaction.amount
    await prisma.account.update({
      where: { id: transaction.accountId },
      data: { currentBalance: account.currentBalance + balanceChange }
    })
  }

  await prisma.transaction.delete({ where: { id } })
  revalidatePath('/')
}

export async function createAccount(formData: FormData): Promise<ActionResult> {
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
  return await prisma.transaction.findMany({
    orderBy: { date: 'desc' },
    include: { category: true, account: true, contact: true, areaNegocio: true },
  })
}

export type DateRange = { from?: Date; to?: Date }

export async function getReportData(range?: DateRange) {
  const dateFilter = range?.from || range?.to
    ? { date: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } }
    : {}
  const allTx = await prisma.transaction.findMany({
    where: dateFilter,
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
  const accounts = await prisma.account.findMany()
  const accountTotalByCurrency = accounts.reduce((acc, a) => {
    const c = a.currency || 'ARS'
    acc[c] = (acc[c] || 0) + a.currentBalance
    return acc
  }, {} as Record<string, number>)

  return { allTx, totalsByCurrency, monthlyHistory, topCategories, topContacts, topAreas, accountTotalByCurrency }
}

export async function getMonthlyStats() {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  
  const transactions = await prisma.transaction.findMany({
    where: { date: { gte: firstDay, lte: lastDay } }
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
    where: { date: { gte: monday, lte: sunday } }
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

  await prisma.contact.update({
    where: { id },
    data: { name, type, phone: phone || null, email: email || null }
  })
  revalidatePath('/')
  return { success: true }
}

export async function deleteContact(id: string) {
  // Desvincula transacciones antes de eliminar
  await prisma.transaction.updateMany({
    where: { contactId: id },
    data: { contactId: null }
  })
  await prisma.contact.delete({ where: { id } })
  revalidatePath('/')
}

// ---- Account CRUD ----

export async function updateAccount(id: string, formData: FormData): Promise<ActionResult> {
  const raw = { name: (formData.get('name') as string)?.trim() }

  const parsed = updateAccountSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  await prisma.account.update({
    where: { id },
    data: { name: parsed.data.name }
  })
  revalidatePath('/')
  return { success: true }
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  const txCount = await prisma.transaction.count({ where: { accountId: id } })
  if (txCount > 0) {
    return { success: false, error: 'No se puede eliminar una cuenta con transacciones asociadas' }
  }
  await prisma.account.delete({ where: { id } })
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
  const raw = {
    nombre: (formData.get('nombre') as string)?.trim(),
    descripcion: (formData.get('descripcion') as string)?.trim(),
  }

  const parsed = createAreaNegocioSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  try {
    await prisma.areaNegocio.update({
      where: { id },
      data: { nombre: parsed.data.nombre, descripcion: parsed.data.descripcion || null }
    })
  } catch {
    return { success: false, error: 'Ya existe un área con ese nombre' }
  }

  revalidatePath('/')
  return { success: true }
}

export async function deleteAreaNegocio(id: string) {
  await prisma.transaction.updateMany({
    where: { areaNegocioId: id },
    data: { areaNegocioId: null }
  })
  await prisma.areaNegocio.delete({ where: { id } })
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
  await prisma.category.create({ 
    data: {
      ...parsed.data,
      businessId,
    } 
  })
  revalidatePath('/')
  return { success: true }
}

export async function updateCategory(id: string, formData: FormData): Promise<ActionResult> {
  const raw = {
    name: (formData.get('name') as string)?.trim(),
    type: formData.get('type') as string,
  }

  const parsed = createCategorySchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  await prisma.category.update({ where: { id }, data: parsed.data })
  revalidatePath('/')
  return { success: true }
}

export async function deleteCategory(id: string) {
  // Desvincula transacciones
  await prisma.transaction.updateMany({
    where: { categoryId: id },
    data: { categoryId: null }
  })
  await prisma.category.delete({ where: { id } })
  revalidatePath('/')
}

// ---- Créditos y Deudas ----

export async function getCreditosDeudas() {
  return await prisma.transaction.findMany({
    where: { esCredito: true },
    orderBy: [{ estado: 'asc' }, { fechaVencimiento: 'asc' }],
    include: { contact: true, category: true, account: true, areaNegocio: true },
  })
}

export async function marcarEstadoCredito(id: string, estado: string): Promise<ActionResult> {
  const valid = ['COBRADO', 'PAGADO', 'PENDIENTE', 'VENCIDO']
  if (!valid.includes(estado)) return { success: false, error: 'Estado inválido' }
  await prisma.transaction.update({ where: { id }, data: { estado } })
  revalidatePath('/')
  revalidatePath('/creditos')
  return { success: true }
}

// ---- Stock: Productos ----

export async function getProductos() {
  return await prisma.producto.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
    include: { movimientos: { orderBy: { fecha: 'desc' }, take: 5 } },
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

  await prisma.producto.update({ where: { id }, data: {
    ...parsed.data,
    descripcion: parsed.data.descripcion || null,
    categoria: parsed.data.categoria || null,
    marca: parsed.data.marca || null,
  }})
  revalidatePath('/stock')
  return { success: true }
}

export async function deleteProducto(id: string) {
  await prisma.producto.update({ where: { id }, data: { activo: false } })
  revalidatePath('/stock')
}

// ---- Stock: Movimientos ----

export async function addMovimientoStock(formData: FormData): Promise<ActionResult> {
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

  await prisma.movimientoStock.create({
    data: { productoId, tipo, cantidad, precio, motivo: motivo || null, fecha },
  })

  // Actualizar stockActual
  const producto = await prisma.producto.findUnique({ where: { id: productoId } })
  if (producto) {
    const delta = tipo === 'ENTRADA' ? cantidad : tipo === 'SALIDA' ? -cantidad : 0
    const nuevoStock = tipo === 'AJUSTE' ? cantidad : producto.stockActual + delta
    await prisma.producto.update({ where: { id: productoId }, data: { stockActual: nuevoStock } })
  }

  revalidatePath('/stock')
  return { success: true }
}

export async function getMovimientosStock(productoId: string) {
  return await prisma.movimientoStock.findMany({
    where: { productoId },
    orderBy: { fecha: 'desc' },
    take: 50,
  })
}

// ---- Reportes: datos extendidos ----

export async function getReportDataExtended(range?: DateRange) {
  const base = await getReportData(range)
  
  // Estado Patrimonial: cuentas como activos, créditos PENDIENTE como pasivos
  const cuentas = await prisma.account.findMany()
  const creditosPendientes = await prisma.transaction.findMany({
    where: { esCredito: true, estado: { in: ['PENDIENTE', 'VENCIDO'] } },
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
  const operativoKeywords = ['venta', 'compra', 'sueldo', 'servicio', 'alquiler', 'cobro', 'pago', 'impuesto']
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
  const salidasStock = await prisma.movimientoStock.findMany({ where: { tipo: 'SALIDA' } })
  const cmvTotal = salidasStock.reduce((acc, m) => acc + m.cantidad * m.precio, 0)

  // Stock: inventario actual
  const productosActivos = await prisma.producto.findMany({ where: { activo: true } })
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
  const now = new Date()
  const inicioHoy = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const finHoy = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  const txHoy = await prisma.transaction.findMany({
    where: { date: { gte: inicioHoy, lte: finHoy } },
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

// ---- Bienes de Uso ----

export async function getBienesDeUso() {
  return await prisma.bienDeUso.findMany({
    where: { activo: true },
    orderBy: { fechaCompra: 'desc' },
  })
}

export async function createBienDeUso(formData: FormData): Promise<ActionResult> {
  const raw = {
    nombre: (formData.get('nombre') as string)?.trim(),
    descripcion: (formData.get('descripcion') as string)?.trim(),
    categoria: formData.get('categoria') as string,
    fechaCompra: formData.get('fechaCompra') as string,
    valorCompra: parseFloat(formData.get('valorCompra') as string),
    currency: (formData.get('currency') as string) || 'ARS',
    vidaUtilMeses: parseInt(formData.get('vidaUtilMeses') as string) || 60,
    valorResidual: parseFloat(formData.get('valorResidual') as string) || 0,
    estado: (formData.get('estado') as string) || 'EN_USO',
    notas: (formData.get('notas') as string)?.trim(),
  }
  const accountId = (formData.get('accountId') as string)?.trim() || ''

  const parsed = createBienDeUsoSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const businessId = await getBusinessId()

  const { fechaCompra, descripcion, notas, nombre, valorCompra, currency, ...rest } = parsed.data
  const fechaDate = new Date(fechaCompra)

  await prisma.bienDeUso.create({
    data: {
      ...rest,
      nombre,
      valorCompra,
      currency,
      fechaCompra: fechaDate,
      descripcion: descripcion || null,
      notas: notas || null,
      businessId,
    },
  })

  // Si se seleccionó una cuenta: crear el movimiento de egreso y descontar saldo
  if (accountId) {
    const account = await prisma.account.findUnique({ where: { id: accountId } })
    if (!account) return { success: false, error: 'La cuenta seleccionada no existe' }

    // Buscar o crear categoría "Bienes de Uso"
    let cat = await prisma.category.findFirst({ where: { name: 'Bienes de Uso', type: 'EXPENSE' } })
    if (!cat) {
      cat = await prisma.category.create({ 
        data: { 
          name: 'Bienes de Uso', 
          type: 'EXPENSE',
          business: { connect: { id: businessId } },
        } 
      })
    }

    await prisma.transaction.create({
      data: {
        amount: valorCompra,
        description: `Compra de bien: ${nombre}`,
        type: 'EXPENSE',
        date: fechaDate,
        currency,
        esCredito: false,
        estado: 'PAGADO',
        account: { connect: { id: accountId } },
        category: { connect: { id: cat.id } },
        business: { connect: { id: businessId } },
      },
    })

    await prisma.account.update({
      where: { id: accountId },
      data: { currentBalance: account.currentBalance - valorCompra },
    })

    revalidatePath('/')
  }

  revalidatePath('/bienes')
  return { success: true }
}

export async function updateBienDeUso(id: string, formData: FormData): Promise<ActionResult> {
  const raw = {
    nombre: (formData.get('nombre') as string)?.trim(),
    descripcion: (formData.get('descripcion') as string)?.trim(),
    categoria: formData.get('categoria') as string,
    fechaCompra: formData.get('fechaCompra') as string,
    valorCompra: parseFloat(formData.get('valorCompra') as string),
    currency: (formData.get('currency') as string) || 'ARS',
    vidaUtilMeses: parseInt(formData.get('vidaUtilMeses') as string) || 60,
    valorResidual: parseFloat(formData.get('valorResidual') as string) || 0,
    estado: (formData.get('estado') as string) || 'EN_USO',
    notas: (formData.get('notas') as string)?.trim(),
  }

  const parsed = createBienDeUsoSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const { fechaCompra, descripcion, notas, ...rest } = parsed.data
  await prisma.bienDeUso.update({
    where: { id },
    data: {
      ...rest,
      fechaCompra: new Date(fechaCompra),
      descripcion: descripcion || null,
      notas: notas || null,
    },
  })
  revalidatePath('/bienes')
  return { success: true }
}

export async function deleteBienDeUso(id: string) {
  await prisma.bienDeUso.update({ where: { id }, data: { activo: false } })
  revalidatePath('/bienes')
}

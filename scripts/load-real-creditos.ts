import fs from 'node:fs'
import path from 'node:path'

function loadEnvFromFile(fileName: string) {
  const filePath = path.join(process.cwd(), fileName)
  if (!fs.existsSync(filePath)) return false

  const content = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) continue

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim().replace(/^"|"$/g, '')
    if (!process.env[key]) process.env[key] = value
  }

  return true
}

function addDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

async function main() {
  loadEnvFromFile('.env.local') || loadEnvFromFile('.env')

  const { default: prisma } = await import('../src/lib/prisma')
  const { requireTargetBusinessId } = await import('./target-business')
  const { generateJournalLines } = await import('../src/server/accounting/journal-engine')
  const targetBusinessId = requireTargetBusinessId()

  const business = await prisma.business.findUnique({
    where: { id: targetBusinessId },
    select: { id: true, name: true },
  })

  if (!business) {
    throw new Error(`No existe el negocio ${targetBusinessId} en la base actual.`)
  }

  const [accounts, contacts, categories] = await Promise.all([
    prisma.account.findMany({
      where: { businessId: business.id, isSystemAccount: false, type: { in: ['CASH', 'BANK', 'WALLET'] }, currency: 'ARS' },
      select: { id: true, name: true, currency: true, type: true },
      orderBy: { name: 'asc' },
    }),
    prisma.contact.findMany({
      where: { businessId: business.id },
      select: { id: true, name: true, type: true },
      orderBy: { name: 'asc' },
    }),
    prisma.category.findMany({
      where: { businessId: business.id },
      select: { id: true, type: true, contableAccountId: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const arsAccount = accounts[0]
  if (!arsAccount) {
    throw new Error('No hay cajas físicas en ARS para importar los créditos.')
  }
  const [cxc, cxp] = await Promise.all([
    prisma.account.findFirst({ where: { businessId: business.id, isSystemAccount: true, subtype: 'RECEIVABLE' }, select: { id: true } }),
    prisma.account.findFirst({ where: { businessId: business.id, isSystemAccount: true, subtype: 'PAYABLE' }, select: { id: true } }),
  ])
  if (!cxc || !cxp) throw new Error('Faltan las cuentas contables de CxC/CxP del negocio.')

  const incomeCategory = categories.find(category => category.type === 'INCOME')
  const expenseCategory = categories.find(category => category.type === 'EXPENSE')

  const getContactId = (name: string, type: string) => {
    const contact = contacts.find(item => item.name === name && item.type === type)
    if (!contact) throw new Error(`No se encontro el contacto ${name} (${type}).`)
    return contact.id
  }

  const records = [
    {
      description: 'CxC real - Grupo Meridian marzo',
      amount: 480000,
      type: 'INCOME',
      estado: 'PENDIENTE',
      fechaVencimiento: addDays(7),
      contactId: getContactId('Grupo Meridian S.A.', 'CLIENT'),
      categoryId: incomeCategory?.id ?? null,
    },
    {
      description: 'CxC real - Estudio Contable Perez abril',
      amount: 265000,
      type: 'INCOME',
      estado: 'PENDIENTE',
      fechaVencimiento: addDays(12),
      contactId: getContactId('Estudio Contable Pérez', 'CLIENT'),
      categoryId: incomeCategory?.id ?? null,
    },
    {
      description: 'CxC real - Lopez y Asociados seguimiento',
      amount: 390000,
      type: 'INCOME',
      estado: 'PENDIENTE',
      fechaVencimiento: addDays(18),
      contactId: getContactId('López & Asociados', 'CLIENT'),
      categoryId: incomeCategory?.id ?? null,
    },
    {
      description: 'CxC real - Farmacia El Sol convenio',
      amount: 175000,
      type: 'INCOME',
      estado: 'PENDIENTE',
      fechaVencimiento: addDays(25),
      contactId: getContactId('Farmacia El Sol', 'CLIENT'),
      categoryId: incomeCategory?.id ?? null,
    },
    {
      description: 'CxP real - Servicios Tech SRL licencias',
      amount: 210000,
      type: 'EXPENSE',
      estado: 'PENDIENTE',
      fechaVencimiento: addDays(6),
      contactId: getContactId('Servicios Tech SRL', 'SUPPLIER'),
      categoryId: expenseCategory?.id ?? null,
    },
    {
      description: 'CxP real - Papelera Central insumos',
      amount: 98000,
      type: 'EXPENSE',
      estado: 'PENDIENTE',
      fechaVencimiento: addDays(10),
      contactId: getContactId('Papelera Central', 'SUPPLIER'),
      categoryId: expenseCategory?.id ?? null,
    },
    {
      description: 'CxP real - Imprenta Grafica Rapida impresion',
      amount: 143000,
      type: 'EXPENSE',
      estado: 'PENDIENTE',
      fechaVencimiento: addDays(15),
      contactId: getContactId('Imprenta Gráfica Rápida', 'SUPPLIER'),
      categoryId: expenseCategory?.id ?? null,
    },
    {
      description: 'CxP real - Distribuidora Norte reposicion',
      amount: 320000,
      type: 'EXPENSE',
      estado: 'PENDIENTE',
      fechaVencimiento: addDays(22),
      contactId: getContactId('Distribuidora Norte', 'SUPPLIER'),
      categoryId: expenseCategory?.id ?? null,
    },
  ]

  const created = await prisma.$transaction(async (tx) => {
    let inserted = 0
    for (const record of records) {
      const existing = await tx.transaction.findFirst({
        where: { businessId: business.id, description: record.description },
        select: {
          id: true,
          amount: true,
          type: true,
          date: true,
          accountId: true,
          categoryId: true,
          journalEntry: { select: { id: true } },
          account: { select: { isSystemAccount: true } },
        },
      })
      const categoryId = existing?.categoryId ?? record.categoryId
      const category = categories.find((item) => item.id === categoryId)
      const categoryAccountId = category?.contableAccountId ?? null
      const journal = generateJournalLines({
        amount: existing?.amount ?? record.amount,
        type: (existing?.type ?? record.type) as 'INCOME' | 'EXPENSE',
        esCredito: true,
        physicalAccountId: existing?.account.isSystemAccount ? arsAccount.id : existing?.accountId ?? arsAccount.id,
        categoryContableAccountId: categoryAccountId,
        cxcAccountId: cxc.id,
        cxpAccountId: cxp.id,
      })
      if (!journal.ok) throw new Error(`No se pudo generar el asiento de ${record.description}: ${journal.reason}`)

      const date = existing?.date ?? new Date()
      const transaction = existing
        ? await tx.transaction.update({
            where: { id: existing.id },
            data: { ...(existing.account.isSystemAccount ? { accountId: arsAccount.id } : {}) },
            select: { id: true },
          })
        : await tx.transaction.create({
            data: {
              description: record.description,
              amount: record.amount,
              currency: 'ARS',
              date,
              type: record.type,
              esCredito: true,
              estado: record.estado,
              fechaVencimiento: record.fechaVencimiento,
              businessId: business.id,
              accountId: arsAccount.id,
              contactId: record.contactId,
              categoryId: record.categoryId,
            },
            select: { id: true },
          })

      if (!existing?.journalEntry) {
        await tx.journalEntry.create({
          data: {
            date,
            description: record.description,
            transactionId: transaction.id,
            businessId: business.id,
            lines: { create: journal.lines },
          },
        })
      }
      if (!existing) inserted++
    }
    return inserted
  })

  const [pendingCxC, pendingCxP] = await Promise.all([
    prisma.transaction.count({
      where: { businessId: business.id, esCredito: true, type: 'INCOME', estado: 'PENDIENTE' },
    }),
    prisma.transaction.count({
      where: { businessId: business.id, esCredito: true, type: 'EXPENSE', estado: 'PENDIENTE' },
    }),
  ])

  console.log(
    JSON.stringify(
      {
        business: business.name,
        account: arsAccount.name,
        created,
        pendingCxC,
        pendingCxP,
      },
      null,
      2,
    ),
  )

  await prisma.$disconnect()
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
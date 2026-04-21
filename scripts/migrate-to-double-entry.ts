/**
 * migrate-to-double-entry.ts
 *
 * Script de migración retroactiva:
 * 1. Configura las cuentas contables del sistema para cada negocio existente
 * 2. Genera JournalEntry + JournalLine para todas las Transaction que no tienen asiento
 *
 * Idempotente: se puede correr múltiples veces sin duplicar datos.
 *
 * Uso:
 *   npx tsx scripts/migrate-to-double-entry.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { setupContableAccountsForBusiness } from '../src/server/accounting/setup-contable-accounts'
import { generateJournalLines } from '../src/server/accounting/journal-engine'

// Cargar .env manualmente (tsx no lo carga automáticamente en scripts)
import { config } from 'dotenv'
config()

function stripQuotes(val: string | undefined): string | undefined {
  return val?.replace(/^["']|["']$/g, '')
}

function buildClient() {
  const url = stripQuotes(process.env.TURSO_DATABASE_URL) || stripQuotes(process.env.DATABASE_URL)
  const authToken = stripQuotes(process.env.TURSO_AUTH_TOKEN)
  if (!url) throw new Error('No se encontró TURSO_DATABASE_URL ni DATABASE_URL en .env')
  const adapter = new PrismaLibSql(authToken ? { url, authToken } : { url })
  return new PrismaClient({ adapter } as any)
}

const prisma = buildClient()

async function main() {
  console.log('🔄 Iniciando migración a doble partida...\n')

  // ── PASO 1: Inicializar cuentas contables por negocio ──────────────────────
  const businesses = await prisma.business.findMany({ select: { id: true, name: true } })
  console.log(`📦 Negocios encontrados: ${businesses.length}`)

  for (const biz of businesses) {
    try {
      // Sin prisma.$transaction: evita el timeout de 5s de Turso en scripts largos
      await setupContableAccountsForBusiness(biz.id, prisma as any)
      console.log(`  ✅ ${biz.name} (${biz.id}) — cuentas contables configuradas`)
    } catch (err) {
      console.error(`  ❌ ${biz.name} (${biz.id}) — error al configurar cuentas:`, err)
    }
  }

  console.log()

  // ── PASO 2: Generar JournalEntry para Transaction sin asiento ──────────────
  const transactions = await prisma.transaction.findMany({
    where: { journalEntry: null },
    select: {
      id: true,
      amount: true,
      type: true,
      esCredito: true,
      date: true,
      description: true,
      accountId: true,
      categoryId: true,
      businessId: true,
    },
    orderBy: { date: 'asc' },
  })

  console.log(`📋 Transacciones sin asiento: ${transactions.length}`)
  let ok = 0
  let skipped = 0
  let failed = 0

  for (const txn of transactions) {
    try {
      // Obtener datos necesarios para el journal
      const [categoryWithContable, cxcAccount, cxpAccount] = await Promise.all([
        txn.categoryId
          ? prisma.category.findFirst({
              where: { id: txn.categoryId, businessId: txn.businessId },
              select: { contableAccountId: true },
            })
          : null,
        prisma.account.findFirst({
          where: { businessId: txn.businessId, isSystemAccount: true, subtype: 'RECEIVABLE' },
          select: { id: true },
        }),
        prisma.account.findFirst({
          where: { businessId: txn.businessId, isSystemAccount: true, subtype: 'PAYABLE' },
          select: { id: true },
        }),
      ])

      const journalResult = generateJournalLines({
        amount: txn.amount,
        type: txn.type as 'INCOME' | 'EXPENSE',
        esCredito: txn.esCredito,
        physicalAccountId: txn.accountId,
        categoryContableAccountId: categoryWithContable?.contableAccountId ?? null,
        cxcAccountId: cxcAccount?.id ?? null,
        cxpAccountId: cxpAccount?.id ?? null,
        description: txn.description,
      })

      if (!journalResult.ok) {
        skipped++
        console.log(`  ⚠️  Transacción ${txn.id} — sin asiento: ${journalResult.reason}`)
        continue
      }

      await prisma.journalEntry.create({
        data: {
          date: txn.date,
          description: txn.description,
          transactionId: txn.id,
          businessId: txn.businessId,
          lines: { create: journalResult.lines },
        },
      })
      ok++
    } catch (err) {
      failed++
      console.error(`  ❌ Transacción ${txn.id} — error:`, err)
    }
  }

  console.log(`\n📊 Resultado:`)
  console.log(`   ✅ Asientos creados:  ${ok}`)
  console.log(`   ⚠️  Saltados (sin cat): ${skipped}`)
  console.log(`   ❌ Errores:            ${failed}`)
  console.log('\n✅ Migración completada.')
}

main()
  .catch((e) => {
    console.error('Error fatal:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

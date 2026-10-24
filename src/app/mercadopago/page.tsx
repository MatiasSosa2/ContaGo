import Link from 'next/link'
import AppHeader from '@/components/AppHeader'
import prisma from '@/lib/prisma'
import { requireBusinessAdminContext } from '@/server/auth/require-business-context'
import { getConnection } from '@/server/mercadopago/connection'
import MercadoPagoPanel from './MercadoPagoPanel'

export const dynamic = 'force-dynamic'

const STATUS_MESSAGES: Record<string, string> = {
  connected: 'Cuenta de Mercado Pago vinculada.',
  denied: 'Cancelaste la autorización en Mercado Pago.',
  error: 'No se pudo vincular la cuenta de Mercado Pago. Intentalo de nuevo.',
}

function todayInArgentina(offsetDays = 0): string {
  const base = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(base)
}

export default async function MercadoPagoPage({
  searchParams,
}: {
  searchParams?: Promise<{ mp?: string }>
}) {
  const [sessionContext, sp] = await Promise.all([
    requireBusinessAdminContext(),
    searchParams ?? Promise.resolve<{ mp?: string }>({}),
  ])
  const businessId = sessionContext.activeBusiness!.id

  const [connection, pending, accounts, categories] = await Promise.all([
    getConnection(businessId),
    prisma.mercadoPagoPayment.findMany({
      where: { businessId, importStatus: 'PENDING' },
      orderBy: { dateApproved: 'asc' },
      take: 500,
    }),
    prisma.account.findMany({
      where: { businessId, isSystemAccount: false },
      select: { id: true, name: true, currency: true },
      orderBy: { name: 'asc' },
    }),
    prisma.category.findMany({
      where: { businessId, type: 'INCOME' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const statusMessage = sp?.mp ? STATUS_MESSAGES[sp.mp] : undefined

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <AppHeader title="Mercado Pago" sessionContext={sessionContext} />
      <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        <nav className="text-sm">
          <Link href="/" className="text-ds-green-600 hover:underline">← Volver al inicio</Link>
        </nav>

        {statusMessage && (
          <div className="rounded-lg bg-white p-3 text-sm shadow-sm" role="status">
            {statusMessage}
          </div>
        )}

        {!connection ? (
          <section className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Vincular Mercado Pago</h2>
            <p className="mt-2 text-sm text-gray-600">
              Conectá tu cuenta para traer los cobros aprobados. Los movimientos quedan en revisión
              y solo se registran cuando los confirmás.
            </p>
            <a
              href="/api/mercadopago/connect"
              className="mt-4 inline-block rounded-md bg-[#009EE3] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Vincular cuenta de Mercado Pago
            </a>
          </section>
        ) : (
          <MercadoPagoPanel
            lastSyncAt={connection.lastSyncAt ? connection.lastSyncAt.toISOString() : null}
            defaultFrom={todayInArgentina(-30)}
            defaultTo={todayInArgentina()}
            pending={pending.map((p) => ({
              id: p.id,
              mpPaymentId: p.mpPaymentId,
              description: p.description,
              dateApproved: p.dateApproved.toISOString(),
              amountGross: p.amountGross,
              feeAmount: p.feeAmount,
              amountNet: p.amountNet,
              currency: p.currency,
              paymentMethod: p.paymentMethod,
            }))}
            accounts={accounts}
            categories={categories}
          />
        )}
      </main>
    </div>
  )
}

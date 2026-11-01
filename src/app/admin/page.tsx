import { notFound } from 'next/navigation'

import { getSessionContext } from '@/server/auth/get-session-context'

export const dynamic = 'force-dynamic'

/** Emails con acceso al panel de plataforma (separados por coma, en PLATFORM_ADMIN_EMAILS). */
function isPlatformAdmin(email: string | null | undefined): boolean {
  const allowed = (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return Boolean(email && allowed.includes(email.toLowerCase()))
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })

export default async function PlatformAdminPage() {
  const sessionContext = await getSessionContext()
  if (!isPlatformAdmin(sessionContext?.user?.email)) notFound()

  const { default: prisma } = await import('@/lib/prisma')
  const [users, businesses, memberships, transactions, proposals, recentUsers, businessRows] = await Promise.all([
    prisma.user.count(),
    prisma.business.count(),
    prisma.businessMember.count({ where: { status: 'ACTIVE' } }),
    prisma.transaction.count(),
    prisma.agentProposal.count(),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        email: true,
        name: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { memberships: { where: { status: 'ACTIVE' } } } },
      },
    }),
    prisma.business.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        name: true,
        createdAt: true,
        operatingModel: true,
        _count: {
          select: {
            members: { where: { status: 'ACTIVE' } },
            transactions: true,
            agentProposals: true,
          },
        },
      },
    }),
  ])

  const cards = [
    { label: 'Usuarios', value: users },
    { label: 'Negocios', value: businesses },
    { label: 'Membresías activas', value: memberships },
    { label: 'Movimientos', value: transactions },
    { label: 'Propuestas del agente', value: proposals },
  ]

  return (
    <div className="mx-auto min-h-screen max-w-5xl p-4 font-sans text-[var(--ds-neutral-800)] dark:text-gray-100 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Plataforma</h1>
      <p className="mt-1 text-sm text-[var(--ds-gray-500)]">Visión general de cuentas de ContaGo (solo lectura).</p>

      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="ds-panel p-4 text-center">
            <p className="text-2xl font-semibold tabular-nums">{c.value.toLocaleString('es-AR')}</p>
            <p className="mt-0.5 text-[12px] text-[var(--ds-gray-500)]">{c.label}</p>
          </div>
        ))}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-[13px] font-medium text-[var(--ds-gray-500)]">Negocios</h2>
        <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white dark:border-white/10 dark:bg-[var(--ds-gray-900)]">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-black/[0.06] text-[11px] uppercase tracking-wider text-[var(--ds-gray-400)] dark:border-white/[0.08]">
                <th className="px-4 py-2.5 font-medium">Negocio</th>
                <th className="px-4 py-2.5 font-medium">Modelo</th>
                <th className="px-4 py-2.5 text-right font-medium">Miembros</th>
                <th className="px-4 py-2.5 text-right font-medium">Movimientos</th>
                <th className="px-4 py-2.5 text-right font-medium">Propuestas</th>
                <th className="px-4 py-2.5 text-right font-medium">Creado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
              {businessRows.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-2.5 font-medium text-[var(--ds-gray-900)] dark:text-white">{b.name}</td>
                  <td className="px-4 py-2.5 text-[var(--ds-gray-500)]">{b.operatingModel}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{b._count.members}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{b._count.transactions.toLocaleString('es-AR')}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{b._count.agentProposals}</td>
                  <td className="px-4 py-2.5 text-right text-[var(--ds-gray-500)]">{fmtDate(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-[13px] font-medium text-[var(--ds-gray-500)]">Usuarios recientes</h2>
        <div className="divide-y divide-black/[0.06] overflow-hidden rounded-2xl border border-black/[0.06] bg-white dark:divide-white/[0.08] dark:border-white/10 dark:bg-[var(--ds-gray-900)]">
          {recentUsers.map((u) => (
            <div key={u.email} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
              <div className="min-w-0">
                <p className="truncate font-medium text-[var(--ds-gray-900)] dark:text-white">{u.name || u.email}</p>
                <p className="truncate text-[12px] text-[var(--ds-gray-500)]">{u.email}</p>
              </div>
              <div className="shrink-0 text-right text-[12px] text-[var(--ds-gray-500)]">
                <p>{u._count.memberships} {u._count.memberships === 1 ? 'negocio' : 'negocios'}</p>
                <p>alta: {fmtDate(u.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

import AuthShell from '@/components/auth/AuthShell'
import ChangePasswordPanel from '@/components/auth/ChangePasswordPanel'
import { requireAuth } from '@/server/auth/require-auth'

export default async function ChangePasswordPage() {
  const sessionContext = await requireAuth()
  const allowMock = process.env.NODE_ENV !== 'production'
  const isMock = allowMock && (
    process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' ||
    process.env.USE_MOCK_DATA === 'true' ||
    (!process.env.DATABASE_URL && !process.env.TURSO_DATABASE_URL)
  )
  const user = isMock
    ? null
    : await (await import('@/lib/prisma')).default.user.findUniqueOrThrow({
        where: { id: sessionContext.user.id },
        select: { password: true },
      })

  return (
    <AuthShell
      title="Seguridad de la cuenta"
      subtitle="Actualiza la contraseña que usas para acceder a ContaGo."
      showSignOut
    >
      <ChangePasswordPanel hasPassword={Boolean(user?.password)} />
    </AuthShell>
  )
}

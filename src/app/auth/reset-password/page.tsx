import AuthShell from '@/components/auth/AuthShell'
import ResetPasswordPanel from '@/components/auth/ResetPasswordPanel'

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const params = await searchParams

  return (
    <AuthShell
      title="Define una nueva contraseña"
      subtitle="Validá el código recibido y establece una nueva contraseña para tu cuenta."
    >
      <ResetPasswordPanel email={params.email || ''} />
    </AuthShell>
  )
}
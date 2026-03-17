import AuthShell from '@/components/auth/AuthShell'
import VerifyCodePanel from '@/components/auth/VerifyCodePanel'

export default async function VerifyCodePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; purpose?: 'SIGNUP_VERIFY' | 'SOCIAL_LOGIN_VERIFY' | 'PASSWORD_RESET' | 'RISK_CHALLENGE' }>
}) {
  const params = await searchParams
  const email = params.email || ''
  const purpose = params.purpose || 'SIGNUP_VERIFY'

  return (
    <AuthShell
      title="Verifica tu codigo"
      subtitle="Ingresa el codigo enviado a tu email para completar el proceso."
    >
      <VerifyCodePanel email={email} purpose={purpose} />
    </AuthShell>
  )
}
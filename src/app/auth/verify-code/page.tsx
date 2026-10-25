import { redirect } from 'next/navigation'

import AuthShell from '@/components/auth/AuthShell'
import VerifyCodePanel from '@/components/auth/VerifyCodePanel'

const AUTH_CHALLENGE_PURPOSES = [
  'SIGNUP_VERIFY',
  'SOCIAL_LOGIN_VERIFY',
  'PASSWORD_RESET',
  'RISK_CHALLENGE',
] as const

export default async function VerifyCodePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; purpose?: 'SIGNUP_VERIFY' | 'SOCIAL_LOGIN_VERIFY' | 'PASSWORD_RESET' | 'RISK_CHALLENGE' }>
}) {
  const params = await searchParams
  const email = params.email?.trim().toLowerCase() || ''
  const purpose = AUTH_CHALLENGE_PURPOSES.includes(
    params.purpose as (typeof AUTH_CHALLENGE_PURPOSES)[number],
  )
    ? params.purpose!
    : 'SIGNUP_VERIFY'

  if (purpose === 'PASSWORD_RESET') {
    if (!email) redirect('/auth/forgot-password')
    redirect(`/auth/reset-password?email=${encodeURIComponent(email)}`)
  }

  return (
    <AuthShell
      title="Verifica tu codigo"
      subtitle="Ingresa el codigo enviado a tu email para completar el proceso."
    >
      <VerifyCodePanel email={email} purpose={purpose} />
    </AuthShell>
  )
}
import { redirect } from 'next/navigation'

import AuthShell from '@/components/auth/AuthShell'
import BusinessSelectorPanel from '@/components/auth/BusinessSelectorPanel'
import { buildAuthChallengeRedirectPath } from '@/server/auth/challenge-routing'
import { getSessionContext } from '@/server/auth/get-session-context'

export default async function SelectBusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [sessionContext, params] = await Promise.all([
    getSessionContext(),
    searchParams,
  ])

  if (!sessionContext) {
    redirect('/auth/login')
  }

  const challengeRedirectPath = buildAuthChallengeRedirectPath(sessionContext)

  if (challengeRedirectPath) {
    redirect(challengeRedirectPath)
  }

  if (sessionContext.businesses.length === 0) {
    redirect('/auth/error?error=NoBusinessAccess')
  }

  if (sessionContext.businesses.length <= 1) {
    redirect('/')
  }

  return (
    <AuthShell
      title="Selecciona tu negocio"
      subtitle="Tu cuenta tiene acceso a mas de un negocio. Elige el contexto correcto antes de continuar."
      showSignOut
    >
      <BusinessSelectorPanel
        businesses={sessionContext.businesses}
        currentBusinessId={sessionContext.activeBusiness?.id}
        error={params.error}
      />
    </AuthShell>
  )
}
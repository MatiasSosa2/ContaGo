import type { SessionContext } from './get-session-context'
import type { EmailChallengePurpose } from './challenges'

type AuthChallengePurpose = Exclude<EmailChallengePurpose, 'PASSWORD_RESET'>

export function resolveRequiredAuthChallenge(
  sessionContext: Pick<SessionContext, 'user' | 'auth'>,
): AuthChallengePurpose | null {
  if (sessionContext.auth.challengeSatisfied) {
    return null
  }

  if (!sessionContext.user.emailVerified) {
    return sessionContext.auth.provider === 'credentials'
      ? 'SIGNUP_VERIFY'
      : 'SOCIAL_LOGIN_VERIFY'
  }

  return 'RISK_CHALLENGE'
}

export function buildAuthChallengeRedirectPath(
  sessionContext: Pick<SessionContext, 'user' | 'auth'>,
) {
  const purpose = resolveRequiredAuthChallenge(sessionContext)

  if (!purpose) {
    return null
  }

  const params = new URLSearchParams({
    email: sessionContext.user.email,
    purpose,
  })

  return `/auth/verify-code?${params.toString()}`
}
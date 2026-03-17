import type { EmailChallengePurpose } from './challenges'

type SupportedLoginProvider = 'credentials' | 'google' | 'apple'

type LoginChallengeDecisionInput = {
  provider: SupportedLoginProvider
  emailVerified?: Date | null
  lastSecurityChallengeAt?: Date | null
}

const RISK_CHALLENGE_MAX_AGE_DAYS = 30

export function shouldRequirePeriodicRiskChallenge(lastSecurityChallengeAt?: Date | null) {
  if (!lastSecurityChallengeAt) {
    return true
  }

  const maxAgeMs = RISK_CHALLENGE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  return Date.now() - lastSecurityChallengeAt.getTime() > maxAgeMs
}

export function decideLoginChallenge(
  input: LoginChallengeDecisionInput,
): EmailChallengePurpose | null {
  const emailVerified = Boolean(input.emailVerified)

  if (!emailVerified) {
    return input.provider === 'credentials' ? 'SIGNUP_VERIFY' : 'SOCIAL_LOGIN_VERIFY'
  }

  if (shouldRequirePeriodicRiskChallenge(input.lastSecurityChallengeAt)) {
    return 'RISK_CHALLENGE'
  }

  return null
}

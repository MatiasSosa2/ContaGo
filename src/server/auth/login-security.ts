import type { EmailChallengePurpose } from './challenges'

type SupportedLoginProvider = 'credentials' | 'google' | 'apple'

type LoginChallengeDecisionInput = {
  provider: SupportedLoginProvider
  emailVerified?: Date | null
  lastSecurityChallengeAt?: Date | null
}

const RISK_CHALLENGE_MAX_AGE_DAYS = 30

/**
 * Determina si se necesita un nuevo challenge periódico de riesgo.
 *
 * Si `lastSecurityChallengeAt` es null pero el usuario ya verificó su email,
 * se usa `emailVerified` como baseline: la verificación inicial cuenta como
 * el último challenge satisfecho. Esto evita pedir un código en cada login
 * a usuarios existentes cuyo `lastSecurityChallengeAt` nunca se pobló.
 */
export function shouldRequirePeriodicRiskChallenge(
  lastSecurityChallengeAt?: Date | null,
  emailVerified?: Date | null,
) {
  const baseline = lastSecurityChallengeAt ?? emailVerified ?? null
  if (!baseline) {
    return true
  }

  const maxAgeMs = RISK_CHALLENGE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  return Date.now() - baseline.getTime() > maxAgeMs
}

export function decideLoginChallenge(
  input: LoginChallengeDecisionInput,
): EmailChallengePurpose | null {
  const emailVerified = Boolean(input.emailVerified)

  if (!emailVerified) {
    return input.provider === 'credentials' ? 'SIGNUP_VERIFY' : 'SOCIAL_LOGIN_VERIFY'
  }

  if (shouldRequirePeriodicRiskChallenge(input.lastSecurityChallengeAt, input.emailVerified)) {
    return 'RISK_CHALLENGE'
  }

  return null
}

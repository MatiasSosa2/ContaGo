import prisma from '@/lib/prisma'

import { createEmailChallenge, verifyEmailChallenge } from './challenges'
import { sendAuthCodeEmail } from './email'
import { hashPassword } from './password-change'

export { changePasswordFlow, hashPassword } from './password-change'

export async function requestPasswordResetFlow(email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true },
  })

  if (!user) {
    return { success: true as const }
  }

  const recentChallengeCount = await prisma.emailChallenge.count({
    where: {
      email: user.email,
      purpose: 'PASSWORD_RESET',
      createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
    },
  })
  if (recentChallengeCount >= 3) {
    return { success: true as const }
  }

  const { code } = await createEmailChallenge({
    email: user.email,
    userId: user.id,
    purpose: 'PASSWORD_RESET',
  })

  await sendAuthCodeEmail({
    email: user.email,
    code,
    purpose: 'PASSWORD_RESET',
  })

  return { success: true as const }
}

export async function resetPasswordWithCodeFlow(input: {
  email: string
  code: string
  password: string
}) {
  const verification = await verifyEmailChallenge({
    email: input.email,
    purpose: 'PASSWORD_RESET',
    code: input.code,
  })

  if (!verification.success) {
    return verification
  }

  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  })

  if (!user) {
    return { success: false as const, error: 'No se pudo completar la recuperacion.' }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await hashPassword(input.password),
      lastSecurityChallengeAt: new Date(),
      passwordChangedAt: new Date(),
      activeSessionId: null,
      activeSessionExpiresAt: null,
      activeSessionId2: null,
      activeSessionExpiresAt2: null,
      activeSessionId3: null,
      activeSessionExpiresAt3: null,
    },
  })

  return { success: true as const }
}

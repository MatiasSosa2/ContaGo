import bcrypt from 'bcryptjs'

import prisma from '@/lib/prisma'

import { createEmailChallenge, verifyEmailChallenge } from './challenges'
import { sendAuthCodeEmail } from './email'

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12)
}

export async function requestPasswordResetFlow(email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true },
  })

  if (!user) {
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

  await prisma.user.update({
    where: { id: user.id },
    data: { lastSecurityChallengeAt: new Date() },
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
    },
  })

  return { success: true as const }
}
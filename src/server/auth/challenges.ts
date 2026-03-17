import { createHash, randomInt, timingSafeEqual } from 'node:crypto'

import prisma from '@/lib/prisma'

export type EmailChallengePurpose = 'SIGNUP_VERIFY' | 'SOCIAL_LOGIN_VERIFY' | 'PASSWORD_RESET' | 'RISK_CHALLENGE'

type CreateEmailChallengeInput = {
  email: string
  purpose: EmailChallengePurpose
  userId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  ttlMinutes?: number
}

type VerifyEmailChallengeInput = {
  email: string
  purpose: EmailChallengePurpose
  code: string
  userId?: string | null
}

type VerifyEmailChallengeResult =
  | {
      success: true
      challenge: {
        id: string
        email: string
        purpose: EmailChallengePurpose
        userId: string | null
      }
    }
  | {
      success: false
      error: string
    }

function getChallengePepper() {
  return process.env.AUTH_CHALLENGE_PEPPER || process.env.NEXTAUTH_SECRET || 'contago-dev-pepper'
}

function hashChallengeCode(code: string) {
  return createHash('sha256').update(`${getChallengePepper()}:${code}`).digest('hex')
}

function generateNumericCode(length = 6) {
  let code = ''

  for (let index = 0; index < length; index += 1) {
    code += String(randomInt(0, 10))
  }

  return code
}

function safeCompareHash(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'hex')
  const rightBuffer = Buffer.from(right, 'hex')

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

export async function invalidateOpenChallenges(email: string, purpose: EmailChallengePurpose, userId?: string | null) {
  await prisma.emailChallenge.updateMany({
    where: {
      email,
      purpose,
      userId: userId ?? undefined,
      consumedAt: null,
    },
    data: {
      consumedAt: new Date(),
    },
  })
}

export async function createEmailChallenge(input: CreateEmailChallengeInput) {
  const code = generateNumericCode()
  const expiresAt = new Date(Date.now() + (input.ttlMinutes ?? 10) * 60 * 1000)

  await invalidateOpenChallenges(input.email, input.purpose, input.userId)

  const challenge = await prisma.emailChallenge.create({
    data: {
      userId: input.userId ?? null,
      email: input.email,
      purpose: input.purpose,
      codeHash: hashChallengeCode(code),
      expiresAt,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
    select: {
      id: true,
      email: true,
      purpose: true,
      userId: true,
      expiresAt: true,
    },
  })

  return {
    challenge,
    code,
  }
}

export async function verifyEmailChallenge(
  input: VerifyEmailChallengeInput,
): Promise<VerifyEmailChallengeResult> {
  const challenge = await prisma.emailChallenge.findFirst({
    where: {
      email: input.email,
      purpose: input.purpose,
      userId: input.userId ?? undefined,
      consumedAt: null,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      purpose: true,
      userId: true,
      codeHash: true,
      attempts: true,
      maxAttempts: true,
      expiresAt: true,
    },
  })

  if (!challenge) {
    return { success: false, error: 'No hay un codigo vigente para verificar.' }
  }

  if (challenge.expiresAt.getTime() < Date.now()) {
    await prisma.emailChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    })

    return { success: false, error: 'El codigo vencio. Solicita uno nuevo.' }
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    await prisma.emailChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    })

    return { success: false, error: 'Se agotaron los intentos permitidos.' }
  }

  const isMatch = safeCompareHash(challenge.codeHash, hashChallengeCode(input.code))

  if (!isMatch) {
    const nextAttempts = challenge.attempts + 1
    await prisma.emailChallenge.update({
      where: { id: challenge.id },
      data: {
        attempts: nextAttempts,
        consumedAt: nextAttempts >= challenge.maxAttempts ? new Date() : null,
      },
    })

    return { success: false, error: 'El codigo ingresado no es valido.' }
  }

  await prisma.emailChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  })

  return {
    success: true,
    challenge: {
      id: challenge.id,
      email: challenge.email,
      purpose: challenge.purpose as EmailChallengePurpose,
      userId: challenge.userId,
    },
  }
}
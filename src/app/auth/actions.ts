'use server'

import bcrypt from 'bcryptjs'

import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import {
  loginWithCredentialsSchema,
  registerWithCredentialsSchema,
  requestEmailChallengeSchema,
  resetPasswordWithCodeSchema,
  type ActionResult,
  verifyEmailChallengeSchema,
} from '@/lib/validations'
import type { EmailChallengePurpose } from '@/server/auth/challenges'
import { createEmailChallenge, verifyEmailChallenge } from '@/server/auth/challenges'
import { sendAuthCodeEmail } from '@/server/auth/email'
import { ensureUserBusinessMembership } from '@/server/auth/business-context'
import { decideLoginChallenge } from '@/server/auth/login-security'
import { requireAuth } from '@/server/auth/require-auth'
import { hashPassword, requestPasswordResetFlow, resetPasswordWithCodeFlow } from '@/server/auth/passwords'

const hasDatabaseConfig = Boolean(process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL)
const USE_MOCK =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' ||
  process.env.USE_MOCK_DATA === 'true' ||
  !hasDatabaseConfig

export async function registerWithCredentials(formData: FormData): Promise<ActionResult<{ email: string }>> {
  if (USE_MOCK) {
    return { success: true, data: { email: 'demo@finarg.com' } }
  }

  const raw = {
    name: formData.get('name') as string,
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    businessName: formData.get('businessName') as string,
    operatingModel: formData.get('operatingModel') as string,
  }

  const parsed = registerWithCredentialsSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { name, email, password, businessName, operatingModel } = parsed.data
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true },
  })

  if (existingUser) {
    return { success: false, error: 'Ya existe una cuenta registrada con este email.' }
  }

  const createdUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        password: await hashPassword(password),
      },
      select: { id: true },
    })

    const business = await tx.business.create({
      data: {
        name: businessName,
        currency: 'ARS',
        operatingModel,
      },
      select: { id: true },
    })

    await tx.businessMember.create({
      data: {
        userId: user.id,
        businessId: business.id,
        role: 'ADMIN',
        status: 'ACTIVE',
        acceptedAt: new Date(),
      },
    })

    await tx.user.update({
      where: { id: user.id },
      data: { defaultBusinessId: business.id },
    })

    return user
  })

  const { code } = await createEmailChallenge({
    userId: createdUser.id,
    email,
    purpose: 'SIGNUP_VERIFY',
  })

  await sendAuthCodeEmail({ email, code, purpose: 'SIGNUP_VERIFY' })

  return { success: true, data: { email } }
}

export async function prepareCredentialsLogin(
  formData: FormData,
): Promise<ActionResult<{ requiresCode?: boolean; email?: string; purpose?: EmailChallengePurpose }>> {
  if (USE_MOCK) {
    return { success: true }
  }

  const raw = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const parsed = loginWithCredentialsSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: {
      id: true,
      email: true,
      password: true,
      emailVerified: true,
      lastSecurityChallengeAt: true,
    },
  })

  if (!user?.password) {
    return { success: false, error: 'No se pudo iniciar sesion. Revisa tus credenciales o verifica tu email.' }
  }

  const isCorrectPassword = await bcrypt.compare(parsed.data.password, user.password)
  if (!isCorrectPassword) {
    return { success: false, error: 'No se pudo iniciar sesion. Revisa tus credenciales o verifica tu email.' }
  }

  const challengePurpose = decideLoginChallenge({
    provider: 'credentials',
    emailVerified: user.emailVerified,
    lastSecurityChallengeAt: user.lastSecurityChallengeAt,
  })

  if (!challengePurpose) {
    return { success: true }
  }

  const { code } = await createEmailChallenge({
    userId: user.id,
    email: user.email,
    purpose: challengePurpose,
  })

  await sendAuthCodeEmail({
    email: user.email,
    code,
    purpose: challengePurpose,
  })

  return {
    success: true,
    data: {
      requiresCode: true,
      email: user.email,
      purpose: challengePurpose,
    },
  }
}

export async function requestEmailVerification(formData: FormData): Promise<ActionResult> {
  if (USE_MOCK) {
    return { success: true }
  }

  const raw = {
    email: formData.get('email') as string,
    purpose: ((formData.get('purpose') as string) || 'SIGNUP_VERIFY') as string,
  }

  const parsed = requestEmailChallengeSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, emailVerified: true },
  })

  if (!user) {
    return { success: true }
  }

  if (parsed.data.purpose === 'SIGNUP_VERIFY' && user.emailVerified) {
    return { success: true }
  }

  const { code } = await createEmailChallenge({
    email: parsed.data.email,
    userId: user.id,
    purpose: parsed.data.purpose,
  })

  await sendAuthCodeEmail({
    email: parsed.data.email,
    code,
    purpose: parsed.data.purpose,
  })

  await prisma.user.update({
    where: { id: user.id },
    data: { lastSecurityChallengeAt: new Date() },
  })

  return { success: true }
}

export async function verifyEmailCode(formData: FormData): Promise<ActionResult> {
  if (USE_MOCK) {
    return { success: true }
  }

  const raw = {
    email: formData.get('email') as string,
    purpose: formData.get('purpose') as string,
    code: formData.get('code') as string,
  }

  const parsed = verifyEmailChallengeSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const verification = await verifyEmailChallenge(parsed.data)
  if (!verification.success) {
    return verification
  }

  const userId = verification.challenge.userId ?? (
    await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    })
  )?.id

  if (!userId) {
    return { success: false, error: 'No se encontro una cuenta asociada para verificar.' }
  }

  const data: {
    emailVerified?: Date
    lastSecurityChallengeAt: Date
  } = {
    lastSecurityChallengeAt: new Date(),
  }

  if (parsed.data.purpose === 'SIGNUP_VERIFY' || parsed.data.purpose === 'SOCIAL_LOGIN_VERIFY') {
    data.emailVerified = new Date()
  }

  await prisma.user.update({
    where: { id: userId },
    data,
  })

  return { success: true }
}

export async function requestPasswordReset(formData: FormData): Promise<ActionResult> {
  if (USE_MOCK) {
    return { success: true }
  }

  const email = formData.get('email') as string
  const parsed = requestEmailChallengeSchema.safeParse({ email, purpose: 'PASSWORD_RESET' })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  await requestPasswordResetFlow(parsed.data.email)
  return { success: true }
}

export async function resetPasswordWithCode(formData: FormData): Promise<ActionResult> {
  if (USE_MOCK) {
    return { success: true }
  }

  const raw = {
    email: formData.get('email') as string,
    code: formData.get('code') as string,
    password: formData.get('password') as string,
  }

  const parsed = resetPasswordWithCodeSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  return resetPasswordWithCodeFlow(parsed.data)
}

export async function setActiveBusiness(formData: FormData): Promise<ActionResult> {
  if (USE_MOCK) {
    return { success: true }
  }

  const sessionContext = await requireAuth()
  const businessId = String(formData.get('businessId') || '').trim()

  if (!businessId) {
    return { success: false, error: 'Debes seleccionar un negocio.' }
  }

  const membership = await ensureUserBusinessMembership(sessionContext.user.id, businessId)
  if (!membership) {
    return { success: false, error: 'No tienes acceso a ese negocio.' }
  }

  await prisma.user.update({
    where: { id: sessionContext.user.id },
    data: { defaultBusinessId: membership.id },
  })

  return { success: true }
}

export async function selectBusinessAndContinue(formData: FormData): Promise<never> {
  const result = await setActiveBusiness(formData)

  if (!result.success) {
    redirect(`/select-business?error=${encodeURIComponent(result.error)}`)
  }

  redirect('/')
}
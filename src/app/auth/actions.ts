'use server'

import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import {
  registerWithCredentialsSchema,
  requestEmailChallengeSchema,
  resetPasswordWithCodeSchema,
  type ActionResult,
  verifyEmailChallengeSchema,
} from '@/lib/validations'
import { createEmailChallenge, verifyEmailChallenge } from '@/server/auth/challenges'
import { sendAuthCodeEmail } from '@/server/auth/email'
import { ensureUserBusinessMembership } from '@/server/auth/business-context'
import { requireAuth } from '@/server/auth/require-auth'
import { hashPassword, requestPasswordResetFlow, resetPasswordWithCodeFlow } from '@/server/auth/passwords'
import { setupContableAccountsForBusiness } from '@/server/accounting/setup-contable-accounts'

const DEFAULT_EXPENSE_CATEGORIES = ['Sueldos', 'Alquiler', 'Publicidad', 'Impuestos']

// El mock nunca se activa en producción (sería un bypass de autenticación).
const allowMock = process.env.NODE_ENV !== 'production'
const hasDatabaseConfig = Boolean(process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL)
const USE_MOCK =
  allowMock &&
  (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' ||
    process.env.USE_MOCK_DATA === 'true' ||
    !hasDatabaseConfig)

// Máximo de códigos por email en la ventana indicada (anti-spam de correos).
const EMAIL_CODE_WINDOW_MS = 10 * 60 * 1000
const EMAIL_CODE_MAX_PER_WINDOW = 3

async function sendSignupVerification(email: string, userId: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - EMAIL_CODE_WINDOW_MS)
  const recentCount = await prisma.emailChallenge.count({
    where: { email, createdAt: { gte: windowStart } },
  })
  if (recentCount >= EMAIL_CODE_MAX_PER_WINDOW) return true

  const { code } = await createEmailChallenge({
    userId,
    email,
    purpose: 'SIGNUP_VERIFY',
  })

  try {
    await sendAuthCodeEmail({ email, code, purpose: 'SIGNUP_VERIFY' })
    return true
  } catch (error) {
    console.error('[registerWithCredentials] verification email failed', error)
    return false
  }
}

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
    // Reintentar el alta puede recuperar un registro que quedó sin verificar,
    // sin revelar si la dirección existe ni reemplazar su contraseña.
    if (!existingUser.emailVerified) {
      const sent = await sendSignupVerification(email, existingUser.id)
      if (!sent) {
        return { success: false, error: 'No pudimos enviar el código ahora. Inténtalo nuevamente en unos minutos.' }
      }
    }
    return { success: true, data: { email } }
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

    await tx.account.create({
      data: {
        name: 'Caja principal',
        type: 'CASH',
        currency: 'ARS',
        currentBalance: 0,
        businessId: business.id,
      },
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

    // Categorías de egreso que vienen por defecto en la pestaña de registración
    for (const nombre of DEFAULT_EXPENSE_CATEGORIES) {
      await tx.category.create({
        data: { name: nombre, type: 'EXPENSE', businessId: business.id },
      })
    }

    await setupContableAccountsForBusiness(business.id, tx)

    await tx.user.update({
      where: { id: user.id },
      data: { defaultBusinessId: business.id },
    })

    return user
  })

  const sent = await sendSignupVerification(email, createdUser.id)
  if (!sent) {
    return { success: false, error: 'No pudimos enviar el código ahora. Inténtalo nuevamente en unos minutos con el mismo email.' }
  }

  return { success: true, data: { email } }
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

  // Límite por email: evita que un tercero dispare correos en masa.
  const windowStart = new Date(Date.now() - EMAIL_CODE_WINDOW_MS)
  const recentCount = await prisma.emailChallenge.count({
    where: { email: parsed.data.email, createdAt: { gte: windowStart } },
  })
  if (recentCount >= EMAIL_CODE_MAX_PER_WINDOW) {
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

  return { success: true }
}

export async function verifyEmailCode(
  formData: FormData,
): Promise<ActionResult<{ challengeId?: string }>> {
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

  return {
    success: true,
    data: { challengeId: verification.challenge.id },
  }
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
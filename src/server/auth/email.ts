import type { EmailChallengePurpose } from './challenges'

type SendAuthCodeEmailInput = {
  email: string
  code: string
  purpose: EmailChallengePurpose
}

function sendAuthCodeToConsole({ email, code, purpose }: SendAuthCodeEmailInput, reason?: string) {
  if (reason) {
    console.warn(`[AuthEmailFallback:${purpose}] ${reason}`)
  }

  console.info(`[AuthEmail:${purpose}] ${email} -> ${code}`)
  return { provider: 'console' as const }
}

function canFallbackToConsole() {
  return process.env.NODE_ENV !== 'production'
}

function getEmailSubject(purpose: EmailChallengePurpose) {
  switch (purpose) {
    case 'PASSWORD_RESET':
      return 'ContaGo: código para recuperar tu contraseña'
    case 'SOCIAL_LOGIN_VERIFY':
    case 'RISK_CHALLENGE':
      return 'ContaGo: verificá tu inicio de sesión'
    case 'SIGNUP_VERIFY':
    default:
      return 'ContaGo: verificá tu cuenta'
  }
}

function getEmailHtml({ code, purpose }: { code: string; purpose: EmailChallengePurpose }) {
  const title = getEmailSubject(purpose)

  return [
    '<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">',
    `<h1 style="font-size: 20px; margin-bottom: 16px;">${title}</h1>`,
    '<p style="font-size: 14px; line-height: 1.6;">Usá el siguiente código para continuar en ContaGo.</p>',
    `<div style="margin: 24px 0; font-size: 32px; font-weight: 700; letter-spacing: 8px;">${code}</div>`,
    '<p style="font-size: 13px; line-height: 1.6; color: #6b7280;">El código vence en 10 minutos. Si no iniciaste esta acción, podés ignorar este correo.</p>',
    '</div>',
  ].join('')
}

/** Email transaccional genérico (avisos que no son códigos de autenticación). */
export async function sendNotificationEmail({ email, subject, html }: { email: string; subject: string; html: string }) {
  const provider = (process.env.AUTH_EMAIL_PROVIDER || 'console').trim().toLowerCase()

  if (provider === 'console' || provider !== 'resend') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_EMAIL_PROVIDER debe ser "resend" en producción.')
    }
    console.info(`[AuthEmail:notification] ${email} -> ${subject}`)
    return { provider: 'console' as const }
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.AUTH_EMAIL_FROM
  if (!apiKey || !from) {
    if (canFallbackToConsole()) {
      console.info(`[AuthEmail:notification] ${email} -> ${subject}`)
      return { provider: 'console' as const }
    }
    throw new Error('Falta configurar RESEND_API_KEY o AUTH_EMAIL_FROM para enviar correos.')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: email, subject, html }),
  })

  if (!response.ok) {
    const details = await response.text()
    if (canFallbackToConsole()) {
      console.info(`[AuthEmail:notification] ${email} -> ${subject}`)
      return { provider: 'console' as const }
    }
    throw new Error(`No se pudo enviar el email. ${details}`)
  }

  return { provider: 'resend' as const }
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'administrador',
  COLLABORATOR: 'colaborador',
  VIEWER: 'solo lectura',
}

/** Aviso de invitación a un negocio. El acceso se activa al iniciar sesión con ese email. */
export async function sendTeamInviteEmail({ email, businessName, role }: { email: string; businessName: string; role: string }) {
  const loginUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
  const html = [
    '<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">',
    `<h1 style="font-size: 20px; margin-bottom: 16px;">Te invitaron a ${businessName} en ContaGo</h1>`,
    `<p style="font-size: 14px; line-height: 1.6;">Vas a entrar como <strong>${ROLE_LABEL[role] ?? 'colaborador'}</strong>. Inicia sesión o crea tu cuenta con este mismo email y el negocio aparece solo.</p>`,
    `<p style="margin: 24px 0;"><a href="${loginUrl}/auth/login" style="background: #235347; color: #ffffff; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-size: 14px;">Entrar a ContaGo</a></p>`,
    '<p style="font-size: 13px; line-height: 1.6; color: #6b7280;">Si no esperabas esta invitacion, podés ignorar este correo.</p>',
    '</div>',
  ].join('')

  return sendNotificationEmail({ email, subject: `Te invitaron a ${businessName} en ContaGo`, html })
}

export async function sendAuthCodeEmail({ email, code, purpose }: SendAuthCodeEmailInput) {
  const provider = (process.env.AUTH_EMAIL_PROVIDER || 'console').trim().toLowerCase()

  if (provider === 'console') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_EMAIL_PROVIDER debe ser "resend" en producción.')
    }

    return sendAuthCodeToConsole({ email, code, purpose })
  }

  if (provider !== 'resend') {
    throw new Error('AUTH_EMAIL_PROVIDER debe ser "console" o "resend".')
  }

  if (provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.AUTH_EMAIL_FROM

    if (!apiKey || !from) {
      if (canFallbackToConsole()) {
        return sendAuthCodeToConsole({ email, code, purpose }, 'Falta configurar RESEND_API_KEY o AUTH_EMAIL_FROM.')
      }

      throw new Error('Falta configurar RESEND_API_KEY o AUTH_EMAIL_FROM para enviar correos.')
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: getEmailSubject(purpose),
        html: getEmailHtml({ code, purpose }),
      }),
    })

    if (!response.ok) {
      const details = await response.text()

      if (canFallbackToConsole()) {
        return sendAuthCodeToConsole({ email, code, purpose }, `Resend fallo: ${details}`)
      }

      throw new Error(`No se pudo enviar el email de autenticacion. ${details}`)
    }

    return { provider: 'resend' as const }
  }
}

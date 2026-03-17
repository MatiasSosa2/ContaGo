import type { EmailChallengePurpose } from './challenges'

type SendAuthCodeEmailInput = {
  email: string
  code: string
  purpose: EmailChallengePurpose
}

function getEmailSubject(purpose: EmailChallengePurpose) {
  switch (purpose) {
    case 'PASSWORD_RESET':
      return 'ContaGo: codigo para recuperar tu contraseña'
    case 'SOCIAL_LOGIN_VERIFY':
    case 'RISK_CHALLENGE':
      return 'ContaGo: verifica tu inicio de sesion'
    case 'SIGNUP_VERIFY':
    default:
      return 'ContaGo: verifica tu cuenta'
  }
}

function getEmailHtml({ code, purpose }: { code: string; purpose: EmailChallengePurpose }) {
  const title = getEmailSubject(purpose)

  return [
    '<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">',
    `<h1 style="font-size: 20px; margin-bottom: 16px;">${title}</h1>`,
    '<p style="font-size: 14px; line-height: 1.6;">Usa el siguiente codigo para continuar en ContaGo.</p>',
    `<div style="margin: 24px 0; font-size: 32px; font-weight: 700; letter-spacing: 8px;">${code}</div>`,
    '<p style="font-size: 13px; line-height: 1.6; color: #6b7280;">El codigo vence en 10 minutos. Si no iniciaste esta accion, puedes ignorar este correo.</p>',
    '</div>',
  ].join('')
}

export async function sendAuthCodeEmail({ email, code, purpose }: SendAuthCodeEmailInput) {
  const provider = (process.env.AUTH_EMAIL_PROVIDER || 'console').toLowerCase()

  if (provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.AUTH_EMAIL_FROM

    if (!apiKey || !from) {
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
      throw new Error(`No se pudo enviar el email de autenticacion. ${details}`)
    }

    return { provider: 'resend' as const }
  }

  console.info(`[AuthEmail:${purpose}] ${email} -> ${code}`)
  return { provider: 'console' as const }
}
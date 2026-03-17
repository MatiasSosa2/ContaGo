'use client'

import { useState, useTransition } from 'react'

import Link from 'next/link'

import { requestEmailVerification, verifyEmailCode } from '@/app/auth/actions'

export default function VerifyCodePanel({
  email,
  purpose,
}: {
  email: string
  purpose: 'SIGNUP_VERIFY' | 'SOCIAL_LOGIN_VERIFY' | 'PASSWORD_RESET' | 'RISK_CHALLENGE'
}) {
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleVerify(formData: FormData) {
    startTransition(async () => {
      setError(null)
      setMessage(null)
      formData.set('email', email)
      formData.set('purpose', purpose)
      const result = await verifyEmailCode(formData)
      if (!result.success) {
        setError(result.error)
        return
      }
      setMessage('Codigo validado. Ya puedes iniciar sesion.')
    })
  }

  function handleResend() {
    startTransition(async () => {
      setError(null)
      setMessage(null)
      const formData = new FormData()
      formData.set('email', email)
      formData.set('purpose', purpose)
      const result = await requestEmailVerification(formData)
      if (!result.success) {
        setError(result.error)
        return
      }
      setMessage('Enviamos un nuevo codigo a tu email.')
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
        Email destino: <span className="font-medium text-gray-800">{email}</span>
      </div>

      <form action={handleVerify} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="code" className="text-xs font-medium text-gray-500">Codigo de 6 digitos</label>
          <input id="code" name="code" type="text" inputMode="numeric" pattern="[0-9]{6}" required className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-center text-lg tracking-[0.45em] text-gray-900 outline-none transition focus:border-brand-military" />
        </div>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

        <button type="submit" disabled={isPending} className="w-full rounded-2xl bg-brand-military px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-military-dark disabled:cursor-not-allowed disabled:opacity-60">
          {isPending ? 'Validando...' : 'Validar codigo'}
        </button>
      </form>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <button type="button" onClick={handleResend} disabled={isPending} className="font-medium text-brand-military hover:text-brand-military-dark disabled:cursor-not-allowed disabled:opacity-60">
          Reenviar codigo
        </button>
        <Link href="/auth/login" className="hover:text-gray-700">Ir al login</Link>
      </div>
    </div>
  )
}
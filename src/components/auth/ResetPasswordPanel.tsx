'use client'

import { useState, useTransition } from 'react'

import Link from 'next/link'

import { resetPasswordWithCode } from '@/app/auth/actions'

export default function ResetPasswordPanel({ email }: { email: string }) {
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      setError(null)
      setMessage(null)
      formData.set('email', email)
      const result = await resetPasswordWithCode(formData)
      if (!result.success) {
        setError(result.error)
        return
      }
      setMessage('La contraseña fue actualizada. Ya puedes iniciar sesion.')
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
        Si existe una cuenta con este email, enviamos un código a{' '}
        <span className="font-medium text-gray-800">{email}</span>. Si no llega o venció,
        puedes <Link href="/auth/forgot-password" className="font-medium text-brand-military hover:text-brand-military-dark">solicitar otro</Link>.
      </div>

      <form action={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="code" className="text-xs font-medium text-gray-500">Codigo</label>
          <input id="code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" autoCapitalize="none" pattern="[0-9]{6}" maxLength={6} required className="min-h-11 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-center text-lg tracking-[0.45em] text-gray-900 outline-none transition focus:border-brand-military focus-visible:ring-2 focus-visible:ring-brand-military/30" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-medium text-gray-500">Nueva contraseña</label>
          <input id="password" name="password" type="password" minLength={8} maxLength={72} autoComplete="new-password" required className="min-h-11 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-military focus-visible:ring-2 focus-visible:ring-brand-military/30" />
        </div>

        {error && <div className="rounded-2xl border border-ds-red-100 bg-ds-red-50 px-4 py-3 text-sm text-ds-red-600">{error}</div>}
        {message && <div className="rounded-2xl border border-ds-green-200 bg-ds-green-50 px-4 py-3 text-sm text-ds-green-700">{message}</div>}

        <button type="submit" disabled={isPending} className="min-h-11 w-full rounded-2xl bg-brand-military px-4 py-3 text-sm font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-military hover:bg-brand-military-dark disabled:cursor-not-allowed disabled:opacity-60">
          {isPending ? 'Actualizando...' : 'Actualizar contraseña'}
        </button>
      </form>

      <Link href="/auth/login" className="text-sm font-medium text-brand-military hover:text-brand-military-dark">Ir al login</Link>
    </div>
  )
}
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
        Email destino: <span className="font-medium text-gray-800">{email}</span>
      </div>

      <form action={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="code" className="text-xs font-medium text-gray-500">Codigo</label>
          <input id="code" name="code" type="text" inputMode="numeric" pattern="[0-9]{6}" required className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-center text-lg tracking-[0.45em] text-gray-900 outline-none transition focus:border-brand-military" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-medium text-gray-500">Nueva contraseña</label>
          <input id="password" name="password" type="password" required className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-military" />
        </div>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

        <button type="submit" disabled={isPending} className="w-full rounded-2xl bg-brand-military px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-military-dark disabled:cursor-not-allowed disabled:opacity-60">
          {isPending ? 'Actualizando...' : 'Actualizar contraseña'}
        </button>
      </form>

      <Link href="/auth/login" className="text-sm font-medium text-brand-military hover:text-brand-military-dark">Ir al login</Link>
    </div>
  )
}
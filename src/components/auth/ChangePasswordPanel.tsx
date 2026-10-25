'use client'

import { useState, useTransition } from 'react'
import { signOut } from 'next-auth/react'
import Link from 'next/link'

import { changePassword } from '@/app/auth/actions'

export default function ChangePasswordPanel({ hasPassword }: { hasPassword: boolean }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      setError(null)
      const result = await changePassword(formData)
      if (!result.success) {
        setError(result.error)
        return
      }

      await signOut({ redirect: false })
      window.location.assign('/auth/login?passwordChanged=1')
    })
  }

  return (
    <div className="space-y-5">
      {!hasPassword && (
        <p className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          Tu cuenta se creó con un proveedor externo. Puedes definir una contraseña para usar también el acceso con email.
        </p>
      )}

      <form action={handleSubmit} className="space-y-4">
        {hasPassword && (
          <div className="space-y-1.5">
            <label htmlFor="currentPassword" className="text-xs font-medium text-gray-500">Contraseña actual</label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              className="min-h-11 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-military focus-visible:ring-2 focus-visible:ring-brand-military/30"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="newPassword" className="text-xs font-medium text-gray-500">Nueva contraseña</label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
            className="min-h-11 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-military focus-visible:ring-2 focus-visible:ring-brand-military/30"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="text-xs font-medium text-gray-500">Repite la nueva contraseña</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
            className="min-h-11 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-military focus-visible:ring-2 focus-visible:ring-brand-military/30"
          />
        </div>

        {error && <div className="rounded-2xl border border-ds-red-100 bg-ds-red-50 px-4 py-3 text-sm text-ds-red-600">{error}</div>}

        <button
          type="submit"
          disabled={isPending}
          className="min-h-11 w-full rounded-2xl bg-brand-military px-4 py-3 text-sm font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-military hover:bg-brand-military-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? 'Actualizando...' : hasPassword ? 'Cambiar contraseña' : 'Crear contraseña'}
        </button>
      </form>

      <Link href="/" className="text-sm font-medium text-brand-military hover:text-brand-military-dark">
        Volver a ContaGo
      </Link>
    </div>
  )
}

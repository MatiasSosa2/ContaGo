'use client'

import { useState, useTransition } from 'react'

import { useRouter } from 'next/navigation'

import { requestPasswordReset } from '@/app/auth/actions'

export default function ForgotPasswordPanel() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      setError(null)
      const email = String(formData.get('email') || '')
      const result = await requestPasswordReset(formData)
      if (!result.success) {
        setError(result.error)
        return
      }
      router.push(`/auth/reset-password?email=${encodeURIComponent(email)}`)
      router.refresh()
    })
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-xs font-medium text-gray-500">Email</label>
        <input id="email" name="email" type="email" required className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-military" />
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <button type="submit" disabled={isPending} className="w-full rounded-2xl bg-brand-military px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-military-dark disabled:cursor-not-allowed disabled:opacity-60">
        {isPending ? 'Enviando...' : 'Enviar codigo'}
      </button>
    </form>
  )
}
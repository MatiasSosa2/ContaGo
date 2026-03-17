'use client'

import { useState, useTransition } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { registerWithCredentials } from '@/app/auth/actions'

export default function RegisterPanel() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      setError(null)
      const result = await registerWithCredentials(formData)
      if (!result.success) {
        setError(result.error)
        return
      }

      router.push(`/auth/verify-code?email=${encodeURIComponent(result.data?.email || '')}&purpose=SIGNUP_VERIFY`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <form action={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-xs font-medium text-gray-500">Nombre</label>
          <input id="name" name="name" type="text" required className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-military" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="businessName" className="text-xs font-medium text-gray-500">Nombre del negocio</label>
          <input id="businessName" name="businessName" type="text" required className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-military" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="operatingModel" className="text-xs font-medium text-gray-500">Tu negocio vende</label>
          <select id="operatingModel" name="operatingModel" defaultValue="BOTH" className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-military">
            <option value="SERVICES">Servicios</option>
            <option value="PRODUCTS">Productos</option>
            <option value="BOTH">Servicios y productos</option>
          </select>
          <p className="text-xs leading-5 text-gray-400">
            Esto define el onboarding inicial y mas adelante nos permite adaptar modulos, flujos y sugerencias del sistema.
          </p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-medium text-gray-500">Email</label>
          <input id="email" name="email" type="email" required className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-military" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-medium text-gray-500">Contraseña</label>
          <input id="password" name="password" type="password" required className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-military" />
        </div>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <button type="submit" disabled={isPending} className="w-full rounded-2xl bg-brand-military px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-military-dark disabled:cursor-not-allowed disabled:opacity-60">
          {isPending ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>

      <div className="text-sm text-gray-500">
        ¿Ya tienes cuenta?{' '}
        <Link href="/auth/login" className="font-medium text-brand-military hover:text-brand-military-dark">Iniciar sesion</Link>
      </div>
    </div>
  )
}
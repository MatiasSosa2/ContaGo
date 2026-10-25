'use client'

import { useState, useTransition } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

import { registerWithCredentials } from '@/app/auth/actions'

export default function RegisterPanel({
  googleEnabled,
  microsoftEnabled,
}: {
  googleEnabled: boolean
  microsoftEnabled: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      setError(null)
      const result = await registerWithCredentials(formData)
      if (!result.success) {
        setError(result.error)
        return
      }

      if (!result.data?.verificationRequired) {
        router.push(`/auth/login?email=${encodeURIComponent(result.data?.email || '')}&registered=1`)
        router.refresh()
        return
      }

      router.push(`/auth/verify-code?email=${encodeURIComponent(result.data?.email || '')}&purpose=SIGNUP_VERIFY`)
      router.refresh()
    })
  }

  function handleProviderSignUp(provider: 'google' | 'azure-ad') {
    startTransition(async () => {
      setError(null)
      try {
        await signIn(provider, { callbackUrl: '/select-business' })
      } catch {
        setError('No pudimos iniciar el registro con ese proveedor. Inténtalo nuevamente.')
      }
    })
  }

  return (
    <div className="space-y-6">
      <p className="text-sm leading-6 text-gray-500">
        Crea tu cuenta con Google, Microsoft o email. Confirmaremos tu correo antes de iniciar y no necesitas cargar información contable ahora.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={!googleEnabled || isPending}
          onClick={() => handleProviderSignUp('google')}
          className="min-h-11 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-military enabled:hover:border-brand-military enabled:hover:text-brand-military disabled:cursor-not-allowed disabled:opacity-50"
        >
          Registrarme con Google
        </button>
        <button
          type="button"
          disabled={!microsoftEnabled || isPending}
          onClick={() => handleProviderSignUp('azure-ad')}
          className="min-h-11 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-military enabled:hover:border-brand-military enabled:hover:text-brand-military disabled:cursor-not-allowed disabled:opacity-50"
        >
          Registrarme con Microsoft
        </button>
      </div>
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-gray-300">
        <div className="h-px flex-1 bg-gray-200" />
        o con email
        <div className="h-px flex-1 bg-gray-200" />
      </div>
      <form action={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-xs font-medium text-gray-500">Nombre</label>
          <input id="name" name="name" type="text" autoComplete="name" required className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-military" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="businessName" className="text-xs font-medium text-gray-500">Nombre del negocio</label>
          <input id="businessName" name="businessName" type="text" autoComplete="organization" required className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-military" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="operatingModel" className="text-xs font-medium text-gray-500">¿Qué ofrece tu negocio?</label>
          <select id="operatingModel" name="operatingModel" defaultValue="BOTH" className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-military">
            <option value="SERVICES">Servicios</option>
            <option value="PRODUCTS">Productos</option>
            <option value="BOTH">Servicios y productos</option>
          </select>
          <p className="text-xs leading-5 text-gray-400">Podrás cambiarlo más adelante.</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-medium text-gray-500">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-military" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-medium text-gray-500">Contraseña</label>
          <div className="relative">
            <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={72} required className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 pr-20 text-sm text-gray-900 outline-none transition focus:border-brand-military" />
            <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-pressed={showPassword} className="absolute inset-y-0 right-3 text-xs font-medium text-brand-military hover:text-brand-military-dark">
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          <p className="text-xs leading-5 text-gray-400">Usa al menos 8 caracteres. No la compartas con otras personas.</p>
        </div>

        {error && <div className="rounded-2xl border border-ds-red-100 bg-ds-red-50 px-4 py-3 text-sm text-ds-red-600">{error}</div>}

        <button type="submit" disabled={isPending} className="w-full rounded-2xl bg-brand-military px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-military-dark disabled:cursor-not-allowed disabled:opacity-60">
          {isPending ? 'Preparando tu cuenta...' : 'Crear cuenta'}
        </button>
      </form>

      <div className="text-sm text-gray-500">
        ¿Ya tienes una cuenta?{' '}
        <Link href="/auth/login" className="font-medium text-brand-military hover:text-brand-military-dark">Iniciar sesion</Link>
      </div>
    </div>
  )
}
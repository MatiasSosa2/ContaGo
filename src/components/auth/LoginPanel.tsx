'use client'

import { useState, useTransition } from 'react'

import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

import { prepareCredentialsLogin } from '@/app/auth/actions'

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.44a5.51 5.51 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.57-5.15 3.57-8.65Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.87-3c-1.07.72-2.43 1.14-4.08 1.14-3.14 0-5.8-2.12-6.75-4.97H1.25v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.25 14.26A7.2 7.2 0 0 1 4.87 12c0-.79.14-1.56.38-2.26V6.64H1.25a12 12 0 0 0 0 10.72l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.58 1.81l3.44-3.44C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.25 6.64l4 3.1c.95-2.86 3.61-4.97 6.75-4.97Z"
      />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-current">
      <path d="M16.68 12.5c.02 2.18 1.92 2.9 1.94 2.91-.02.05-.3 1.02-.99 2.02-.59.86-1.2 1.72-2.16 1.74-.94.02-1.24-.56-2.31-.56-1.08 0-1.42.54-2.29.58-.93.04-1.63-.93-2.22-1.79-1.2-1.73-2.11-4.9-.88-7.03.61-1.06 1.7-1.73 2.89-1.75.9-.02 1.75.61 2.31.61.56 0 1.61-.75 2.72-.64.46.02 1.77.19 2.61 1.42-.07.05-1.56.91-1.54 2.49Zm-2.14-5.7c.49-.59.81-1.41.72-2.23-.71.03-1.57.47-2.08 1.06-.45.51-.84 1.35-.73 2.14.79.06 1.59-.4 2.09-.97Z" />
    </svg>
  )
}

export default function LoginPanel({
  googleEnabled,
  appleEnabled,
  temporaryAccessEnabled,
}: {
  googleEnabled: boolean
  appleEnabled: boolean
  temporaryAccessEnabled: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(searchParams.get('error'))
  const [message, setMessage] = useState<string | null>(
    searchParams.get('verified') === '1' ? 'Codigo validado. Inicia sesion para continuar.' : null,
  )
  const [isPending, startTransition] = useTransition()

  function handleProviderSignIn(provider: 'google' | 'apple') {
    startTransition(async () => {
      setError(null)
      setMessage(null)
      await signIn(provider, { callbackUrl: '/select-business' })
    })
  }

  function handleCredentialsSubmit(formData: FormData) {
    startTransition(async () => {
      setError(null)
      setMessage(null)
      const email = String(formData.get('email') || '')
      const password = String(formData.get('password') || '')

      const preflight = new FormData()
      preflight.set('email', email)
      preflight.set('password', password)

      const preparation = await prepareCredentialsLogin(preflight)

      if (!preparation.success) {
        setError(preparation.error)
        return
      }

      if (preparation.data?.requiresCode && preparation.data.email && preparation.data.purpose) {
        router.push(
          `/auth/verify-code?email=${encodeURIComponent(preparation.data.email)}&purpose=${encodeURIComponent(preparation.data.purpose)}`,
        )
        router.refresh()
        return
      }

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: '/select-business',
      })

      if (!result || result.error) {
        setError('No se pudo iniciar sesion. Revisa tus credenciales o verifica tu email.')
        return
      }

      router.push(result.url || '/select-business')
      router.refresh()
    })
  }

  function handleTemporaryAccess() {
    startTransition(async () => {
      setError(null)
      setMessage(null)

      const result = await signIn('credentials', {
        temporaryAccess: 'true',
        redirect: false,
        callbackUrl: '/select-business',
      })

      if (!result || result.error) {
        setError('No se pudo iniciar el acceso temporal. Intenta nuevamente.')
        return
      }

      router.push(result.url || '/select-business')
      router.refresh()
    })
  }

  return (
    <div className="space-y-6 lg:space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:gap-2.5">
        <button
          type="button"
          disabled={!googleEnabled || isPending}
          onClick={() => handleProviderSignIn('google')}
          className="flex items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition enabled:hover:border-brand-military enabled:hover:text-brand-military disabled:cursor-not-allowed disabled:opacity-50 lg:py-2.5"
        >
          <GoogleIcon />
          Continuar con Google
        </button>
        <button
          type="button"
          disabled={!appleEnabled || isPending}
          onClick={() => handleProviderSignIn('apple')}
          className="flex items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition enabled:hover:border-brand-military enabled:hover:text-brand-military disabled:cursor-not-allowed disabled:opacity-50 lg:py-2.5"
        >
          <AppleIcon />
          Continuar con Apple
        </button>
      </div>

      {temporaryAccessEnabled && (
        <div className="rounded-2xl border border-brand-military/15 bg-brand-military/5 p-3.5 sm:p-4 lg:p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:gap-2">
            <p className="text-xs leading-5 text-gray-500 lg:leading-4">Entrar sin contraseña.</p>
            <button
              type="button"
              onClick={handleTemporaryAccess}
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-brand-military/20 bg-white px-4 py-3 text-sm font-semibold text-brand-military transition hover:border-brand-military hover:bg-brand-military/5 disabled:cursor-not-allowed disabled:opacity-60 lg:px-3.5 lg:py-2.5"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H9m0 0 3-3m-3 3 3 3" />
              </svg>
              {isPending ? 'Ingresando...' : 'Entrar sin contraseña'}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-gray-300 lg:gap-2">
        <div className="h-px flex-1 bg-gray-200" />
        o inicia sesion con email
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <form action={handleCredentialsSubmit} className="space-y-4 lg:space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-medium text-gray-500">Email</label>
          <input id="email" name="email" type="email" defaultValue={searchParams.get('email') || ''} required className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-military lg:py-2.5" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-medium text-gray-500">Contraseña</label>
          <input id="password" name="password" type="password" required className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-military lg:py-2.5" />
        </div>

        {message && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 lg:py-2.5">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 lg:py-2.5">
            {error}
          </div>
        )}

        <button type="submit" disabled={isPending} className="w-full rounded-2xl bg-brand-military px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-military-dark disabled:cursor-not-allowed disabled:opacity-60 lg:py-2.5">
          {isPending ? 'Ingresando...' : 'Iniciar sesion'}
        </button>
      </form>

      <div className="flex items-center justify-between text-sm text-gray-500 lg:text-[13px]">
        <Link href="/auth/register" className="font-medium text-brand-military hover:text-brand-military-dark">Crear cuenta</Link>
        <Link href="/auth/forgot-password" className="hover:text-gray-700">Olvide mi contraseña</Link>
      </div>
    </div>
  )
}
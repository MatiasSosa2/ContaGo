'use client'

import { useTransition } from 'react'

import { signOut } from 'next-auth/react'

export default function AuthSignOutButton() {
  const [isSigningOut, startSignOutTransition] = useTransition()

  function handleSignOut() {
    startSignOutTransition(async () => {
      await signOut({ callbackUrl: '/auth/login' })
    })
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9l3 3m0 0-3 3m3-3H3.75" />
      </svg>
      {isSigningOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
    </button>
  )
}
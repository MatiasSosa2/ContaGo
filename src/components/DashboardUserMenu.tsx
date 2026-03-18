'use client'

import { useEffect, useRef, useState, useTransition } from 'react'

import { signOut } from 'next-auth/react'

type DashboardUserMenuProps = {
  user: {
    name?: string | null
    email: string
    image?: string | null
    emailVerified: boolean
  }
  business: {
    name: string
    role: 'ADMIN' | 'COLLABORATOR' | 'VIEWER'
  }
  authProvider: 'google' | 'apple' | 'credentials' | 'mock'
}

const ROLE_LABELS: Record<DashboardUserMenuProps['business']['role'], string> = {
  ADMIN: 'Administrador',
  COLLABORATOR: 'Colaborador',
  VIEWER: 'Visualizador',
}

const PROVIDER_LABELS: Record<DashboardUserMenuProps['authProvider'], string> = {
  google: 'Google',
  apple: 'Apple',
  credentials: 'Correo y clave',
  mock: 'Acceso temporal',
}

function getInitials(name?: string | null, email?: string) {
  const source = name?.trim() || email || 'CG'
  const words = source.split(/\s+/).filter(Boolean)

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase()
  }

  return source.slice(0, 2).toUpperCase()
}

export default function DashboardUserMenu({ user, business, authProvider }: DashboardUserMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [isSigningOut, startSignOutTransition] = useTransition()

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
        setShowDetails(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
        setShowDetails(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  function handleSignOut() {
    startSignOutTransition(async () => {
      await signOut({ callbackUrl: '/auth/login' })
    })
  }

  const displayName = user.name?.trim() || user.email.split('@')[0]
  const initials = getInitials(user.name, user.email)
  const accountStatus = user.emailVerified ? 'Correo verificado' : 'Correo pendiente'

  return (
    <div ref={containerRef} className="relative lg:shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen(current => !current)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-left transition hover:border-stone-300 hover:bg-white sm:w-auto lg:min-h-[52px]"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <div className="flex items-center gap-3 min-w-0">
          {user.image ? (
            <img
              src={user.image}
              alt={`Avatar de ${displayName}`}
              className="h-11 w-11 rounded-full object-cover ring-2 ring-white"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2D6A4F] text-sm font-semibold text-white ring-2 ring-white">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-stone-800">{displayName}</p>
            <p className="truncate text-xs text-stone-500">{business.name}</p>
          </div>
        </div>
        <svg
          className={`h-4 w-4 shrink-0 text-stone-500 transition ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 011.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isOpen ? (
        <div className="fixed inset-x-0 top-0 z-30 w-full overflow-hidden rounded-none border-b border-stone-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.16)] sm:absolute sm:right-0 sm:left-auto sm:top-full sm:mt-3 sm:w-[26rem] sm:border sm:border-stone-300 sm:bg-[#fcfbf7] lg:mt-0 lg:h-[150px] lg:rounded-none lg:border-[1px] lg:border-stone-300 lg:shadow-none">
          <div className="border-b border-stone-100 bg-stone-50/80 px-5 py-4 lg:flex lg:h-full lg:border-b-0 lg:border-r lg:border-stone-300 lg:bg-[#f5f1e8] lg:px-4 lg:py-4">
            <div className="lg:flex lg:w-[46%] lg:flex-col lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400 lg:text-[10px] lg:tracking-[0.18em]">Cuenta activa</p>
                <p className="mt-1 text-base font-semibold text-stone-900 lg:text-[15px]">{displayName}</p>
                <p className="text-sm text-stone-500 lg:mt-1 lg:text-xs">{user.email}</p>
              </div>
              <div className="mt-3 hidden lg:block">
                <span className="inline-flex rounded-none border border-[#d7cfbe] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6f6558]">
                  {ROLE_LABELS[business.role]}
                </span>
              </div>
            </div>
          </div>

          <div className="px-3 py-3 lg:flex lg:h-full lg:w-[54%] lg:flex-col lg:justify-between lg:px-4 lg:py-4">
            <button
              type="button"
              onClick={() => setShowDetails(current => !current)}
              className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition hover:bg-stone-50 lg:hidden"
            >
              <span>
                <span className="block text-sm font-semibold text-stone-800">Ver datos de la cuenta</span>
                <span className="block text-xs text-stone-500">Perfil, negocio activo y método de acceso</span>
              </span>
              <svg
                className={`h-4 w-4 shrink-0 text-stone-400 transition ${showDetails ? 'rotate-180' : ''}`}
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 011.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {showDetails ? (
              <div className="mx-3 mb-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 lg:hidden">
                <dl className="space-y-3 text-sm text-stone-600">
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-stone-400">Nombre</dt>
                    <dd className="text-right font-medium text-stone-800">{displayName}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-stone-400">Correo</dt>
                    <dd className="text-right font-medium text-stone-800">{user.email}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-stone-400">Estado</dt>
                    <dd className="text-right font-medium text-stone-800">{accountStatus}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-stone-400">Negocio</dt>
                    <dd className="text-right font-medium text-stone-800">{business.name}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-stone-400">Rol</dt>
                    <dd className="text-right font-medium text-stone-800">{ROLE_LABELS[business.role]}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-stone-400">Ingreso</dt>
                    <dd className="text-right font-medium text-stone-800">{PROVIDER_LABELS[authProvider]}</dd>
                  </div>
                </dl>
              </div>
            ) : null}

            <div className="hidden lg:grid lg:grid-cols-2 lg:gap-x-4 lg:gap-y-2 lg:border-b lg:border-stone-200 lg:pb-3">
              {showDetails ? (
                <>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Negocio</p>
                    <p className="mt-1 truncate text-sm font-medium text-stone-800">{business.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Ingreso</p>
                    <p className="mt-1 text-sm font-medium text-stone-800">{PROVIDER_LABELS[authProvider]}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Estado</p>
                    <p className="mt-1 text-sm font-medium text-stone-800">{accountStatus}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Perfil</p>
                    <p className="mt-1 text-sm font-medium text-stone-800">{displayName}</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Correo</p>
                    <p className="mt-1 truncate text-sm font-medium text-stone-800">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Rol</p>
                    <p className="mt-1 text-sm font-medium text-stone-800">{ROLE_LABELS[business.role]}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Usuario</p>
                    <p className="mt-1 text-sm font-medium text-stone-800">{displayName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Acceso</p>
                    <p className="mt-1 text-sm font-medium text-stone-800">Panel administrativo</p>
                  </div>
                </>
              )}
            </div>

            <div className="lg:grid lg:grid-cols-1 lg:items-center lg:gap-3">
              <button
                type="button"
                onClick={() => setShowDetails(current => !current)}
                className="hidden h-[42px] items-center justify-between rounded-xl border border-stone-300 bg-white px-3 text-left text-stone-700 transition hover:border-stone-400 hover:bg-stone-50 lg:flex"
              >
                <span className="text-sm font-semibold">{showDetails ? 'Ver resumen' : 'Ver datos de la cuenta'}</span>
                <svg className="h-4 w-4 shrink-0 text-stone-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 011.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>

              <div className="mt-2 border-t border-stone-200 pt-2 lg:mt-0 lg:pt-3">
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-stone-600 transition hover:bg-stone-100 hover:text-stone-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <span>
                    <span className="block text-sm font-semibold">{isSigningOut ? 'Cerrando sesión...' : 'Cerrar sesión'}</span>
                    <span className="block text-xs text-stone-400">Salir y volver al acceso principal</span>
                  </span>
                  <svg className="h-5 w-5 shrink-0 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9l3 3m0 0-3 3m3-3H3.75" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
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

export default function DashboardUserMenu({ user, business }: DashboardUserMenuProps) {
  // Solo muestra nombre y negocio, con el mismo estilo que los ítems del sidebar
  const displayName = user.name?.trim() || user.email.split('@')[0]
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      {user.image ? (
        <img
          src={user.image}
          alt={`Avatar de ${displayName}`}
          className="h-8 w-8 rounded-full object-cover border-2 border-white dark:border-[#11171d]"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2D6A4F] text-xs font-semibold text-white border-2 border-white dark:border-[#11171d]">
          {getInitials(user.name, user.email)}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white dark:text-white leading-tight">{displayName}</p>
        <p className="truncate text-xs text-[#C5A065] dark:text-[#C5A065] leading-tight">{business.name}</p>
      </div>
    </div>
  )
}
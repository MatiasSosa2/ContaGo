'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTransition, useState, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import ThemeToggle from '@/components/ThemeToggle'

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Inicio',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/cajas',
    label: 'Cajas',
    subLabel: 'Cuentas y movimientos',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
  {
    href: '/reports',
    label: 'Informes',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
      </svg>
    ),
  },
  {
    href: '/creditos',
    label: 'Créditos',
    subLabel: 'CxC / CxP',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    href: '/stock',
    label: 'Inventario',
    subLabel: 'Stock',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [isSigningOut, startSignOut] = useTransition()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar-collapsed')
      if (saved === 'true') setCollapsed(true)
    } catch {}
  }, [])

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem('sidebar-collapsed', String(next)) } catch {}
      return next
    })
  }

  function handleSignOut() {
    startSignOut(async () => {
      await signOut({ callbackUrl: '/auth/login' })
    })
  }
  if (pathname.startsWith('/auth') || pathname.startsWith('/select-business')) {
    return null
  }

  return (
    <>
    <aside
      className={`hidden md:flex md:flex-col h-screen sticky top-0 z-20 shrink-0 transition-all duration-300 ${collapsed ? 'w-[68px]' : 'w-60'}`}
      style={{ background: '#1B4332', borderRight: '1px solid rgba(0,0,0,0.25)' }}
    >
      {/* LOGOTIPO */}
      <div className={`h-[88px] flex items-center overflow-hidden transition-all duration-300 ${collapsed ? 'px-3 justify-center' : 'px-5'}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {collapsed ? (
          <Image
            src="/contago-mark.svg"
            alt="ContaGo"
            width={355}
            height={355}
            priority
            className="h-10 w-10"
          />
        ) : (
          <div className="flex items-center gap-0">
            <Image
              src="/contago-wordmark-copy.svg"
              alt="Conta"
              width={560}
              height={180}
              priority
              className="h-auto w-[124px]"
            />
            <Image
              src="/contago-mark.svg"
              alt="GO"
              width={355}
              height={355}
              priority
              className="-ml-[14px] h-[78px] w-[78px] translate-y-[2px]"
            />
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-5 space-y-1.5">
        {!collapsed && (
          <p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>Menú</p>
        )}
        {NAV_ITEMS.map(item => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${collapsed ? 'justify-center px-2' : 'px-3'}`}
              style={isActive ? { background: '#2D6A4F', color: '#F0FDF4' } : { color: 'rgba(255,255,255,0.60)' }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.11)' }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span className="shrink-0 scale-[1.08]" style={isActive ? { color: '#6EE7B7' } : { color: 'rgba(255,255,255,0.40)' }}>
                {item.icon}
              </span>
              {!collapsed && (
                <div className="flex flex-col overflow-hidden">
                  <span className="leading-tight truncate">{item.label}</span>
                  {'subLabel' in item && item.subLabel && (
                    <span className="text-[11px] leading-tight" style={{ color: isActive ? 'rgba(110,231,183,0.7)' : 'rgba(255,255,255,0.30)' }}>
                      {item.subLabel}
                    </span>
                  )}
                </div>
              )}
              {!collapsed && isActive && <div className="ml-auto shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: '#6EE7B7' }} />}
            </Link>
          )
        })}
      </nav>

      <div className={`px-2 py-3 flex flex-col gap-2 ${collapsed ? 'items-center' : ''}`} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Botón colapsar */}
        <button
          onClick={toggleCollapse}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className={`flex items-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all duration-150 ${collapsed ? 'justify-center px-2 w-full' : 'px-3 w-full'}`}
          style={{ color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.06)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.13)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
        >
          <svg className={`shrink-0 w-4 h-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {!collapsed && <span>Colapsar</span>}
        </button>
        {!collapsed && <ThemeToggle />}
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          title={collapsed ? 'Cerrar sesión' : undefined}
          className={`flex items-center gap-2.5 rounded-lg py-2.5 text-sm font-semibold transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed ${collapsed ? 'justify-center px-2 w-full' : 'px-3 w-full'}`}
          style={{ color: '#FCA5A5', background: 'rgba(239,68,68,0.12)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.22)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)' }}
        >
          <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9l3 3m0 0-3 3m3-3H3.75" />
          </svg>
          {!collapsed && (isSigningOut ? 'Cerrando...' : 'Cerrar sesión')}
        </button>
      </div>
    </aside>

    {/* ── Barra de navegación inferior — solo mobile ── */}
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 flex"
      style={{ background: '#1B4332', paddingBottom: 'env(safe-area-inset-bottom)', boxShadow: '0 -1px 16px rgba(0,0,0,0.25)', borderTop: '1px solid rgba(255,255,255,0.08)' }}
    >
      {NAV_ITEMS.map(item => {
        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 relative flex flex-col items-center justify-center py-2 gap-0.5 min-w-0 active:opacity-70 transition-opacity"
          >
            {isActive && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                style={{ background: '#C5A065' }}
              />
            )}
            <span style={{ color: isActive ? '#6EE7B7' : 'rgba(255,255,255,0.45)' }}>
              {item.icon}
            </span>
            <span
              className="text-[10px] font-medium leading-none truncate px-1"
              style={{ color: isActive ? '#6EE7B7' : 'rgba(255,255,255,0.45)' }}
            >
              {item.label}
            </span>
          </Link>
        )
      })}
      {/* Botón cerrar sesión mobile */}
      <button
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="flex-1 relative flex flex-col items-center justify-center py-2 gap-0.5 min-w-0 active:opacity-70 transition-opacity disabled:opacity-50"
      >
        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="#FCA5A5" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9l3 3m0 0-3 3m3-3H3.75" />
        </svg>
        <span className="text-[10px] font-medium leading-none" style={{ color: '#FCA5A5' }}>
          {isSigningOut ? '...' : 'Salir'}
        </span>
      </button>
    </nav>
    </>
  )
}


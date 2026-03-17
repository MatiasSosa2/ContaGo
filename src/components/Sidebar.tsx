'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  {
    href: '/bienes',
    label: 'Bienes de Uso',
    subLabel: 'Activos fijos',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  if (pathname.startsWith('/auth') || pathname.startsWith('/select-business')) {
    return null
  }

  return (
    <>
    <aside className="hidden md:flex md:flex-col w-60 h-screen sticky top-0 z-20 shrink-0" style={{ background: '#1B4332', borderRight: '1px solid rgba(0,0,0,0.25)' }}>
      {/* LOGOTIPO */}
      <div className="h-16 px-5 flex items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#2D6A4F' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-base font-semibold tracking-tight" style={{ color: '#F0FDF4' }}>
            Conta<span style={{ color: '#6EE7B7' }}>GO</span>
          </span>
        </div>
      </div>

      <nav className="flex-1 py-5 px-3 space-y-0.5 overflow-y-auto">
        <p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>Menú</p>
        {NAV_ITEMS.map(item => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
              style={isActive ? { background: '#2D6A4F', color: '#F0FDF4' } : { color: 'rgba(255,255,255,0.60)' }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)' }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span style={isActive ? { color: '#6EE7B7' } : { color: 'rgba(255,255,255,0.40)' }}>
                {item.icon}
              </span>
              <div className="flex flex-col">
                <span className="leading-tight">{item.label}</span>
                {'subLabel' in item && item.subLabel && (
                  <span className="text-[11px] leading-tight" style={{ color: isActive ? 'rgba(110,231,183,0.7)' : 'rgba(255,255,255,0.30)' }}>
                    {item.subLabel}
                  </span>
                )}
              </div>
              {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: '#6EE7B7' }} />}
            </Link>
          )
        })}

        {/* ADMINISTRACIÓN */}
        <div className="pt-5">
          <p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'rgba(255,255,255,0.25)' }}>Administración</p>
          {(['Usuarios', 'Configuración'] as const).map(label => (
            <button key={label} disabled className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-not-allowed" style={{ color: 'rgba(255,255,255,0.25)' }}>
              <span style={{ color: 'rgba(255,255,255,0.18)' }}>
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              </span>
              {label}
              <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.30)' }}>Pronto</span>
            </button>
          ))}
        </div>
      </nav>

      <div className="px-3 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <ThemeToggle />
      </div>

      <div className="px-4 py-4" style={{ background: 'rgba(0,0,0,0.20)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ background: '#2D6A4F', color: '#A7F3D0' }}>AA</div>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight truncate" style={{ color: '#F0FDF4' }}>Usuario Admin</p>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(167,243,208,0.60)' }}>Administrador</p>
          </div>
        </div>
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
    </nav>
    </>
  )
}


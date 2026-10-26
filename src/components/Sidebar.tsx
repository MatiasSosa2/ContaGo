'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useTransition, useState } from 'react'
import { signOut } from 'next-auth/react'
import ThemeToggle from '@/components/ThemeToggle'
import { useStoredValue } from '@/lib/useStoredValue'

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Balance General',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/cajas',
    label: 'Cajas',
    subLabel: 'Cuentas y movimientos',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
  {
    href: '/creditos',
    label: 'Créditos',
    subLabel: 'CxC / CxP',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    href: '/stock',
    label: 'Inventario',
    subLabel: 'Stock',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    href: '/reports',
    label: 'Informes',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
      </svg>
    ),
  },
]


/** Ícono redondo del pie del panel con su nombre flotante al pasar el mouse */
function SidebarIcon({ label, collapsed, children }: { label: string; collapsed: boolean; children: React.ReactNode }) {
  return (
    <div className="group relative flex">
      {children}
      <span
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-[#1C1C1E]/90 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg backdrop-blur transition-opacity duration-150 group-hover:opacity-100 ${
          collapsed ? 'left-full top-1/2 ml-3 -translate-y-1/2' : 'bottom-full left-1/2 mb-2 -translate-x-1/2'
        }`}
      >
        {label}
      </span>
    </div>
  )
}

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/** Fecha de hoy para el pie del panel: "Viernes (23 | Oct)" */
function hoyCorto() {
  const d = new Date()
  const dia = d.toLocaleDateString('es-AR', { weekday: 'long' })
  return { dia: dia.charAt(0).toUpperCase() + dia.slice(1), numero: d.getDate(), mes: MESES_CORTOS[d.getMonth()] }
}

// Paleta del panel: verde petróleo oscuro y el elegido en dorado suave
const GOLD = '#E3CB8F'

export default function Sidebar({ businessName }: { businessName?: string }) {
  const pathname = usePathname()
  const [isSigningOut, startSignOut] = useTransition()
  const closeMoreRef = useRef<HTMLButtonElement>(null)
  const mobileMoreRef = useRef<HTMLElement>(null)
  // Contraído o no: se guarda en el navegador
  const [savedCollapsed, setSavedCollapsed] = useStoredValue('sidebar-collapsed')
  const collapsed = savedCollapsed === 'true'
  const toggleCollapse = () => setSavedCollapsed(String(!collapsed))

  // Cerrar sesión pide confirmación (cartel estilo iOS)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [showMobileMore, setShowMobileMore] = useState(false)
  const mobileMoreIsActive = pathname.startsWith('/creditos') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/auth/change-password')

  useEffect(() => {
    if (!showMobileMore) return

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeMoreRef.current?.focus()

    function handleDialogKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setShowMobileMore(false)
        return
      }
      if (event.key !== 'Tab') return

      const focusable = mobileMoreRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable?.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleDialogKeyDown)
    return () => {
      document.removeEventListener('keydown', handleDialogKeyDown)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [showMobileMore])
  function handleSignOut() {
    setConfirmSignOut(true)
  }
  function doSignOut() {
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
      className={`sticky top-0 z-20 hidden h-screen shrink-0 bg-[#F2F2F7] p-2 pr-0 transition-all dark:bg-black duration-300 lg:block ${collapsed ? 'w-[76px]' : 'w-[232px]'}`}
    >
      {/* Panel flotante con esquinas redondeadas y degradé verde oscuro */}
      <div
        className="relative flex h-full flex-col overflow-hidden rounded-[18px] shadow-[0_8px_30px_rgba(0,0,0,0.18)]"
        style={{ background: 'linear-gradient(180deg, #0E3B2E 0%, #0C2E24 55%, #0A251D 100%)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Logo cuadrado y nombre del negocio */}
        <div className={`flex items-center gap-3 pb-5 pt-6 ${collapsed ? 'justify-center px-0' : 'px-5'}`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl" style={{ background: 'rgba(255,255,255,0.08)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }}>
            <Image src="/contago-mark.svg" alt="ContaGo" width={355} height={355} priority className="h-8 w-8" />
          </span>
          {!collapsed && (
            <span className="min-w-0 truncate text-[13.5px] font-semibold leading-tight text-white">{businessName || 'ContaGo'}</span>
          )}
        </div>

        <nav className={`flex-1 space-y-1 overflow-y-auto py-2 ${collapsed ? 'px-2.5' : 'px-3'}`}>
          {NAV_ITEMS.map(item => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`group relative flex items-center gap-3 rounded-xl py-2.5 text-[14px] font-medium transition-colors duration-150 ${collapsed ? 'justify-center px-0' : 'px-3'} ${isActive ? '' : 'hover:bg-white/[0.06]'}`}
                style={isActive
                  ? { background: 'rgba(197,160,101,0.20)', color: GOLD }
                  : { color: 'rgba(255,255,255,0.72)' }}
              >
                {/* Marca dorada en el borde izquierdo del panel (solo abierto) */}
                {isActive && !collapsed && (
                  <span aria-hidden className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full" style={{ background: GOLD }} />
                )}
                <span className="shrink-0" style={{ color: isActive ? GOLD : 'rgba(255,255,255,0.55)' }}>
                  {item.icon}
                </span>
                {!collapsed && <span className="truncate leading-tight">{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Pie: fecha de hoy, contraer y modo oscuro (cerrar sesión, sutil) */}
        <div className={`mx-3 border-t py-3.5 ${collapsed ? 'flex flex-col items-center gap-2' : 'flex items-center justify-between gap-1'}`} style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          {/* Todo en una fila: "Viernes (23 | Oct)" y los íconos */}
          {!collapsed && (() => {
            const h = hoyCorto()
            return (
              <p className="min-w-0 truncate whitespace-nowrap text-[13px]" style={{ color: 'rgba(255,255,255,0.72)' }} suppressHydrationWarning>
                {h.dia} <span style={{ color: 'rgba(255,255,255,0.45)' }}>({h.numero} | {h.mes})</span>
              </p>
            )
          })()}
          <div className={`flex items-center ${collapsed ? 'flex-col gap-1.5' : 'gap-0.5'}`}>
            <SidebarIcon label={collapsed ? 'Expandir' : 'Contraer'} collapsed={collapsed}>
              <button
                type="button"
                onClick={toggleCollapse}
                aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
                className="flex h-7 w-7 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.08] hover:text-white/85 active:scale-95"
              >
                <svg className={`h-3.5 w-3.5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </SidebarIcon>
            <SidebarIcon label="Modo oscuro" collapsed={collapsed}>
              <ThemeToggle circle plain />
            </SidebarIcon>
            <SidebarIcon label="Cerrar sesión" collapsed={collapsed}>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                aria-label="Cerrar sesión"
                className="flex h-7 w-7 items-center justify-center rounded-full text-white/45 transition hover:bg-[#FF453A]/[0.16] hover:text-[#FF8A80] active:scale-95 disabled:opacity-50"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9l3 3m0 0-3 3m3-3H3.75" />
                </svg>
              </button>
            </SidebarIcon>
          </div>
        </div>
      </div>
    </aside>

    {/* Confirmación de cierre de sesión, estilo alerta de iOS */}
    {confirmSignOut && (
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center"
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif' }}
      >
        <button type="button" aria-label="Cancelar" className="absolute inset-0 bg-black/35" onClick={() => setConfirmSignOut(false)} />
        <div role="alertdialog" aria-labelledby="signout-title" className="relative z-10 w-[270px] overflow-hidden rounded-[14px] bg-[#F2F2F2]/95 text-center shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl dark:bg-[#2C2C2E]/95">
          <div className="px-4 pb-4 pt-5">
            <p id="signout-title" className="text-[17px] font-semibold text-[#1C1C1E] dark:text-white">¿Cerrar sesión?</p>
            <p className="mt-1 text-[13px] leading-snug text-[#3C3C43]/80 dark:text-[#EBEBF5]/70">Vas a tener que volver a ingresar para usar ContaGo.</p>
          </div>
          <div className="grid grid-cols-2 border-t border-black/10 dark:border-white/10">
            <button type="button" autoFocus onClick={() => setConfirmSignOut(false)} className="border-r border-black/10 py-3 text-[17px] text-[#007AFF] transition hover:bg-black/[0.04] dark:border-white/10 dark:text-[#0A84FF] dark:hover:bg-white/[0.06]">
              Cancelar
            </button>
            <button type="button" onClick={doSignOut} disabled={isSigningOut} className="py-3 text-[17px] font-semibold text-[#FF3B30] transition hover:bg-black/[0.04] disabled:opacity-50 dark:text-[#FF453A] dark:hover:bg-white/[0.06]">
              {isSigningOut ? 'Cerrando…' : 'Cerrar sesión'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Barra de navegación inferior — solo mobile ── */}
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 lg:hidden"
      style={{ background: '#051F20', paddingBottom: 'env(safe-area-inset-bottom)', boxShadow: '0 -1px 16px rgba(0,0,0,0.25)', borderTop: '1px solid rgba(255,255,255,0.08)' }}
    >
      {NAV_ITEMS.filter((item) => ['/', '/cajas', '/stock'].includes(item.href)).map(item => {
        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            className="relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-center transition-colors active:bg-white/[0.08] focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#E3CB8F]"
          >
            {isActive && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5"
                style={{ background: '#C5A065' }}
              />
            )}
            <span className="flex h-5 w-5 items-center justify-center" style={{ color: isActive ? '#E3CB8F' : 'rgba(255,255,255,0.72)' }}>
              {item.icon}
            </span>
            <span
              className="max-w-full truncate text-[10px] font-medium leading-none"
              style={{ color: isActive ? '#E3CB8F' : 'rgba(255,255,255,0.72)' }}
            >
              {item.label === 'Balance General' ? 'Inicio' : item.label === 'Inventario' ? 'Stock' : item.label}
            </span>
          </Link>
        )
      })}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={showMobileMore}
        aria-current={mobileMoreIsActive ? 'page' : undefined}
        onClick={() => setShowMobileMore(true)}
        className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-center transition-colors active:bg-white/[0.08] focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#E3CB8F] ${showMobileMore ? 'text-[#E3CB8F]' : 'text-white/75'}`}
      >
        {(pathname.startsWith('/creditos') || pathname.startsWith('/reports') || pathname.startsWith('/auth/change-password')) && (
          <span aria-hidden className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 bg-[#C5A065]" />
        )}
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
          <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
        </svg>
        <span className="text-[10px] font-medium leading-none">Más</span>
      </button>
    </nav>
    {showMobileMore && (
      <>
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-[60] bg-black/35 lg:hidden"
          onClick={() => setShowMobileMore(false)}
        />
        <section
          ref={mobileMoreRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-more-title"
          className="fixed inset-x-0 bottom-0 z-[61] rounded-t-2xl border border-black/10 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgba(0,0,0,0.2)] dark:border-white/10 dark:bg-[var(--ds-gray-900)] lg:hidden"
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15 dark:bg-white/20" aria-hidden />
          <div className="mb-2 flex items-center justify-between">
            <h2 id="mobile-more-title" className="text-base font-semibold text-[var(--ds-gray-900)] dark:text-white">Más opciones</h2>
            <button ref={closeMoreRef} type="button" onClick={() => setShowMobileMore(false)} aria-label="Cerrar menú" className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--ds-gray-600)] hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C5A065] dark:text-white dark:hover:bg-white/10">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {NAV_ITEMS.filter((item) => ['/creditos', '/reports'].includes(item.href)).map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setShowMobileMore(false)}
                  className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C5A065] ${isActive ? 'border-[#C5A065]/50 bg-[#C5A065]/10 text-[#76552B] dark:text-[#E3CB8F]' : 'border-black/10 text-[var(--ds-gray-800)] dark:border-white/10 dark:text-white'}`}
                >
                  <span className="h-5 w-5 shrink-0">{item.icon}</span>
                  {item.label}
                </Link>
              )
            })}
            <Link
              href="/auth/change-password"
              onClick={() => setShowMobileMore(false)}
              className="col-span-2 flex min-h-12 items-center rounded-xl border border-black/10 px-3 text-sm font-medium text-[var(--ds-gray-800)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C5A065] dark:border-white/10 dark:text-white"
            >
              Seguridad y contraseña
            </Link>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-black/10 pt-3 dark:border-white/10">
            <div className="w-40">
              <ThemeToggle className="min-h-11 rounded-lg border-black/10 px-2 text-[var(--ds-gray-700)] dark:text-white" />
            </div>
            <button
              type="button"
              onClick={() => { setShowMobileMore(false); handleSignOut() }}
              disabled={isSigningOut}
              className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-[#A33C32] hover:bg-[#A33C32]/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A33C32] disabled:opacity-50 dark:text-[#FCA5A5]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0-3 3m3-3H3.75" /></svg>
              {isSigningOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </button>
          </div>
        </section>
      </>
    )}
    </>
  )
}

'use client'

import { useEffect } from 'react'
import { useStoredValue } from '@/lib/useStoredValue'

export default function ThemeToggle({ compact = false, circle = false, className = '' }: {
  compact?: boolean
  /** Botón redondo solo con ícono (panel izquierdo, estilo iOS) */
  circle?: boolean
  className?: string
}) {
  // Preferencia guardada (por defecto: claro); el layout ya la aplica antes de pintar
  const [theme, setTheme] = useStoredValue('theme')
  const dark = theme === 'dark'

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

  const toggle = () => setTheme(dark ? 'light' : 'dark')

  // Círculo con ícono: luna para pasar a oscuro, sol para volver a claro
  if (circle) {
    return (
      <button
        type="button"
        onClick={toggle}
        suppressHydrationWarning
        role="switch"
        aria-checked={dark}
        aria-label={dark ? 'Modo claro' : 'Modo oscuro'}
        className={`print:hidden flex h-8 w-8 items-center justify-center rounded-full bg-[#fff]/[0.08] text-[#fff]/75 transition hover:bg-[#fff]/[0.14] hover:text-[#fff] active:scale-95 ${className}`}
      >
        {dark ? (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
          </svg>
        ) : (
          <svg className="h-[17px] w-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
          </svg>
        )}
      </button>
    )
  }

  // Modo compacto: solo ícono, para el header superior
  if (compact) {
    return (
      <button
        onClick={toggle}
        suppressHydrationWarning
        title={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        className="print:hidden h-8 w-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/[0.07] transition-colors"
      >
        {dark ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
          </svg>
        )}
      </button>
    )
  }

  return (
    <button
      onClick={toggle}
      suppressHydrationWarning
      role="switch"
      aria-checked={dark}
      title={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className="print:hidden w-full flex items-center gap-3 px-4 py-2.5 rounded-sm text-xs font-medium uppercase tracking-wider transition-all
        text-gray-400 hover:text-gray-200 hover:bg-[#fff]/[0.06] border border-transparent"
    >
      {/* Ícono Sol / Luna */}
      <span className="w-5 h-5 text-brand-gold flex items-center justify-center shrink-0">
        {dark ? (
          /* Sol — volver a claro */
          <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
          </svg>
        ) : (
          /* Luna — ir a oscuro */
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
          </svg>
        )}
      </span>

      <span>{dark ? 'Modo Claro' : 'Modo Oscuro'}</span>

      {/* Interruptor estilo iPhone. Colores fijos (bg-[#fff], no bg-white): el
          estilo oscuro global pinta .bg-white de negro */}
      <span className="ml-auto" aria-hidden>
        <span
          className={`relative block h-[18px] w-[32px] rounded-full transition-colors duration-200 ${
            dark ? 'bg-[#34C759]' : 'bg-[#fff]/20'
          }`}
        >
          <span
            className={`absolute left-[2px] top-[2px] h-[14px] w-[14px] rounded-full bg-[#fff] shadow-[0_1px_3px_rgba(0,0,0,0.35)] transition-transform duration-200 ${
              dark ? 'translate-x-[14px]' : 'translate-x-0'
            }`}
          />
        </span>
      </span>
    </button>
  )
}

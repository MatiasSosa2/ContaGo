'use client'

import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [dark, setDark] = useState(false)

  // Al montar, leer preferencia guardada (por defecto: claro)
  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const isDark = saved === 'dark'
    setDark(isDark)
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
  }, [])

  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <button
      onClick={toggle}
      suppressHydrationWarning
      title={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className="print:hidden w-full flex items-center gap-3 px-4 py-2.5 rounded-sm text-xs font-medium uppercase tracking-wider transition-all
        text-gray-400 hover:text-gray-700 hover:bg-gray-50 border border-transparent hover:border-black/[0.07]"
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

      {/* Indicador visual de estado */}
      <span className="ml-auto">
        <span
          className={`inline-block w-7 h-3.5 rounded-full border transition-colors relative ${
            dark
              ? 'bg-brand-military border-brand-military'
              : 'bg-gray-200 border-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-transform ${
              dark ? 'translate-x-3.5' : 'translate-x-0.5'
            }`}
          />
        </span>
      </span>
    </button>
  )
}

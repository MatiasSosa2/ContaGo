'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Preferencias del navegador (localStorage) leídas sin efectos: en el servidor y en el primer
 * render valen `null`, y después el valor guardado. Cambiarlas avisa a todos los que la usan.
 */
const EVENTO = 'contago:stored-value'

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(EVENTO, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(EVENTO, onChange)
  }
}

function leer(key: string) {
  try { return localStorage.getItem(key) } catch { return null }
}

export function useStoredValue(key: string): [string | null, (value: string) => void] {
  const value = useSyncExternalStore(subscribe, () => leer(key), () => null)
  const set = useCallback((next: string) => {
    try { localStorage.setItem(key, next) } catch {}
    window.dispatchEvent(new Event(EVENTO))
  }, [key])
  return [value, set]
}

const noop = () => () => {}

/** true recién después de hidratar en el navegador (para lo que depende de la fecha/hora local) */
export function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false)
}

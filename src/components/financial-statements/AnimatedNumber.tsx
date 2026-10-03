'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Número que "cuenta" hasta su nuevo valor cuando cambia (como la app Salud del iPhone).
 * Recibe el formato para mostrar cada cuadro de la animación.
 */
export default function AnimatedNumber({ value, format, duration = 600, desde }: {
  value: number
  format: (v: number) => string
  duration?: number
  /** Si está, al montar cuenta desde este valor (ej. 0) hasta value */
  desde?: number
}) {
  const [shown, setShown] = useState(desde ?? value)
  const fromRef = useRef(desde ?? value)

  useEffect(() => {
    const from = fromRef.current
    if (from === value) return
    // Sin animación si el usuario pidió reducir el movimiento
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      fromRef.current = value
      const id = requestAnimationFrame(() => setShown(value))
      return () => cancelAnimationFrame(id)
    }
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out
      setShown(from + (value - from) * eased)
      if (t < 1) frame = requestAnimationFrame(tick)
      else fromRef.current = value
    }
    frame = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame); fromRef.current = value }
  }, [value, duration])

  return <>{format(shown)}</>
}

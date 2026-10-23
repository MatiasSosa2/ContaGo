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
  // Lo que se ve en pantalla en cada momento: si la animación se corta (React monta el
  // componente dos veces, o cambia el valor a mitad de camino) sigue desde acá y no queda trabada
  const shownRef = useRef(desde ?? value)

  useEffect(() => {
    const from = shownRef.current
    if (from === value) return
    // Sin animación si el usuario pidió reducir el movimiento
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      const id = requestAnimationFrame(() => { shownRef.current = value; setShown(value) })
      return () => cancelAnimationFrame(id)
    }
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out
      const v = t < 1 ? from + (value - from) * eased : value
      shownRef.current = v
      setShown(v)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return <>{format(shown)}</>
}

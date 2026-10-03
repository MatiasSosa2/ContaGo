'use client'

import { useEffect, useState } from 'react'
import AnimatedNumber from '@/components/financial-statements/AnimatedNumber'

// Último valor mostrado de cada tarjeta: sobrevive al cambio de período (la página se monta de
// nuevo), así el número cuenta desde el monto anterior hasta el nuevo.
const ultimos = new Map<string, number>()

const fmt = (v: number) => '$' + Math.round(Math.abs(v)).toLocaleString('es-AR')

/** Monto de una tarjeta del inicio que "cuenta" del valor del período anterior al nuevo */
export default function KpiNumber({ id, value, conSigno = false }: {
  id: string
  value: number
  /** Antepone "−" si es negativo */
  conSigno?: boolean
}) {
  // Se lee una sola vez al montar; después se guarda el valor nuevo para la próxima
  const [desde] = useState(() => ultimos.get(id))
  useEffect(() => { ultimos.set(id, value) }, [id, value])
  return (
    <AnimatedNumber
      value={value}
      desde={desde}
      duration={650}
      format={(v) => `${conSigno && v < -0.5 ? '−' : ''}${fmt(v)}`}
    />
  )
}

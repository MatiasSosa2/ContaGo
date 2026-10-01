'use client'

import { useEffect } from 'react'

/**
 * Al abrir el informe completo: despliega todos los renglones del cuadro y abre el diálogo
 * de impresión del navegador (ahí se elige "Guardar como PDF").
 */
export default function AutoPrint() {
  useEffect(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true })
    // Un respiro para que los gráficos y los desplegables terminen de dibujarse
    const t = setTimeout(() => window.print(), 1200)
    return () => clearTimeout(t)
  }, [])
  return null
}

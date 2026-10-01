'use client'

/**
 * Antes de llamar a window.print(), Recharts (ResponsiveContainer) tiene sus SVGs
 * medidos en píxeles por su ResizeObserver interno. Al cambiar al layout de impresión
 * el observer NO se re-dispara, dejando los gráficos en 0×0 o con dimensiones rotas.
 *
 * Solución: capturar las dimensiones reales del DOM, fijarlas inline como px, imprimir,
 * y revertir tras el evento afterprint.
 */
function fixChartsForPrint(): () => void {
  type SavedEl   = { el: HTMLElement;  w: string; h: string }
  type SavedSvg  = { svg: SVGElement;  w: string | null; h: string | null }

  const saved:    SavedEl[]  = []
  const savedSvg: SavedSvg[] = []

  // 1. Fijar dimensiones en los contenedores responsivos
  document.querySelectorAll<HTMLElement>('.recharts-responsive-container').forEach((el) => {
    const rect = el.getBoundingClientRect()
    saved.push({ el, w: el.style.width, h: el.style.height })
    el.style.width  = `${Math.round(rect.width  || 700)}px`
    el.style.height = `${Math.round(rect.height || 300)}px`
  })

  // 2. Fijar atributos width/height directamente en los SVG internos
  document.querySelectorAll<SVGElement>('.recharts-wrapper svg.recharts-surface').forEach((svg) => {
    const rect = svg.getBoundingClientRect()
    savedSvg.push({ svg, w: svg.getAttribute('width'), h: svg.getAttribute('height') })
    svg.setAttribute('width',  String(Math.round(rect.width  || 700)))
    svg.setAttribute('height', String(Math.round(rect.height || 300)))
  })

  // Retornar función de cleanup
  return () => {
    saved.forEach(({ el, w, h }) => { el.style.width = w; el.style.height = h })
    savedSvg.forEach(({ svg, w, h }) => {
      if (w) svg.setAttribute('width', w); else svg.removeAttribute('width')
      if (h) svg.setAttribute('height', h); else svg.removeAttribute('height')
    })
  }
}

export default function PrintButton() {
  function handlePrint() {
    const revert = fixChartsForPrint()

    // Revertir tras imprimir (o cancelar)
    const cleanup = () => {
      revert()
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)

    window.print()
  }

  return (
    <button
      onClick={handlePrint}
      aria-label="Exportar PDF"
      className="no-print flex items-center gap-1.5 rounded-full bg-black/[0.05] px-3.5 py-1.5 text-[13px] font-medium text-[#007AFF] transition hover:bg-black/[0.08] active:scale-[0.97] dark:bg-white/[0.08] dark:text-[#0A84FF] dark:hover:bg-white/[0.12]"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif' }}
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15" />
      </svg>
      {/* En celular queda solo el ícono */}
      <span className="hidden sm:inline">Exportar PDF</span>
    </button>
  )
}

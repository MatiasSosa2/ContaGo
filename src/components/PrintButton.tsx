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
      className="flex items-center gap-2 text-[9px] font-medium text-gray-500 uppercase tracking-[0.2em] hover:text-brand-military transition-colors border border-gray-200 px-3 py-2 bg-white hover:border-brand-military rounded-sm no-print"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
      </svg>
      Exportar PDF
    </button>
  )
}

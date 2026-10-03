'use client'

import { esDeTalles, type AtributoDef } from '@/lib/variantes'
import type { ArticuloVista, VarianteVista } from './tipos'

/** Columnas y filas de la cuadrícula: los talles van en columnas; si no hay, el atributo con menos valores */
export function ejesDeGrilla(atributos: AtributoDef[]): [AtributoDef, AtributoDef] | null {
  if (atributos.length !== 2) return null
  const [a, b] = atributos
  if (esDeTalles(a) && !esDeTalles(b)) return [a, b]
  if (esDeTalles(b) && !esDeTalles(a)) return [b, a]
  return a.valores.length <= b.valores.length ? [a, b] : [b, a]
}

/** Tono de la celda según el stock: vacío gris, poco ámbar, bien verde */
export function tonoStock(v: VarianteVista | undefined) {
  if (!v || v.stockActual <= 0) return 'bg-black/[0.035] text-[#AEAEB2] dark:bg-white/[0.05] dark:text-[#636366]'
  const umbral = v.alertaStock ?? 2
  if (v.stockActual <= umbral) return 'bg-[#FF9F0A]/[0.14] text-[#C93400] dark:bg-[#FF9F0A]/20 dark:text-[#FFB340]'
  return 'bg-[#34C759]/[0.12] text-[#248A3D] dark:bg-[#30D158]/[0.16] dark:text-[#30D158]'
}

/**
 * Cuadrícula de stock talle × color (artículos con dos atributos). Tocar una celda elige esa variante.
 */
export default function StockGrid({ articulo, seleccionada, onElegir, compacta = false }: {
  articulo: ArticuloVista
  seleccionada?: string | null
  onElegir?: (v: VarianteVista) => void
  compacta?: boolean
}) {
  const ejes = ejesDeGrilla(articulo.atributos)
  if (!ejes) return null
  const [col, fila] = ejes
  const buscar = (vf: string, vc: string) =>
    articulo.variantes.find((v) => v.valores?.[fila.nombre] === vf && v.valores?.[col.nombre] === vc)
  const celda = compacta ? 'h-6 text-[11px]' : 'h-8 text-[12px]'

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-[3px]" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th className={compacta ? 'w-20' : 'w-24'} />
            {col.valores.map((vc) => (
              <th key={vc} className="truncate pb-0.5 text-center text-[11px] font-normal text-[#8E8E93]">{vc}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fila.valores.map((vf) => (
            <tr key={vf}>
              <td className="truncate pr-1 text-[12px] text-[#3C3C43] dark:text-[#EBEBF5]/80">{vf}</td>
              {col.valores.map((vc) => {
                const v = buscar(vf, vc)
                const activa = !!v && v.id === seleccionada
                return (
                  <td key={vc} className="p-0">
                    <button
                      type="button"
                      disabled={!v || !onElegir}
                      onClick={(e) => { e.stopPropagation(); if (v) onElegir?.(v) }}
                      title={v ? `${v.etiqueta}: ${v.stockActual.toLocaleString('es-AR')} en stock` : 'No existe'}
                      className={`flex w-full items-center justify-center rounded-md tabular-nums transition ${celda} ${tonoStock(v)} ${activa ? 'ring-2 ring-[#007AFF] dark:ring-[#0A84FF]' : ''} ${v && onElegir ? 'hover:brightness-95 active:scale-95' : ''}`}
                    >
                      {v ? v.stockActual.toLocaleString('es-AR', { maximumFractionDigits: 1 }) : '—'}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

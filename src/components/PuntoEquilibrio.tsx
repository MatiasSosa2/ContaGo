'use client'

import { useState } from 'react'

const CURRENCY_SYMBOL: Record<string, string> = { ARS: '$', USD: 'US$' }

function fmt(v: number, cur = 'ARS') {
  return `${CURRENCY_SYMBOL[cur] || '$'}${v.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`
}

interface Props {
  ventas: number
  cmv: number
  cur?: string
}

export default function PuntoEquilibrio({ ventas, cmv, cur = 'ARS' }: Props) {
  const [costosFijosInput, setCostosFijosInput] = useState('')
  const costosFijos = parseFloat(costosFijosInput.replace(/\./g, '').replace(',', '.')) || 0
  const sym = CURRENCY_SYMBOL[cur] || '$'

  const margenBruto = ventas - cmv
  const margenContribucionPct = ventas > 0 ? margenBruto / ventas : 0
  const puntoEquilibrio = margenContribucionPct > 0 ? costosFijos / margenContribucionPct : null

  const cobertura = costosFijos > 0 && puntoEquilibrio !== null
    ? (ventas / puntoEquilibrio) * 100
    : null

  return (
    <div className="bg-white/90 backdrop-blur-sm border border-gray-200/80 shadow-lg rounded-sm flex flex-col">
      {/* Header */}
      <div className="bg-brand-military px-5 py-3.5 rounded-t-sm flex items-center justify-between shrink-0">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-white">Punto de Equilibrio</h2>
        <span className="text-[9px] text-brand-military-light font-medium tracking-wide">Break-Even</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Input Costos Fijos */}
        <div>
          <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">
            Costos Fijos Mensuales ({cur})
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-gray-400">{sym}</span>
            <input
              type="number"
              min="0"
              value={costosFijosInput}
              onChange={e => setCostosFijosInput(e.target.value)}
              placeholder="0"
              className="flex-1 border border-gray-200 rounded-sm px-3 py-2 text-sm font-mono font-black text-gray-800 bg-gray-50 focus:outline-none focus:border-brand-military focus:bg-white transition-colors"
            />
          </div>
          <p className="text-[9px] text-gray-400 mt-1.5">Sueldos fijos, alquiler, servicios, seguros, etc.</p>
        </div>

        {/* Métricas derivadas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-gray-100 rounded-sm p-3 bg-brand-military-light/40">
            <p className="text-[9px] font-black uppercase tracking-widest text-brand-military mb-1">Margen de Contribución</p>
            <p className="text-lg font-black font-mono text-brand-military-dark">
              {(margenContribucionPct * 100).toFixed(1)}%
            </p>
            <p className="text-[9px] text-gray-400">{fmt(margenBruto, cur)}</p>
          </div>

          <div className="border border-gray-100 rounded-sm p-3 bg-gray-50">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Ventas Actuales</p>
            <p className="text-lg font-black font-mono text-gray-800">{fmt(ventas, cur)}</p>
            <p className="text-[9px] text-gray-400">CMV: {fmt(cmv, cur)}</p>
          </div>
        </div>

        {/* Resultado del PE */}
        {costosFijos > 0 ? (
          <div className="border border-gray-200 rounded-sm overflow-hidden">
            <div className="bg-brand-military px-4 py-3 flex justify-between items-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-brand-gold">Punto de Equilibrio</p>
              <p className="text-xl font-black font-mono text-white">
                {puntoEquilibrio !== null ? fmt(puntoEquilibrio, cur) : 'N/A'}
              </p>
            </div>
            {puntoEquilibrio !== null && (
              <div className="p-4 space-y-3">
                <p className="text-[9px] text-gray-500">
                  Necesitás vender <strong className="text-gray-700">{fmt(puntoEquilibrio, cur)}</strong> para cubrir todos tus costos fijos.
                </p>
                {/* Barra de cobertura */}
                {cobertura !== null && (
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Cobertura actual</span>
                      <span className={`text-[10px] font-black font-mono ${cobertura >= 100 ? 'text-brand-military-dark' : 'text-red-500'}`}>
                        {cobertura.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all ${cobertura >= 100 ? 'bg-brand-military' : 'bg-red-400'}`}
                        style={{ width: `${Math.min(cobertura, 100)}%` }}
                      />
                    </div>
                    {cobertura >= 100 ? (
                      <p className="text-[9px] text-brand-military-dark font-black mt-1.5 uppercase tracking-wide">
                        ✓ Superás el punto de equilibrio por {fmt(ventas - puntoEquilibrio, cur)}
                      </p>
                    ) : (
                      <p className="text-[9px] text-red-500 font-black mt-1.5 uppercase tracking-wide">
                        Faltan {fmt(puntoEquilibrio - ventas, cur)} para cubrir costos
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="border border-dashed border-gray-200 rounded-sm p-4 text-center">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
              Ingresá los costos fijos para calcular
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

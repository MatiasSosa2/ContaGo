import { getProductos } from '@/app/actions'
import AppHeader from '@/components/AppHeader'
import { requireBusinessContext } from '@/server/auth/require-business-context'
import StockClient from '@/components/StockClient'

export const dynamic = 'force-dynamic'

export default async function StockPage() {
  const sessionContext = await requireBusinessContext()
  const productos = await getProductos()

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto font-sans text-[#1F2937] dark:text-gray-100 min-h-screen bg-[#F7F9FB] dark:bg-black">

      {/* â•â• HEADER â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <AppHeader
        title="Inventario"
        sessionContext={sessionContext}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        }
      />

      {/* â•â• BARRA DE INFO â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div className="mb-6 flex items-center gap-3 rounded-xl px-4 py-3 bg-[#EAF7F0] dark:bg-[#0D1F14]">
        <div className="w-7 h-7 rounded-lg bg-[#D1FAE5] flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <p className="text-sm text-[#374151] dark:text-[#A0B0A8] leading-snug">
          GestionÃ¡ tu inventario de productos. HacÃ© clic en un producto para registrar entradas, salidas o ajustes de stock.
        </p>
      </div>

      {/* â•â• CONTENIDO PRINCIPAL â€” Client Component â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <StockClient initialProductos={productos as any} />
    </div>
  )
}

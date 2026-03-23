import { getCajasData } from '@/app/actions'
import AppHeader from '@/components/AppHeader'
import { requireBusinessContext } from '@/server/auth/require-business-context'
import CajasClient from '@/components/CajasClient'

export const dynamic = 'force-dynamic'

export default async function CajasPage() {
  const sessionContext = await requireBusinessContext()
  const data = await getCajasData()

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto font-sans text-[#1F2937] dark:text-gray-100 min-h-screen bg-[#F7F9FB] dark:bg-black">

      <AppHeader
        title="Cajas"
        icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
        sessionContext={sessionContext}
      />

      {/* ══ BARRA DE CONSEJO GENERAL ═════════════════════════════════════════ */}
      <div className="mb-6 flex items-center gap-3 rounded-xl px-4 py-3 bg-[#EAF7F0] dark:bg-[#0D1F14]">
        <div className="w-7 h-7 rounded-lg bg-[#D1FAE5] flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <p className="text-sm text-[#374151] leading-snug">{data.summaryMessage}</p>
      </div>

      {/* ══ CONTENIDO PRINCIPAL — Client Component ═══════════════════════════ */}
      <CajasClient data={data} />
    </div>
  )
}

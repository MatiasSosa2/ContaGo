import { getCreditosDeudas } from '@/app/actions'
import AppHeader from '@/components/AppHeader'
import { requireBusinessContext } from '@/server/auth/require-business-context'
import CreditosClient from '@/components/CreditosClient'

export const dynamic = 'force-dynamic'

export default async function CreditosPage() {
  const sessionContext = await requireBusinessContext()
  const data = await getCreditosDeudas()

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto font-sans text-[#1F2937] dark:text-gray-100 min-h-screen bg-[#F7F9FB] dark:bg-black">

      {/* ══ HEADER ═══════════════════════════════════════════════════════════ */}
      <AppHeader
        title="Créditos y Deudas"
        sessionContext={sessionContext}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
      />

      {/* ══ BARRA DE INFO ══════════════════════════════════════════════════════ */}
      <div className="mb-6 flex items-center gap-3 rounded-xl px-4 py-3 bg-[#EAF7F0] dark:bg-[#0D1F14]">
        <div className="w-7 h-7 rounded-lg bg-[#D1FAE5] flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-sm text-[#374151] dark:text-[#A0B0A8] leading-snug">
          Gestioná tus cuentas por cobrar (CxC) y cuentas por pagar (CxP). Marcá los registros como cobrados o pagados al recibirlos.
        </p>
      </div>

      {/* ══ CONTENIDO PRINCIPAL — Client Component ═══════════════════════════ */}
      <CreditosClient creditos={data as any} />
    </div>
  )
}

import { getBienesDeUso, getAccounts } from '@/app/actions'
import AppHeader from '@/components/AppHeader'
import { requireBusinessContext } from '@/server/auth/require-business-context'
import BienesClient from '@/components/BienesClient'

export const dynamic = 'force-dynamic'

export default async function BienesPage() {
  const sessionContext = await requireBusinessContext()
  const [bienes, accounts] = await Promise.all([getBienesDeUso(), getAccounts()])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto font-sans text-[#1F2937] dark:text-gray-100 min-h-screen bg-[#F7F9FB] dark:bg-black">

      <AppHeader
        title="Bienes de Uso"
        sessionContext={sessionContext}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        }
      />

      {/* BARRA INFO */}
      <div className="mb-6 flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-[#EAF7F0] dark:bg-[#0D1F14]">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#D1FAE5] flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-sm text-[#374151] dark:text-[#A0B0A8] leading-snug">
            Activos fijos con seguimiento de depreciación automática. Se crean al registrar un gasto marcado como bien de uso.
          </p>
        </div>
        {/* Botón nueva carga manual — requiere Client, lo maneja BienesClient internamente */}
      </div>

      {/* CONTENIDO */}
      <BienesClient initialBienes={bienes as any} initialAccounts={accounts as any} />
    </div>
  )
}

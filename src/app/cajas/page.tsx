import { getAllTransactions, getCajasData } from '@/app/actions'
import AppHeader from '@/components/AppHeader'
import { requireBusinessContext } from '@/server/auth/require-business-context'
import CajasClient from '@/components/CajasClient'

export const dynamic = 'force-dynamic'

export default async function CajasPage() {
  const sessionContext = await requireBusinessContext()
  const [data, movements] = await Promise.all([getCajasData(), getAllTransactions()])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto font-sans text-[#1F2937] dark:text-gray-100 min-h-screen bg-[#F7F9FB] dark:bg-black">

      <AppHeader
        title="Cajas"
        icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
        sessionContext={sessionContext}
      />

      {/* ══ CONTENIDO PRINCIPAL — Client Component ═══════════════════════════ */}
      <CajasClient data={data} movements={movements} />
    </div>
  )
}

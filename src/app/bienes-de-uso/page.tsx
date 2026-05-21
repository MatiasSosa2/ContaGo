import AppHeader from '@/components/AppHeader'
import { requireBusinessContext } from '@/server/auth/require-business-context'
import BienesDeUsoClient from '@/components/BienesDeUsoClient'
import { getBienesDeUso } from '@/app/actions'

export const dynamic = 'force-dynamic'

export default async function BienesDeUsoPage() {
  const sessionContext = await requireBusinessContext()
  const bienes = await getBienesDeUso()

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto font-sans text-[#1F2937] dark:text-gray-100 min-h-screen bg-[#F7F9FB] dark:bg-black">
      <AppHeader
        title="Bienes de uso"
        sessionContext={sessionContext}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 7v14m18-14v14M5 21V7m14 14V7M5 7l7-4 7 4M9 21v-6h6v6" />
          </svg>
        }
      />
      <BienesDeUsoClient initialBienes={bienes as never[]} />
    </div>
  )
}

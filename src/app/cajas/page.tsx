import { getCajasData } from '@/app/actions'
import DashboardUserMenu from '@/components/DashboardUserMenu'
import { requireBusinessContext } from '@/server/auth/require-business-context'
import CajasClient from '@/components/CajasClient'

export const dynamic = 'force-dynamic'

export default async function CajasPage() {
  const sessionContext = await requireBusinessContext()
  const data = await getCajasData()

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto font-sans text-[#1F2937] min-h-screen" style={{ background: '#F7F9FB' }}>

      {/* ══ HEADER ═══════════════════════════════════════════════════════════ */}
      <header className="mb-5 border border-stone-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:mb-6 lg:-mx-8 lg:-mt-8 lg:mb-6 lg:border-x-0 lg:border-t-0 lg:shadow-none">
        <div className="px-4 py-4 sm:px-5 lg:min-h-[88px] lg:px-6 lg:py-0">
          <div className="flex flex-col gap-4 lg:h-full lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
              <span>Cajas</span>
              <span className="h-1 w-1 rounded-full bg-stone-300" />
              <span>{sessionContext.activeBusiness.name}</span>
              <span className="inline-flex items-center border border-[#d9cfba] bg-[#f6efe2] px-2 py-1 text-[10px] font-medium normal-case tracking-normal text-[#7a6850]">
                {sessionContext.activeBusiness.role === 'ADMIN' ? 'Administrador' : sessionContext.activeBusiness.role === 'COLLABORATOR' ? 'Colaborador' : 'Visualizador'}
              </span>
            </div>
            <DashboardUserMenu
              user={sessionContext.user}
              business={{
                name: sessionContext.activeBusiness.name,
                role: sessionContext.activeBusiness.role,
              }}
              authProvider={sessionContext.auth.provider}
            />
          </div>
        </div>
      </header>

      {/* ══ BARRA DE CONSEJO GENERAL ═════════════════════════════════════════ */}
      <div className="mb-6 flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: '#EAF7F0' }}>
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

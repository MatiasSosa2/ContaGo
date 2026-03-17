import { selectBusinessAndContinue } from '@/app/auth/actions'
import type { AppRole } from '@/server/auth/business-context'

const ROLE_LABEL: Record<AppRole, string> = {
  ADMIN: 'Administrador',
  COLLABORATOR: 'Colaborador',
  VIEWER: 'Visualizacion',
}

export default function BusinessSelectorPanel({
  businesses,
  currentBusinessId,
  error,
}: {
  businesses: Array<{
    id: string
    name: string
    role: AppRole
  }>
  currentBusinessId?: string | null
  error?: string
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-600">
        Selecciona con que negocio quieres trabajar en esta sesion. Luego podras cambiarlo nuevamente cuando la experiencia multiempresa quede expuesta dentro del producto.
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {businesses.map((business) => (
          <form key={business.id} action={selectBusinessAndContinue}>
            <input type="hidden" name="businessId" value={business.id} />
            <button
              type="submit"
              className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                currentBusinessId === business.id
                  ? 'border-brand-military bg-brand-military-light'
                  : 'border-gray-200 bg-white hover:border-brand-military/60 hover:bg-brand-military-light/40'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{business.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-400">{ROLE_LABEL[business.role]}</p>
                </div>
                {currentBusinessId === business.id && (
                  <span className="rounded-full bg-brand-military px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                    Actual
                  </span>
                )}
              </div>
            </button>
          </form>
        ))}
      </div>
    </div>
  )
}
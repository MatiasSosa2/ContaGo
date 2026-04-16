import DashboardUserMenu from '@/components/DashboardUserMenu'
import ThemeToggle from '@/components/ThemeToggle'

type Role = 'ADMIN' | 'COLLABORATOR' | 'VIEWER'
type Provider = 'google' | 'apple' | 'credentials' | 'mock'

type AppHeaderProps = {
  title: string
  icon?: React.ReactNode
  showRoleBadge?: boolean
  sessionContext: {
    user: { name?: string | null; email: string; image?: string | null; emailVerified: boolean }
    activeBusiness: { name: string; role: Role }
    auth: { provider: Provider }
  }
  /** Elementos extra en la derecha (ej: PeriodFilter, PrintButton) */
  actions?: React.ReactNode
}

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  COLLABORATOR: 'Colaborador',
  VIEWER: 'Visualizador',
}

export default function AppHeader({ title, icon, sessionContext, actions, showRoleBadge = true }: AppHeaderProps) {
  const { user, activeBusiness, auth } = sessionContext

  return (
    <header className="
      sticky top-0 z-20
      mb-5 md:mb-6
      border border-stone-200 dark:border-white/[0.05]
      bg-white/95 dark:bg-[#11171d]/95
      backdrop-blur-md
      shadow-[0_1px_0_0_rgba(0,0,0,0.05)] dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)]
      overflow-x-clip
      lg:-mt-8 lg:mb-6
    ">
      <div className="px-4 py-3 sm:px-5 lg:px-8 lg:min-h-[72px] flex items-center justify-between gap-4 lg:h-[72px]">

        {/* ── LEFT: Logo · Separador · Ícono · Título · Negocio · Rol ─────── */}
        <div className="flex items-center gap-3 min-w-0">

          {/* Logo mark */}
          <img
            src="/contago-mark.svg"
            alt="ContaGo"
            className="hidden sm:block h-7 w-7 shrink-0 select-none"
          />

          {/* Separador vertical */}
          <span className="hidden sm:block h-5 w-px bg-stone-200 dark:bg-white/10 shrink-0" />

          {/* Ícono de sección */}
          {icon && (
            <span className="text-stone-400 dark:text-stone-500 shrink-0 [&>svg]:w-[17px] [&>svg]:h-[17px]">
              {icon}
            </span>
          )}

          {/* Título + negocio */}
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-stone-900 dark:text-white leading-tight tracking-[-0.01em]">
              {title}
            </h1>
            <p className="text-[11px] font-normal text-stone-400 dark:text-stone-500 leading-none mt-[3px] truncate">
              {activeBusiness.name}
            </p>
          </div>

          {/* Badge de rol */}
          {showRoleBadge && (
            <span className="hidden md:inline-flex shrink-0 items-center border border-[#d9cfba] dark:border-[#3d3020] bg-[#f6efe2] dark:bg-[#1c1206] px-2 py-1 text-[10px] font-medium text-[#7a6850] dark:text-[#c9a870] rounded-sm select-none">
              {ROLE_LABELS[activeBusiness.role]}
            </span>
          )}
        </div>

        {/* ── RIGHT: Acciones opcionales · ThemeToggle · UserMenu ──────────── */}
        <div className="flex items-center gap-1.5 shrink-0">
          {actions && (
            <div className="flex items-center gap-1.5 mr-1">
              {actions}
            </div>
          )}
          <ThemeToggle compact />
          <DashboardUserMenu
            user={user}
            business={{ name: activeBusiness.name, role: activeBusiness.role }}
            authProvider={auth.provider}
          />
        </div>

      </div>
    </header>
  )
}

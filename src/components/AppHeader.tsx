import ThemeToggle from '@/components/ThemeToggle'

type Role = 'ADMIN' | 'COLLABORATOR' | 'VIEWER'
type Provider = 'google' | 'apple' | 'credentials' | 'mock'

type AppHeaderProps = {
  /** Opcional: título accesible (no se muestra visualmente). */
  title?: string
  /** Ícono opcional como indicador visual de sección. */
  icon?: React.ReactNode
  showRoleBadge?: boolean
  sessionContext: {
    user: { name?: string | null; email: string; image?: string | null; emailVerified: boolean }
    activeBusiness: { name: string; role: Role }
    auth: { provider: Provider }
  }
  /** Elementos extra (ej: PeriodSelector, PrintButton). Ocupan el área principal del header. */
  actions?: React.ReactNode
}

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  COLLABORATOR: 'Colaborador',
  VIEWER: 'Visualizador',
}

function getInitials(name?: string | null, email?: string) {
  const source = name?.trim() || email || 'CG'
  const words = source.split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase()
  }
  return source.slice(0, 2).toUpperCase()
}

function UserInfoCard({
  user,
  business,
}: {
  user: AppHeaderProps['sessionContext']['user']
  business: AppHeaderProps['sessionContext']['activeBusiness']
}) {
  const displayName = user.name?.trim() || user.email.split('@')[0]
  return (
    <div
      className="
        hidden sm:flex items-center gap-2.5 shrink-0
        rounded-2xl
        border border-stone-200 dark:border-white/[0.06]
        bg-white dark:bg-[#0d0e10]
        shadow-[0_4px_18px_rgba(15,23,42,0.05)] dark:shadow-[0_10px_28px_rgba(0,0,0,0.32)]
        px-2.5 py-1.5
      "
      title={`${displayName} · ${business.name} · ${ROLE_LABELS[business.role]}`}
    >
      {user.image ? (
        <img
          src={user.image}
          alt={`Avatar de ${displayName}`}
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1B4332] text-[11px] font-semibold text-[#D8F3DC]">
          {getInitials(user.name, user.email)}
        </div>
      )}
      <div className="min-w-0 leading-tight">
        <p className="truncate max-w-[160px] text-[12px] font-semibold text-stone-800 dark:text-stone-100">
          {displayName}
        </p>
        <p className="truncate max-w-[160px] text-[10.5px] font-medium text-[#1B4332] dark:text-[#9AC7A8]">
          {business.name}
        </p>
      </div>
    </div>
  )
}

export default function AppHeader({ title, icon, actions, sessionContext }: AppHeaderProps) {
  return (
    <header
      aria-label={title}
      className="
        sticky top-0 z-30
        -mx-4 sm:-mx-6 lg:-mx-8
        -mt-4 sm:-mt-6 lg:-mt-8
        mb-5 md:mb-6
        rounded-t-none rounded-b-2xl
        border-x border-b border-stone-200 dark:border-white/[0.06]
        bg-white/90 dark:bg-[#11171d]/90
        backdrop-blur-xl
        shadow-[0_4px_18px_rgba(15,23,42,0.05)] dark:shadow-[0_10px_28px_rgba(0,0,0,0.32)]
        overflow-visible
      "
    >
      <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4 lg:gap-4 lg:px-5 lg:py-3">

        {/* ── Ícono opcional (indicador visual de sección) ─── */}
        {icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F1F5F2] text-[#1B4332] dark:bg-white/[0.06] dark:text-[#9AC7A8] [&>svg]:h-[18px] [&>svg]:w-[18px]">
            {icon}
          </span>
        )}

        {/* ── Acciones (PeriodSelector, PrintButton, etc.) ─── */}
        <div className="min-w-0 flex-1">
          {actions}
        </div>

        {/* ── Info del usuario (card del mismo estilo que las demás) ─── */}
        <UserInfoCard
          user={sessionContext.user}
          business={sessionContext.activeBusiness}
        />

        {/* ── ThemeToggle ─── */}
        <div className="flex shrink-0 items-center gap-1.5">
          <ThemeToggle compact />
        </div>

      </div>
    </header>
  )
}

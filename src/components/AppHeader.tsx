
import Link from 'next/link'

type Role = 'ADMIN' | 'COLLABORATOR' | 'VIEWER'
type Provider = 'google' | 'apple' | 'azure-ad' | 'credentials' | 'mock'

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
        hidden min-h-11 lg:flex items-center gap-2.5 shrink-0
        rounded-xl
        border border-[var(--ui-border)]
        bg-[var(--ui-header)]
        shadow-[0_6px_22px_rgba(15,23,42,0.06)] dark:shadow-[0_10px_28px_rgba(0,0,0,0.32)]
        px-2.5 py-1.5
      "
      title={`${displayName} · ${business.name} · ${ROLE_LABELS[business.role]}`}
    >
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto de Google/Microsoft: dominio variable, no pasa por next/image
        <img
          src={user.image}
          alt={`Avatar de ${displayName}`}
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ui-avatar-bg)] text-[11px] font-semibold text-[var(--ui-avatar-text)]">
          {getInitials(user.name, user.email)}
        </div>
      )}
      <div className="min-w-0 leading-tight">
        <p className="truncate max-w-[160px] text-[12px] font-semibold text-[var(--ui-label)]">
          {displayName}
        </p>
        <p className="truncate max-w-[160px] text-[10.5px] font-medium text-[var(--ui-accent-text)]">
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
        executive-shell premium-masthead
        sticky top-0 z-30
        -mx-4 sm:-mx-6 lg:-mx-8
        -mt-4 sm:-mt-6 lg:-mt-8
        mb-5 md:mb-6
        rounded-t-none rounded-b-2xl
        overflow-visible
        bg-[var(--surface)]
      "
    >
      <div className="app-header-layout flex flex-col gap-3 px-4 py-3 sm:px-5 lg:min-h-[86px] lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:px-7">
        <div className="flex min-w-0 items-center gap-3 lg:max-w-[min(28vw,340px)]">
          {icon && (
            <span className="premium-masthead-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--ui-accent-soft)] text-[var(--ui-accent-text)] [&>svg]:h-[18px] [&>svg]:w-[18px]">
              {icon}
            </span>
          )}
          {title && <h1 className="truncate text-[19px] font-semibold tracking-[-0.035em] text-[var(--ui-label)] sm:text-[22px]">{title}</h1>}
        </div>

        <div className="app-header-controls flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:flex-1 lg:flex-nowrap lg:gap-3">
          {actions && <div className="app-header-actions w-full min-w-0 sm:flex-1 lg:w-auto lg:max-w-[min(52vw,680px)]">{actions}</div>}
          <Link
            href="/auth/change-password"
            className="hidden min-h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-[var(--ui-border)] px-3 text-xs font-medium text-[var(--ui-accent-text)] transition hover:bg-[var(--ui-accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ui-accent-text)] lg:inline-flex"
          >
            Seguridad
          </Link>
          <UserInfoCard
            user={sessionContext.user}
            business={sessionContext.activeBusiness}
          />
        </div>
        {/* El modo oscuro está en el pie del panel izquierdo */}
      </div>
    </header>
  )
}

import AccountMenu, { type AccountProvider, type AccountRole } from './account/AccountMenu'

type AppHeaderProps = {
  /** Opcional: título accesible (no se muestra visualmente). */
  title?: string
  /** Ícono opcional como indicador visual de sección. */
  icon?: React.ReactNode
  showRoleBadge?: boolean
  sessionContext: {
    user: { name?: string | null; email: string; image?: string | null; emailVerified: boolean }
    activeBusiness: { id?: string; name: string; role: AccountRole }
    businesses?: Array<{ id: string; name: string; role: AccountRole }>
    auth: { provider: AccountProvider }
  }
  /** Elementos extra (ej: PeriodSelector, PrintButton). Ocupan el área principal del header. */
  actions?: React.ReactNode
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
      <div className="app-header-layout flex flex-col gap-3 px-4 py-3 sm:px-5 lg:grid lg:min-h-[86px] lg:grid-cols-[minmax(max-content,1fr)_minmax(0,680px)_minmax(max-content,1fr)] lg:items-center lg:gap-6 lg:px-7">
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <span className="premium-masthead-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--ui-accent-soft)] text-[var(--ui-accent-text)] [&>svg]:h-[18px] [&>svg]:w-[18px]">
              {icon}
            </span>
          )}
          {title && <h1 className="truncate text-[19px] font-semibold tracking-[-0.035em] text-[var(--ui-label)] sm:text-[22px]">{title}</h1>}
        </div>

        <div className="app-header-controls flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:contents">
          {actions && <div className="app-header-actions w-full min-w-0 sm:flex-1 lg:col-start-2">{actions}</div>}
          {/* Menú de la cuenta: Mi cuenta (perfil y seguridad), negocios, equipo, integraciones */}
          <div className="lg:col-start-3 lg:justify-self-end">
            <AccountMenu
              user={sessionContext.user}
              business={sessionContext.activeBusiness}
              businesses={sessionContext.businesses?.map((b) => ({ id: b.id, name: b.name, role: b.role }))}
              provider={sessionContext.auth.provider}
            />
          </div>
        </div>
        {/* El modo oscuro está en el pie del panel izquierdo */}
      </div>
    </header>
  )
}

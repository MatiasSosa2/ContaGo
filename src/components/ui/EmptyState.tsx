import type { ReactNode } from 'react'

/**
 * Estado vacío único del sistema: ícono, frase corta y (opcional) acción primaria.
 * Enseña qué hacer en vez de solo decir que no hay datos.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
}) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'px-4 py-8' : 'px-6 py-10'}`}>
      {icon && (
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-100)] text-[var(--brand-700)] dark:bg-[var(--brand-900)] dark:text-[var(--brand-300)]">
          {icon}
        </span>
      )}
      <p className={`${icon ? 'mt-3' : ''} text-[15px] font-semibold text-[var(--text)]`}>{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-[13px] leading-5 text-[var(--text-tertiary)]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

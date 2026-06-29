// PageHeader — slots: left, center, right.
// Escalável: cada slot aceita qualquer ReactNode.

interface PageHeaderProps {
  left?: React.ReactNode
  center?: React.ReactNode
  right?: React.ReactNode
  className?: string
}

export function PageHeader({ left, center, right, className = '' }: PageHeaderProps) {
  return (
    <header
      role="banner"
      className={`flex items-center justify-between mb-6 min-h-[44px] ${className}`}
    >
      {/* Left slot — título/back action */}
      <div className="flex-1 min-w-0">
        {left}
      </div>

      {/* Center slot — logo ou tabs */}
      {center && (
        <div className="flex-shrink-0 px-3">
          {center}
        </div>
      )}

      {/* Right slot — CTAs, ícones de ação */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {right}
      </div>
    </header>
  )
}

// Convenience: título padrão para a maioria das páginas
interface PageTitleProps {
  eyebrow?: string
  title: string
}

export function PageTitle({ eyebrow, title }: PageTitleProps) {
  return (
    <div>
      {eyebrow && (
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
          {eyebrow}
        </span>
      )}
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight leading-tight">
        {title}
      </h1>
    </div>
  )
}

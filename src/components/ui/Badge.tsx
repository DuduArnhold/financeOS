// Badge — pill de status/categoria com suporte a cor customizada ou variante semântica.

type BadgeVariant = 'default' | 'success' | 'danger' | 'warning' | 'info' | 'custom'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  color?: string   // hex/hsl para variante 'custom'
  dot?: boolean
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-slate-800/80 text-slate-300 border-slate-700/50',
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  danger:  'bg-rose-500/15 text-rose-400 border-rose-500/20',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  info:    'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  custom:  '',
}

export function Badge({ children, variant = 'default', color, dot = false, className = '' }: BadgeProps) {
  const isCustom = variant === 'custom' && color

  const style = isCustom
    ? { backgroundColor: `${color}15`, color: color, borderColor: `${color}30` }
    : {}

  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
        isCustom ? '' : variantStyles[variant],
        className,
      ].join(' ')}
      style={style}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={isCustom ? { backgroundColor: color } : {}}
        />
      )}
      {children}
    </span>
  )
}

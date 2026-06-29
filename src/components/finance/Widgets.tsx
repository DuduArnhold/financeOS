'use client'

// KPIWidget — card de métrica mensurável (saldo, receitas, despesas).
// Usa Card como base e AnimatedNumber para o valor.

import { Card } from '@/components/ui/Card'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'

interface KPIWidgetProps {
  title: string
  value: number
  prefix?: string
  icon: React.ReactNode
  accentClass?: string       // cor do ícone e valor (ex: 'text-emerald-400')
  glowClass?: string         // glow de fundo (ex: 'bg-emerald-500/5')
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  decimals?: number
  children?: React.ReactNode // slot para conteúdo extra (ex: sparkline)
  className?: string
}

export function KPIWidget({
  title,
  value,
  prefix = '',
  icon,
  accentClass = 'text-indigo-400',
  glowClass   = 'bg-indigo-500/5',
  trend,
  trendValue,
  decimals = 2,
  children,
  className = '',
}: KPIWidgetProps) {
  return (
    <Card animate className={`p-5 relative overflow-hidden ${className}`}>
      {/* Background glow */}
      <div className={`absolute top-0 right-0 w-24 h-24 ${glowClass} rounded-full blur-2xl pointer-events-none`} />

      <div className="flex items-center gap-2 text-[var(--color-text-secondary)] mb-2">
        <span className={accentClass}>{icon}</span>
        <span className="text-xs font-medium truncate">{title}</span>
      </div>

      <div className={`text-2xl font-extrabold tracking-tight ${accentClass}`}>
        <AnimatedNumber value={value} prefix={prefix} decimals={decimals} />
      </div>

      {trend && trendValue && (
        <div className={`mt-1 text-[11px] font-semibold ${
          trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-slate-400'
        }`}>
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
        </div>
      )}

      {children}
    </Card>
  )
}

// InfoWidget — informação contextual (próxima conta, última movimentação, meta).
// Semanticamente diferente de KPI: não é uma métrica, é um detalhe informativo.

interface InfoWidgetProps {
  title: string
  icon: React.ReactNode
  accentClass?: string
  glowClass?: string
  children: React.ReactNode  // conteúdo totalmente customizável
  className?: string
}

export function InfoWidget({
  title,
  icon,
  accentClass = 'text-slate-400',
  glowClass   = 'bg-slate-500/5',
  children,
  className = '',
}: InfoWidgetProps) {
  return (
    <Card animate className={`p-5 relative overflow-hidden ${className}`}>
      <div className={`absolute top-0 right-0 w-20 h-20 ${glowClass} rounded-full blur-2xl pointer-events-none`} />
      <div className="flex items-center gap-2 text-[var(--color-text-secondary)] mb-3">
        <span className={accentClass}>{icon}</span>
        <span className="text-xs font-medium">{title}</span>
      </div>
      {children}
    </Card>
  )
}

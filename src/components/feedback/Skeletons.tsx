// Skeletons — componentes de carregamento por forma de conteúdo.
// Nunca usar spinner onde um skeleton pode representar a forma real.

interface SkeletonProps {
  className?: string
}

// Bloco de texto — uma linha
export function SkeletonText({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`h-3 rounded-full skeleton-shimmer ${className}`}
    />
  )
}

// Avatar circular
export function SkeletonAvatar({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-full skeleton-shimmer aspect-square ${className}`}
    />
  )
}

// Card de KPI / stat completo
export function SkeletonCard({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      aria-label="Carregando..."
      className={`glass-card rounded-2xl p-5 space-y-3 ${className}`}
    >
      <div className="flex items-center gap-2">
        <SkeletonAvatar className="w-8 h-8" />
        <SkeletonText className="w-24" />
      </div>
      <SkeletonText className="w-32 h-5" />
      <SkeletonText className="w-16 h-3" />
    </div>
  )
}

// Linha de tabela / item de lista
export function SkeletonTable({ rows = 4, className = '' }: { rows?: number; className?: string }) {
  return (
    <div aria-hidden="true" aria-label="Carregando..." className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <SkeletonAvatar className="w-9 h-9 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonText className="w-3/4" />
            <SkeletonText className="w-1/2" />
          </div>
          <SkeletonText className="w-16 h-4" />
        </div>
      ))}
    </div>
  )
}

// Skeleton de gráfico (placeholder para Sprint 5+)
export function SkeletonChart({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`glass-card rounded-2xl p-5 ${className}`}
    >
      <SkeletonText className="w-24 mb-4" />
      <div className="flex items-end gap-2 h-24">
        {[60, 40, 75, 50, 90, 35, 65].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-lg skeleton-shimmer"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  )
}

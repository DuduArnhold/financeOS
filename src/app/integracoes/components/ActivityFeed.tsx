'use client'

import React from 'react'
import { Card } from '@/components/ui/Card'
import type { ActivityItemDTO } from '@/platform/integrations/contracts'
import { CheckCircle2, XCircle, AlertCircle, Info, RefreshCw } from 'lucide-react'

const iconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
  'check-circle': CheckCircle2,
  'x-circle':     XCircle,
  'alert-circle': AlertCircle,
  'info':         Info,
}

interface ActivityFeedProps {
  activities: ActivityItemDTO[]
  onRefresh?: () => void
  loading?: boolean
}

export function ActivityFeed({ activities, onRefresh, loading = false }: ActivityFeedProps) {
  const getRelativeTime = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime()
    const diffMin = Math.round(diffMs / 60000)
    const diffHr = Math.round(diffMin / 60)

    if (diffMin < 1) return 'agora'
    if (diffMin < 60) return `${diffMin} min`
    if (diffHr < 24) return `${diffHr} h`
    return new Date(isoString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  return (
    <Card className="p-5 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">
          Atividade Recente
        </h3>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            aria-label="Atualizar atividade"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Nenhuma atividade registrada. Dispare um webhook para iniciar.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((item) => {
            const Icon = iconComponents[item.icon] || Info

            return (
              <div
                key={item.id}
                className="flex items-center justify-between py-2 border-b border-slate-800/40 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  {/* Usa a classe injetada pelo ActivityFormatter */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${item.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--color-text-primary)] leading-tight">
                      {item.title}
                    </h4>
                    <span className="text-[10px] text-[var(--color-text-secondary)]">
                      {item.description}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-[var(--color-text-muted)] whitespace-nowrap">
                  {getRelativeTime(item.occurredAt)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

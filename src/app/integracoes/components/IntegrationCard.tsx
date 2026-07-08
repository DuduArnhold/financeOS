'use client'

import React from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { ConnectorSummaryDTO } from '@/platform/integrations/contracts'
import { Plug, ShoppingCart, HelpCircle, Calendar, RefreshCw, AlertTriangle } from 'lucide-react'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'plug': Plug,
  'shopping-cart': ShoppingCart,
}

interface IntegrationCardProps {
  connector: ConnectorSummaryDTO
  onConfigure?: (origin: string) => void
}

export function IntegrationCard({ connector, onConfigure }: IntegrationCardProps) {
  const IconComponent = iconMap[connector.icon] || HelpCircle

  const statusLabel =
    connector.status === 'connected' ? 'Conectado'
    : connector.status === 'degraded' ? 'Com Falhas'
    : 'Não configurado'

  const statusVariant =
    connector.status === 'connected' ? 'success'
    : connector.status === 'degraded' ? 'warning'
    : 'default'

  // Formata receita importada em Real brasileiro
  const revenueFormatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(connector.totalRevenue)

  // Calcula tempo relativo simples para o lastEventAt
  const getRelativeTime = (isoString: string | null) => {
    if (!isoString) return 'Nunca ativo'
    const diffMs = Date.now() - new Date(isoString).getTime()
    const diffMin = Math.round(diffMs / 60000)
    const diffHr = Math.round(diffMin / 60)
    const diffDays = Math.round(diffHr / 24)

    if (diffMin < 1) return 'agora mesmo'
    if (diffMin < 60) return `há ${diffMin} ${diffMin === 1 ? 'minuto' : 'minutos'}`
    if (diffHr < 24) return `há ${diffHr} ${diffHr === 1 ? 'hora' : 'horas'}`
    return `há ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`
  }

  return (
    <Card hover glow className="p-5 overflow-hidden relative group">
      {/* Indicador de status com pulso para conectado */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5">
        <Badge variant={statusVariant} dot={connector.status === 'connected'}>
          {statusLabel}
        </Badge>
      </div>

      {/* Ícone e Cabeçalho */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform duration-180">
          <IconComponent className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-semibold text-base text-[var(--color-text-primary)] leading-tight">
            {connector.name}
          </h3>
          <span className="text-[10px] text-[var(--color-text-secondary)]">
            Versão {connector.version}.0
          </span>
        </div>
      </div>

      {/* Métricas e Detalhes */}
      {connector.status !== 'not_configured' ? (
        <div className="space-y-2 mb-4 pt-1 border-t border-slate-800/40">
          <div className="flex justify-between items-center text-xs">
            <span className="text-[var(--color-text-secondary)]">Último evento</span>
            <span className="font-medium text-[var(--color-text-primary)] flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              {getRelativeTime(connector.lastEventAt)}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-[var(--color-text-secondary)]">Processados</span>
            <span className="font-semibold text-[var(--color-text-primary)]">
              {connector.eventsCount}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-[var(--color-text-secondary)]">Receita importada</span>
            <span className="font-semibold text-emerald-400">
              {revenueFormatted}
            </span>
          </div>
          {connector.failuresCount > 0 && (
            <div className="flex justify-between items-center text-xs text-rose-400 bg-rose-500/5 p-1 rounded-lg">
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Falhas detectadas
              </span>
              <span className="font-bold">{connector.failuresCount}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="h-[92px] flex items-center justify-center text-center p-3 mb-4 rounded-xl border border-dashed border-slate-800 bg-slate-900/10">
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            Plataforma pronta para integração. Clique abaixo para configurar mapeamentos e chaves de API.
          </p>
        </div>
      )}

      {/* Ação */}
      <button
        onClick={() => onConfigure?.(connector.origin)}
        className="w-full h-9 flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-xs font-semibold text-[var(--color-text-primary)] transition-all duration-120"
      >
        <RefreshCw className="w-3.5 h-3.5 text-slate-400 group-hover:rotate-180 transition-transform duration-300" />
        Configurar integração
      </button>
    </Card>
  )
}

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/context/ToastContext'
import { integrationClient } from '@/services/integration.client'
import { ShieldCheck, ShieldAlert, Activity, Heart, Clock, RefreshCw } from 'lucide-react'
import type { HealthStatusDTO, HealthComponentDTO } from '@/platform/integrations/contracts'

export function HealthCheckSection() {
  const [health, setHealth] = useState<HealthStatusDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const toast = useToast()

  const fetchHealth = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await integrationClient.getHealth()
      setHealth(data)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao verificar status de saúde do pipeline.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [toast])

  useEffect(() => {
    fetchHealth()
  }, [fetchHealth])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchHealth(true)
    toast.success('Métricas de diagnóstico atualizadas.')
  }

  const getStatusIcon = (status: HealthComponentDTO['status']) => {
    switch (status) {
      case 'ok':
        return <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30" />
      case 'degraded':
        return <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-lg shadow-amber-500/30 animate-pulse" />
      default:
        return <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-lg shadow-rose-500/30 animate-pulse" />
    }
  }

  const getStatusVariant = (status: HealthComponentDTO['status']) => {
    switch (status) {
      case 'ok':
        return 'success'
      case 'degraded':
        return 'warning'
      default:
        return 'danger'
    }
  }

  return (
    <Card className="p-5 mb-6">
      {/* Cabeçalho da seção de Diagnóstico */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">
              Status do Pipeline (Health Check)
            </h3>
            <span className="text-[10px] text-[var(--color-text-secondary)]">
              Disponibilidade e latência em tempo real dos serviços.
            </span>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          aria-label="Atualizar diagnóstico"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-10 w-full rounded-xl skeleton-shimmer" />
          <div className="h-10 w-full rounded-xl skeleton-shimmer" />
        </div>
      ) : health ? (
        <div className="space-y-4">
          {/* Status dos Componentes do Pipeline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {health.components.map((comp) => (
              <div
                key={comp.id}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/20"
              >
                <div className="flex items-center gap-2.5">
                  {getStatusIcon(comp.status)}
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--color-text-primary)]">
                      {comp.label}
                    </h4>
                    {comp.message && (
                      <span className="text-[9px] text-rose-400 block mt-0.5">{comp.message}</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {comp.version && (
                    <span className="text-[9px] font-mono text-slate-500 bg-slate-900 px-1 py-0.5 rounded">
                      v{comp.version}
                    </span>
                  )}
                  {comp.latencyMs !== null && (
                    <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">
                      {comp.latencyMs}ms
                    </span>
                  )}
                  <Badge variant={getStatusVariant(comp.status)}>
                    {comp.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {/* Resumo do Último Evento Processado */}
          {health.lastEventAt && (
            <div className="flex items-center justify-between p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-xs">
              <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>Último webhook processado</span>
              </div>
              <span className="font-semibold text-slate-300">
                {new Date(health.lastEventAt).toLocaleString('pt-BR')}
                {health.lastEventDurationMs !== null && ` (${health.lastEventDurationMs}ms)`}
              </span>
            </div>
          )}
        </div>
      ) : null}
    </Card>
  )
}

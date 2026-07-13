'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PageTitle } from '@/components/layout/PageHeader'
import { PullRefresh } from '@/components/mobile/PullRefresh'
import { IntegrationGrid } from './components/IntegrationGrid'
import { ActivityFeed } from './components/ActivityFeed'
import { ApiKeysSection } from './components/ApiKeysSection'
import { MappingSection } from './components/MappingSection'
import { HealthCheckSection } from './components/HealthCheckSection'
import { EventHistory } from './components/EventHistory'
import { EventDrawer } from './components/EventDrawer'
import { integrationClient } from '@/services/integration.client'
import IntegracoesLoading from './loading'
import type { ConnectorSummaryDTO, ActivityItemDTO } from '@/platform/integrations/contracts'
import { RefreshCw, LayoutGrid, Settings, History } from 'lucide-react'

export default function IntegracoesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const toast = useToast()

  const [connectors, setConnectors] = useState<ConnectorSummaryDTO[]>([])
  const [activities, setActivities] = useState<ActivityItemDTO[]>([])
  
  const [selectedOrigin, setSelectedOrigin] = useState<string | null>(null)
  const [viewTab, setViewTab] = useState<'config' | 'logs'>('config')
  const [accessToken, setAccessToken] = useState<string>('')
  
  // Controle do Drawer
  const [activeEventId, setActiveEventId] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Redireciona se não estiver logado
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  // Obtém o token JWT da sessão ativa no navegador e escuta por mudanças
  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active && session) {
        setAccessToken(session.access_token)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) {
        setAccessToken(session.access_token)
      } else if (active) {
        setAccessToken('')
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await integrationClient.getDashboard()
      setConnectors(data.connectors)
      setActivities(data.activity)

      // Por padrão seleciona o primeiro conector
      if (data.connectors.length > 0 && !selectedOrigin) {
        setSelectedOrigin(data.connectors[0].origin)
      }
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar dados do Centro de Integrações.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedOrigin, toast])

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user, loadData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData(true)
    // Atualiza a lista de eventos caso a aba de logs esteja ativa
    setHistoryRefreshTrigger((t) => t + 1)
    toast.success('Dados atualizados com sucesso.')
  }

  const handleSelectEvent = (eventId: string) => {
    setActiveEventId(eventId)
    setIsDrawerOpen(true)
  }

  const handleReplaySuccess = () => {
    // Incrementa trigger para forçar recarregamento automático dos logs na tabela
    setHistoryRefreshTrigger((t) => t + 1)
    // Atualiza o dashboard/atividades em segundo plano
    loadData(true)
  }

  if (authLoading || loading) {
    return <IntegracoesLoading />
  }

  // Nome legível da integração selecionada para o cabeçalho dos painéis
  const selectedConnector = connectors.find((c) => c.origin === selectedOrigin)

  return (
    <PullRefresh onRefresh={handleRefresh}>
      <AppShell>
        {/* Cabeçalho da Página */}
        <PageHeader
          left={<PageTitle eyebrow="Ecossistema" title="Integrações" />}
          right={
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-full bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
              aria-label="Atualizar"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          }
        />

        {/* Bloco 1: Grid de Conectores Registrados */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Plataformas Suportadas</span>
          </div>
          <IntegrationGrid
            connectors={connectors}
            onConfigure={(origin) => {
              setSelectedOrigin(origin)
              setViewTab('config')
            }}
          />
        </div>

        {/* Bloco 2: Diagnóstico de Saúde do Pipeline */}
        <HealthCheckSection />

        {/* Bloco 3: Feed de Atividade Recente */}
        <ActivityFeed
          activities={activities}
          onRefresh={handleRefresh}
          loading={refreshing}
        />

        {/* Detalhes da Integração Selecionada */}
        {selectedOrigin && selectedConnector && user && (
          <div className="space-y-4 pt-2 animate-fade-in">
            {/* Header da Seleção */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <h2 className="text-sm font-semibold text-slate-300">
                  Gerenciar: {selectedConnector.name}
                </h2>
              </div>

              {/* Tabs de Controle */}
              <div className="flex bg-slate-900/60 p-0.5 rounded-xl border border-slate-800/60">
                <button
                  onClick={() => setViewTab('config')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                    viewTab === 'config'
                      ? 'bg-slate-800 text-[var(--color-text-primary)] shadow-sm'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  Configurações
                </button>
                <button
                  onClick={() => setViewTab('logs')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                    viewTab === 'logs'
                      ? 'bg-slate-800 text-[var(--color-text-primary)] shadow-sm'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  Logs de Webhook
                </button>
              </div>
            </div>

            {/* Conteúdo dinâmico da tab ativa */}
            {viewTab === 'config' ? (
              <div className="space-y-4 pt-1 animate-fade-in">
                {/* Bloco 4: API Keys */}
                <ApiKeysSection
                  origin={selectedOrigin}
                  userId={user.id}
                  accessToken={accessToken}
                />

                {/* Bloco 5: Mapeamentos */}
                <MappingSection
                  origin={selectedOrigin}
                  userId={user.id}
                  accessToken={accessToken}
                />
              </div>
            ) : (
              <div className="animate-fade-in">
                {/* Bloco 6: Histórico de Logs */}
                <EventHistory
                  origin={selectedOrigin}
                  onSelectEvent={handleSelectEvent}
                  refreshTrigger={historyRefreshTrigger}
                />
              </div>
            )}
          </div>
        )}

        {/* Drawer de Detalhes Completo com Reprocessador */}
        {user && accessToken && (
          <EventDrawer
            open={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            origin={selectedOrigin || ''}
            eventId={activeEventId}
            userId={user.id}
            accessToken={accessToken}
            onReplaySuccess={handleReplaySuccess}
          />
        )}
      </AppShell>
    </PullRefresh>
  )
}

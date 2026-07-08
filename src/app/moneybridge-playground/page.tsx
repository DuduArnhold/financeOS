'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PageTitle } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import {
  Play, History, RefreshCw, CheckCircle2, XCircle, Circle,
  Database, Cpu, ArrowDown, Zap, GitBranch, Terminal,
  AlertTriangle, ShieldCheck, Layers
} from 'lucide-react'
import { simulatePipeline, SimulationStep } from '@/app/actions/simulate'
import { IntegrationMapping } from '@/repositories/integration.repository'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface MappingDbRow {
  id: string; user_id: string; origin: string; event_type: string
  account_id: string; category_id: string; priority: number; enabled: boolean; created_at: string
  finance_accounts?: { nome: string } | null
  finance_categories?: { nome: string } | null
}
interface EventLogDbRow {
  id: string; user_id: string; origin: string; event_id: string; event_type: string
  status: 'processing' | 'processed' | 'failed'; payload: unknown
  normalized_payload?: unknown; duration_ms?: number | null; error?: string | null
  processed_by?: string | null; created_at: string
}
interface MovementDbRow {
  id: string; valor: number; origem: string; created_at: string
  finance_accounts?: { nome: string } | null
  finance_categories?: { nome: string } | null
}

type Scenario = 'normal' | 'discount' | 'cancelled' | 'invalid_payload' | 'idempotency' | 'no_mapping' | 'no_handler'
type PipelineMode = 'memory' | 'supabase'

// ─── Pipeline stages (estáticas — mostradas antes de executar) ────────────────

const PIPELINE_STAGES = [
  { id: 'Normalizer', icon: <Terminal className="w-3.5 h-3.5" />, color: 'sky',
    description: 'Traduz payload externo → NormalizedSale' },
  { id: 'Publisher', icon: <ShieldCheck className="w-3.5 h-3.5" />, color: 'violet',
    description: 'Valida schema do PlatformEvent (id, tenantId, traceId…)' },
  { id: 'EventBus', icon: <Zap className="w-3.5 h-3.5" />, color: 'amber',
    description: 'Entrega o evento ao subscriber registrado' },
  { id: 'Orchestrator', icon: <Cpu className="w-3.5 h-3.5" />, color: 'indigo',
    description: 'Verifica idempotência → resolve handler → persiste log' },
  { id: 'Registry', icon: <GitBranch className="w-3.5 h-3.5" />, color: 'emerald',
    description: 'Resolve handler por (origin, type, version)' },
]

const SCENARIOS: Record<Scenario, {
  label: string; value: number; descricao: string
  expected: string; expectedColor: string
}> = {
  normal: {
    label: 'Venda Simples', value: 1300.00,
    descricao: 'Fechamento de Caixa Lucro Simples (Simulado)',
    expected: '✓ Sucesso', expectedColor: 'text-emerald-400'
  },
  discount: {
    label: 'Venda Promocional', value: 950.00,
    descricao: 'Fechamento Promocional (Black Friday)',
    expected: '✓ Sucesso', expectedColor: 'text-emerald-400'
  },
  cancelled: {
    label: 'Venda Cancelada', value: -200.00,
    descricao: 'Venda cancelada / estorno',
    expected: '→ Normalizer passa, Handler decide', expectedColor: 'text-amber-400'
  },
  invalid_payload: {
    label: 'Payload Inválido', value: NaN,
    descricao: 'Campo valorLiquido ausente ou corrompido',
    expected: '✗ Falha no Normalizer', expectedColor: 'text-rose-400'
  },
  idempotency: {
    label: 'Evento Duplicado', value: 1300.00,
    descricao: 'Reenvia evento idêntico já processado',
    expected: '→ Idempotência ativa (Skip)', expectedColor: 'text-amber-400'
  },
  no_mapping: {
    label: 'Sem Mapeamento', value: 1300.00,
    descricao: 'Venda de origem sem mappings cadastrados',
    expected: '✗ Falha no Orchestrator', expectedColor: 'text-rose-400'
  },
  no_handler: {
    label: 'Handler Inexistente', value: 1300.00,
    descricao: 'Origem sem handler registrado no bootstrap',
    expected: '✗ Falha no Orchestrator', expectedColor: 'text-rose-400'
  }
}

// ─── Componente Principal ────────────────────────────────────────────────────

export default function MoneyBridgePlayground() {
  const { user, loading: authLoading } = useAuth()
  const toast = useToast()

  const [mappings, setMappings] = useState<MappingDbRow[]>([])
  const [logs, setLogs] = useState<EventLogDbRow[]>([])
  const [loading, setLoading] = useState(true)
  const [scenario, setScenario] = useState<Scenario>('normal')
  const [pipelineMode, setPipelineMode] = useState<PipelineMode>('memory')
  const [simulating, setSimulating] = useState(false)
  const [steps, setSteps] = useState<SimulationStep[]>([])
  const [lastMovement, setLastMovement] = useState<MovementDbRow | null>(null)
  const [ran, setRan] = useState(false)

  const loadPlaygroundData = useCallback(async () => {
    if (!user) return
    try {
      const { data: mappingsData, error: mapErr } = await supabase
        .from('integration_mappings')
        .select('*, finance_accounts:account_id (nome), finance_categories:category_id (nome)')
        .eq('user_id', user.id)
        .order('priority', { ascending: true })

      if (mapErr) {
        console.error('[Playground] integration_mappings:', mapErr.code, mapErr.message)
        throw mapErr
      }
      setMappings((mappingsData || []) as MappingDbRow[])

      const { data: logsData, error: logErr } = await supabase
        .from('moneybridge_events')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (logErr) {
        console.error('[Playground] moneybridge_events:', logErr.code, logErr.message)
        throw logErr
      }
      setLogs((logsData || []) as EventLogDbRow[])
    } catch (err) {
      const msg = typeof err === 'object' && err !== null ? JSON.stringify(err) : String(err)
      toast.error(`Erro ao carregar dados: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [user, toast])

  useEffect(() => {
    if (user) {
      const t = setTimeout(() => loadPlaygroundData(), 0)
      return () => clearTimeout(t)
    }
  }, [user, loadPlaygroundData])

  const handleSimulate = async () => {
    if (!user) return
    setSimulating(true)
    setSteps([])
    setLastMovement(null)
    setRan(true)

    const sc = SCENARIOS[scenario]
    const eventId = `test_ls_${Date.now()}`
    const firstMapping = mappings[0]
    const mockMapping: IntegrationMapping | null = firstMapping ? {
      id: firstMapping.id, userId: firstMapping.user_id, origin: firstMapping.origin,
      eventType: firstMapping.event_type, accountId: firstMapping.account_id,
      categoryId: firstMapping.category_id, priority: firstMapping.priority,
      enabled: firstMapping.enabled, createdAt: firstMapping.created_at
    } : null

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      const result = await simulatePipeline({
        userId: user.id, eventId,
        rawSale: { valorLiquido: sc.value, dataFechamento: new Date().toISOString().split('T')[0], descricao: sc.descricao },
        mode: pipelineMode,
        mockMapping: pipelineMode === 'memory' ? mockMapping : null,
        accessToken,
        scenario
      })

      setSteps(result.steps)

      if (result.success) {
        toast.success('Pipeline executado com sucesso!')
        if (pipelineMode === 'supabase') {
          await loadPlaygroundData()
          const { data } = await supabase
            .from('finance_movements')
            .select('*, finance_categories:categoria_id(nome), finance_accounts:account_id(nome)')
            .eq('user_id', user.id).eq('origem', 'lucro_simples')
            .order('created_at', { ascending: false }).limit(1).single()
          if (data) setLastMovement(data as unknown as MovementDbRow)
        }
      } else {
        toast.error(result.error || 'Pipeline falhou.')
        if (pipelineMode === 'supabase') await loadPlaygroundData()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setSimulating(false)
    }
  }

  if (authLoading || loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-96">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </AppShell>
    )
  }

  const sc = SCENARIOS[scenario]
  const hasMappings = mappings.length > 0
  const allGreen = steps.length > 0 && steps.every(s => s.status === 'success')
  const hasFailed = steps.some(s => s.status === 'failed')

  return (
    <AppShell>
      <PageHeader left={<PageTitle eyebrow="Console Developer" title="MoneyBridge Playground" />} />

      {/* ── Barra de Status ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Modo:</span>
          <div className="flex rounded-lg overflow-hidden border border-slate-800">
            {(['memory', 'supabase'] as PipelineMode[]).map(m => (
              <button key={m} onClick={() => setPipelineMode(m)}
                className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  pipelineMode === m ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}>
                {m === 'memory' ? <><Cpu className="w-3 h-3" /> Memória</> : <><Database className="w-3 h-3" /> Supabase</>}
              </button>
            ))}
          </div>
          <span className="text-slate-600">
            {pipelineMode === 'memory' ? '— sem banco, Etapa 1' : '— persiste no banco real'}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2 text-xs">
          {!hasMappings && (
            <span className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
              <AlertTriangle className="w-3 h-3" />
              Sem mapeamento — modo memória usa mock
            </span>
          )}
          {hasMappings && (
            <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
              <CheckCircle2 className="w-3 h-3" />
              {mappings[0].finance_accounts?.nome} → {mappings[0].finance_categories?.nome}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Coluna Esquerda: Cenário + Execução ─────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Seletor de Cenário */}
          <Card className="p-5">
            <h2 className="text-sm font-bold text-slate-200 mb-4">Cenário de Teste</h2>
            <div className="space-y-2">
              {(Object.entries(SCENARIOS) as [Scenario, typeof SCENARIOS[Scenario]][]).map(([key, s]) => (
                <button key={key} onClick={() => setScenario(key)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    scenario === key
                      ? 'border-indigo-500/50 bg-indigo-500/10'
                      : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/40'
                  }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className={`text-xs font-bold ${scenario === key ? 'text-indigo-300' : 'text-slate-300'}`}>
                        {s.label}
                      </span>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {isNaN(s.value) ? 'valorLiquido: undefined' : `R$ ${s.value.toFixed(2)}`}
                      </p>
                    </div>
                    <span className={`text-[10px] font-medium mt-0.5 ${s.expectedColor}`}>{s.expected}</span>
                  </div>
                </button>
              ))}
            </div>

            <Button onClick={handleSimulate} disabled={simulating}
              className="w-full justify-center mt-4"
              variant="primary"
              icon={simulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}>
              {simulating ? 'Executando...' : 'Disparar Pipeline'}
            </Button>
          </Card>

          {/* O que este cenário testa */}
          <Card className="p-5">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">O que será testado</h2>
            <div className="space-y-2 text-xs text-slate-400">
              {scenario === 'normal' && <>
                <p>✓ Normalizer aceita payload válido</p>
                <p>✓ Publisher valida o envelope</p>
                <p>✓ Orchestrator executa sem duplicidade</p>
                <p>✓ Handler cria o command corretamente</p>
              </>}
              {scenario === 'discount' && <>
                <p>✓ Normalizer aceita qualquer valor positivo</p>
                <p>✓ Pipeline completo funciona com valores menores</p>
              </>}
              {scenario === 'cancelled' && <>
                <p>→ Normalizer aceita valor negativo (é dado válido)</p>
                <p>→ Decisão de ignorar fica no Handler</p>
                <p className="text-amber-400">⚠ Pode falhar no Handler (valor ≤ 0)</p>
              </>}
              {scenario === 'invalid_payload' && <>
                <p className="text-rose-400">✗ Normalizer rejeita valorLiquido inválido</p>
                <p>→ Pipeline para antes do Publisher</p>
                <p>→ Barramento não recebe nada</p>
              </>}
              {scenario === 'idempotency' && <>
                <p>→ Primeiro envio: cria movimentação normalmente</p>
                <p className="text-amber-400">→ Reenvio: Orchestrator detecta duplicidade e dá Skip</p>
                <p>✓ Evita duplicação de lançamentos financeiros</p>
              </>}
              {scenario === 'no_mapping' && <>
                <p>✓ Handler é resolvido com sucesso</p>
                <p className="text-rose-400">✗ Orchestrator não acha mappings no banco/mock</p>
                <p>✗ Grava status "failed" em moneybridge_events</p>
              </>}
              {scenario === 'no_handler' && <>
                <p>✓ Publisher valida o envelope</p>
                <p className="text-rose-400">✗ Orchestrator falha ao resolver o handler</p>
                <p>✗ Grava status "failed" em moneybridge_events</p>
              </>}
            </div>
          </Card>
        </div>

        {/* ── Coluna Direita: Pipeline Visual ─────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">

          {/* Pipeline */}
          <Card className="p-5">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-sm font-bold text-slate-200">Pipeline de Execução</h2>
              {ran && !simulating && (
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                  allGreen ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                  : hasFailed ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                  : 'bg-slate-800 text-slate-400'
                }`}>
                  {allGreen ? '✓ Todos verdes' : hasFailed ? '✗ Falhou' : '—'}
                </span>
              )}
            </div>

            <div className="space-y-1">
              {PIPELINE_STAGES.map((stage, idx) => {
                const result = steps.find(s => s.name === stage.id)
                const isRunning = simulating && !result && steps.length === idx

                return (
                  <div key={stage.id}>
                    <div className={`flex gap-3 p-3 rounded-xl transition-all ${
                      result?.status === 'success' ? 'bg-emerald-500/8 border border-emerald-500/20'
                      : result?.status === 'failed' ? 'bg-rose-500/8 border border-rose-500/20'
                      : isRunning ? 'bg-indigo-500/8 border border-indigo-500/20'
                      : 'bg-slate-900/40 border border-transparent'
                    }`}>
                      {/* Ícone de status */}
                      <div className="flex-shrink-0 w-5 h-5 mt-0.5">
                        {result?.status === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                        {result?.status === 'failed' && <XCircle className="w-5 h-5 text-rose-500" />}
                        {isRunning && <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />}
                        {!result && !isRunning && <Circle className="w-5 h-5 text-slate-700" />}
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${
                            result?.status === 'success' ? 'text-emerald-300'
                            : result?.status === 'failed' ? 'text-rose-400'
                            : isRunning ? 'text-indigo-300'
                            : 'text-slate-400'
                          }`}>
                            {stage.id}
                          </span>
                          <span className="text-[10px] text-slate-600">{stage.description}</span>
                        </div>
                        {result?.details && (
                          <p className={`text-[11px] mt-1 ${
                            result.status === 'failed' ? 'text-rose-400' : 'text-slate-400'
                          }`}>
                            {result.details}
                          </p>
                        )}
                        {isRunning && <p className="text-[11px] text-indigo-400 mt-1 animate-pulse">Executando…</p>}
                      </div>
                    </div>

                    {/* Seta entre steps */}
                    {idx < PIPELINE_STAGES.length - 1 && (
                      <div className="flex justify-center my-0.5">
                        <ArrowDown className={`w-3 h-3 ${
                          result?.status === 'success' ? 'text-emerald-600'
                          : result?.status === 'failed' ? 'text-rose-900'
                          : 'text-slate-800'
                        }`} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Resultado final — movimentação criada */}
            {lastMovement && (
              <div className="mt-5 pt-4 border-t border-slate-800">
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-100">Movimentação no General Ledger</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-xl">
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Conta</span>
                    <span className="text-slate-200 font-medium">{lastMovement.finance_accounts?.nome}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Categoria</span>
                    <span className="text-slate-200 font-medium">{lastMovement.finance_categories?.nome}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Valor</span>
                    <span className="text-emerald-400 font-bold">R$ {Number(lastMovement.valor).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Estado inicial */}
            {!ran && (
              <p className="text-center text-xs text-slate-600 mt-4">
                Selecione um cenário e clique em <strong className="text-slate-500">Disparar Pipeline</strong>
              </p>
            )}
          </Card>

          {/* Histórico do banco */}
          <Card className="p-5">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-violet-400" />
                <h2 className="text-sm font-bold text-slate-200">moneybridge_events</h2>
                <span className="text-[10px] text-slate-600">(banco Supabase)</span>
              </div>
              <button onClick={loadPlaygroundData}
                className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
                <RefreshCw className="w-3 h-3" /> Recarregar
              </button>
            </div>

            {logs.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-600">
                <Database className="w-6 h-6 text-slate-800 mx-auto mb-2" />
                Nenhum evento persistido. Execute em modo <strong className="text-slate-500">Supabase</strong>.
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className="flex items-center gap-3 px-3 py-2.5 bg-slate-900/50 rounded-xl">
                    <Badge variant={log.status === 'processed' ? 'success' : log.status === 'failed' ? 'danger' : 'warning'}>
                      {log.status}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-mono text-slate-400 truncate block">{log.event_id}</span>
                      {log.error && <span className="text-[10px] text-rose-400 truncate block">{log.error}</span>}
                    </div>
                    <span className="text-[10px] text-slate-600 flex-shrink-0">
                      {log.duration_ms != null ? `${log.duration_ms}ms` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  )
}

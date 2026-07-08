'use client'

import React, { useState, useEffect } from 'react'
import { BottomSheet } from '@/components/feedback/BottomSheet'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/context/ToastContext'
import { integrationClient } from '@/services/integration.client'
import { reprocessEventAction } from '@/app/integracoes/actions'
import {
  Calendar,
  Clock,
  Code,
  Copy,
  Check,
  AlertTriangle,
  PlayCircle,
  Activity,
  DollarSign,
  Terminal,
  RefreshCw,
  GitBranch
} from 'lucide-react'
import type { EventLogDetailDTO, PipelineStepDTO } from '@/platform/integrations/contracts'

interface EventDrawerProps {
  open: boolean
  onClose: () => void
  origin: string
  eventId: string | null
  userId: string
  accessToken: string
  onReplaySuccess?: () => void
}

export function EventDrawer({
  open,
  onClose,
  origin,
  eventId,
  userId,
  accessToken,
  onReplaySuccess,
}: EventDrawerProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'timeline' | 'payload' | 'debug'>('summary')
  const [detail, setDetail] = useState<EventLogDetailDTO | null>(null)
  const [loading, setLoading] = useState(false)
  const [replaying, setReplaying] = useState(false)
  const toast = useToast()

  // Carrega os detalhes completos do webhook
  useEffect(() => {
    if (!open || !eventId) return

    const loadDetail = async () => {
      setLoading(true)
      try {
        const res = await integrationClient.getEventLogDetail(origin, eventId)
        setDetail(res)
      } catch (err) {
        console.error(err)
        toast.error('Não foi possível obter detalhes do evento.')
        onClose()
      } finally {
        setLoading(false)
      }
    }

    loadDetail()
  }, [open, eventId, origin, toast])

  const handleReplay = async () => {
    if (!eventId || !detail) return
    setReplaying(true)
    try {
      await reprocessEventAction({
        eventId: detail.id, // ID interno do banco
        accessToken,
      })
      toast.success('Evento reprocessado com sucesso!')
      
      // Refresh do item inteiro como recomendado pelo usuário
      const updated = await integrationClient.getEventLogDetail(origin, eventId)
      setDetail(updated)

      onReplaySuccess?.()
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Falha ao reprocessar evento.')
    } finally {
      setReplaying(false)
    }
  }

  const handleClose = () => {
    setDetail(null)
    setActiveTab('summary')
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={handleClose} title="Detalhes do Webhook">
      {loading ? (
        <div className="space-y-4 pt-4">
          <div className="h-6 w-1/3 rounded-xl skeleton-shimmer" />
          <div className="h-20 w-full rounded-xl skeleton-shimmer" />
          <div className="h-44 w-full rounded-xl skeleton-shimmer" />
        </div>
      ) : detail ? (
        <div className="space-y-5 pt-1">
          {/* Header e ID do Evento */}
          <div className="flex justify-between items-start bg-slate-900/40 p-3 rounded-xl border border-slate-800">
            <div>
              <span className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider font-semibold">
                ID do Evento Externo
              </span>
              <h4 className="font-mono text-sm font-bold text-[var(--color-text-primary)] select-all mt-0.5">
                {detail.eventId}
              </h4>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider font-semibold block">
                Status
              </span>
              <div className="mt-1">
                {detail.status === 'processed' ? (
                  <Badge variant="success">Processado</Badge>
                ) : detail.status === 'failed' ? (
                  <Badge variant="danger">Falhou</Badge>
                ) : (
                  <Badge variant="warning">Em fila</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Abas */}
          <div className="flex border-b border-slate-800">
            {[
              { id: 'summary', label: 'Resumo' },
              { id: 'timeline', label: 'Timeline' },
              { id: 'payload', label: 'Payloads' },
              { id: 'debug', label: 'Debug' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Conteúdo das Abas */}
          <div className="min-h-[220px] max-h-[360px] overflow-y-auto pr-1">
            {activeTab === 'summary' && (
              <SummaryTab
                amount={detail.amount}
                createdAt={detail.createdAt}
                movementId={detail.movementId}
                error={detail.error}
                attemptCount={detail.attemptCount}
                lastAttemptAt={detail.lastAttemptAt}
              />
            )}

            {activeTab === 'timeline' && (
              <TimelineTab steps={detail.steps} />
            )}

            {activeTab === 'payload' && (
              <PayloadTab payloads={detail.payloads} />
            )}

            {activeTab === 'debug' && (
              <DebugTab
                origin={detail.origin}
                eventId={detail.eventId}
                connectorVersion={detail.diagnostics.connectorVersion}
                schemaVersion={detail.diagnostics.schemaVersion}
                replayed={detail.diagnostics.replayed}
                replayCount={detail.diagnostics.replayCount}
                totalDurationMs={detail.diagnostics.totalDurationMs}
              />
            )}
          </div>

          {/* Ação de Reprocessar (Visível em caso de falha ou debug) */}
          <div className="flex gap-2 border-t border-slate-800 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={replaying}
              className="flex-1"
            >
              Fechar
            </Button>
            {detail.status === 'failed' && (
              <Button
                type="button"
                onClick={handleReplay}
                state={replaying ? 'loading' : 'idle'}
                icon={<PlayCircle className="w-4 h-4" />}
                className="flex-1"
              >
                Reprocessar Evento
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </BottomSheet>
  )
}

// ─── Sub-Componentes de Abas ──────────────────────────────────────────────────

interface SummaryTabProps {
  amount: number | null
  createdAt: string
  movementId: string | null
  error: string | null
  attemptCount: number
  lastAttemptAt: string | null
}

function SummaryTab({ amount, createdAt, movementId, error, attemptCount, lastAttemptAt }: SummaryTabProps) {
  const formatAmount = (val: number | null) => {
    if (val === null) return '—'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  return (
    <div className="space-y-3.5 text-xs py-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900/25 p-3 rounded-xl border border-slate-800/40">
          <span className="text-[10px] text-slate-500 block">Recebido em</span>
          <span className="font-semibold text-slate-300">
            {new Date(createdAt).toLocaleString('pt-BR')}
          </span>
        </div>
        <div className="bg-slate-900/25 p-3 rounded-xl border border-slate-800/40">
          <span className="text-[10px] text-slate-500 block">Valor Financeiro</span>
          <span className="font-bold text-emerald-400">
            {formatAmount(amount)}
          </span>
        </div>
      </div>

      {movementId && (
        <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-indigo-400 block font-semibold">
              Transação Criada no Extrato
            </span>
            <span className="font-mono text-[10px] text-slate-300">{movementId}</span>
          </div>
          <Badge variant="info">Vinculada</Badge>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-500/5 border border-rose-500/10 rounded-xl">
          <span className="text-[10px] text-rose-400 block font-bold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Detalhes do Erro
          </span>
          <p className="font-mono text-[10px] text-rose-200 mt-1 whitespace-pre-wrap break-all leading-normal bg-slate-950/40 p-2 rounded-lg border border-rose-950/20">
            {error}
          </p>
        </div>
      )}

      <div className="p-3 bg-slate-900/25 border border-slate-800/40 rounded-xl space-y-2">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-500">Tentativas de Execução</span>
          <span className="font-semibold text-slate-300">{attemptCount}</span>
        </div>
        {lastAttemptAt && (
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-slate-500">Última tentativa em</span>
            <span className="font-semibold text-slate-300">
              {new Date(lastAttemptAt).toLocaleString('pt-BR')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function TimelineTab({ steps }: { steps: PipelineStepDTO[] }) {
  // Ordena pelo backend para não ter lógica de ordenação no React
  return (
    <div className="space-y-3 py-2 pl-3 relative border-l border-slate-800">
      {steps.map((step, idx) => {
        const ringColor =
          step.status === 'success' ? 'border-emerald-500 bg-emerald-950/80 text-emerald-400'
          : step.status === 'failed' ? 'border-rose-500 bg-rose-950/80 text-rose-400'
          : 'border-slate-800 bg-slate-900/80 text-slate-500'

        return (
          <div key={step.id} className="relative pl-6">
            {/* Indicador na linha de timeline */}
            <div className={`absolute -left-[19px] top-0.5 w-3 h-3 rounded-full border-2 ${ringColor}`} />
            
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold text-slate-200">
                  Etapa {step.order}: {step.stage}
                </h4>
                <Badge
                  variant={
                    step.status === 'success' ? 'success'
                    : step.status === 'failed' ? 'danger'
                    : 'default'
                  }
                  className="scale-90 origin-left"
                >
                  {step.status}
                </Badge>
              </div>
              {step.startedAt && (
                <span className="text-[9px] text-[var(--color-text-muted)] block">
                  Iniciado em: {new Date(step.startedAt).toLocaleTimeString('pt-BR')}
                </span>
              )}
              {step.message && (
                <span className="text-[10px] text-rose-400 block italic">{step.message}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PayloadTab({ payloads }: { payloads: { raw: unknown; normalized: unknown } }) {
  const [copiedRaw, setCopiedRaw] = useState(false)
  const [copiedNorm, setCopiedNorm] = useState(false)
  const toast = useToast()

  const copyToClipboard = async (text: string, isRaw: boolean) => {
    try {
      await navigator.clipboard.writeText(text)
      if (isRaw) {
        setCopiedRaw(true)
        setTimeout(() => setCopiedRaw(false), 2000)
      } else {
        setCopiedNorm(true)
        setTimeout(() => setCopiedNorm(false), 2000)
      }
      toast.success('JSON copiado!')
    } catch {
      toast.error('Erro ao copiar JSON.')
    }
  }

  const rawJson = JSON.stringify(payloads.raw, null, 2)
  const normJson = payloads.normalized ? JSON.stringify(payloads.normalized, null, 2) : null

  return (
    <div className="space-y-4 py-1 text-xs">
      {/* Raw Payload */}
      <div>
        <div className="flex justify-between items-center mb-1.5 pl-1">
          <span className="text-[10px] font-semibold text-[var(--color-text-secondary)]">
            Payload Bruto Recebido (Raw)
          </span>
          <button
            onClick={() => copyToClipboard(rawJson, true)}
            className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
          >
            {copiedRaw ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            Copiar
          </button>
        </div>
        <pre className="p-3 rounded-xl bg-slate-950/70 border border-slate-850 font-mono text-[10px] text-indigo-200 overflow-x-auto max-h-[140px] leading-relaxed select-all">
          {rawJson}
        </pre>
      </div>

      {/* Normalized Payload */}
      {normJson && (
        <div>
          <div className="flex justify-between items-center mb-1.5 pl-1">
            <span className="text-[10px] font-semibold text-[var(--color-text-secondary)]">
              Payload Normalizado (FinanceOS Core)
            </span>
            <button
              onClick={() => copyToClipboard(normJson, false)}
              className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
            >
              {copiedNorm ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              Copiar
            </button>
          </div>
          <pre className="p-3 rounded-xl bg-slate-950/70 border border-slate-850 font-mono text-[10px] text-emerald-200 overflow-x-auto max-h-[140px] leading-relaxed select-all">
            {normJson}
          </pre>
        </div>
      )}
    </div>
  )
}

interface DebugTabProps {
  origin: string
  eventId: string
  connectorVersion: number
  schemaVersion: number
  replayed: boolean
  replayCount: number
  totalDurationMs: number | null
}

function DebugTab({
  origin,
  eventId,
  connectorVersion,
  schemaVersion,
  replayed,
  replayCount,
  totalDurationMs,
}: DebugTabProps) {
  const [copiedCurl, setCopiedCurl] = useState(false)
  const toast = useToast()

  // Gera um cURL de mentira para o desenvolvedor testar o webhook localmente
  const curlCommand = `curl -X POST "http://localhost:3000/api/integrations/${origin}" \\
  -H "Authorization: Bearer f_key_SUA_CHAVE_AQUI" \\
  -H "X-Event-ID: ${eventId}" \\
  -H "Content-Type: application/json" \\
  -d '{"valorLiquido": 150.00, "dataFechamento": "2026-07-08", "descricao": "Teste de Webhook Dev"}'`

  const handleCopyCurl = async () => {
    try {
      await navigator.clipboard.writeText(curlCommand)
      setCopiedCurl(true)
      toast.success('Comando cURL copiado!')
      setTimeout(() => setCopiedCurl(false), 2000)
    } catch {
      toast.error('Erro ao copiar cURL.')
    }
  }

  return (
    <div className="space-y-4 py-1 text-xs">
      <div className="p-3 bg-slate-900/25 border border-slate-800/40 rounded-xl space-y-2">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-500">Origem da Integração</span>
          <span className="font-mono text-slate-300">{origin}</span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-500">Versão do Conector</span>
          <span className="font-semibold text-slate-300">v{connectorVersion}.0</span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-500">Latência do Pipeline</span>
          <span className="font-semibold text-slate-300">
            {totalDurationMs !== null ? `${totalDurationMs} ms` : 'N/A'}
          </span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-500">Processado via Replay?</span>
          <span className="font-semibold text-slate-300">{replayed ? 'Sim' : 'Não'}</span>
        </div>
        {replayed && (
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-slate-500">Quantidade de Replays</span>
            <span className="font-semibold text-slate-300">{replayCount}</span>
          </div>
        )}
      </div>

      {/* Simulador cURL */}
      <div>
        <div className="flex justify-between items-center mb-1.5 pl-1">
          <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
            <Terminal className="w-3.5 h-3.5" />
            Simulador de Teste Local (cURL)
          </span>
          <button
            onClick={handleCopyCurl}
            className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            {copiedCurl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            Copiar Comando
          </button>
        </div>
        <pre className="p-3 rounded-xl bg-slate-950/90 border border-slate-900 font-mono text-[9px] text-slate-300 overflow-x-auto leading-relaxed select-all">
          {curlCommand}
        </pre>
      </div>
    </div>
  )
}

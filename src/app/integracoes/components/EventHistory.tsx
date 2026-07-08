'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/context/ToastContext'
import { integrationClient } from '@/services/integration.client'
import { Calendar, Clock, DollarSign, ChevronLeft, ChevronRight, AlertCircle, PlayCircle } from 'lucide-react'
import type { EventLogDTO } from '@/platform/integrations/contracts'

interface EventHistoryProps {
  origin: string
  onSelectEvent: (eventId: string) => void
  refreshTrigger?: number // altere este valor no pai para recarregar a lista
}

export function EventHistory({ origin, onSelectEvent, refreshTrigger = 0 }: EventHistoryProps) {
  const [events, setEvents] = useState<EventLogDTO[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [hasPrev, setHasPrev] = useState(false)
  
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const data = await integrationClient.listEventLogs(
        origin,
        statusFilter || undefined,
        page,
        pageSize
      )
      setEvents(data.items)
      setTotal(data.total)
      setHasNext(data.hasNext)
      setHasPrev(data.hasPrev)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar histórico de eventos.')
    } finally {
      setLoading(false)
    }
  }, [origin, statusFilter, page, pageSize, toast])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents, refreshTrigger])

  // Reseta a página se trocar o filtro de status
  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus)
    setPage(1)
  }

  const formatAmount = (amount: number | null) => {
    if (amount === null) return '—'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount)
  }

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const getStatusBadge = (status: EventLogDTO['status']) => {
    switch (status) {
      case 'processed':
        return <Badge variant="success">Processado</Badge>
      case 'failed':
        return <Badge variant="danger">Falhou</Badge>
      default:
        return <Badge variant="warning">Em fila</Badge>
    }
  }

  return (
    <Card className="p-5 mb-6">
      {/* Cabeçalho do Histórico */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">
            Histórico de Transações
          </h3>
          <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
            Audit logs e status de execução de webhooks recebidos.
          </p>
        </div>

        {/* Filtros rápidos */}
        <div className="flex items-center gap-1 bg-slate-900/60 p-0.5 rounded-xl border border-slate-800">
          {[
            { value: '', label: 'Todos' },
            { value: 'processed', label: 'Sucesso' },
            { value: 'failed', label: 'Falhas' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleStatusChange(tab.value)}
              className={`px-3 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                statusFilter === tab.value
                  ? 'bg-slate-800 text-[var(--color-text-primary)] shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela ou Estados */}
      {loading ? (
        <div className="space-y-2 py-2">
          <div className="h-10 w-full rounded-xl skeleton-shimmer" />
          <div className="h-10 w-full rounded-xl skeleton-shimmer" />
          <div className="h-10 w-full rounded-xl skeleton-shimmer" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-slate-800 bg-slate-900/5 rounded-xl">
          <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-[var(--color-text-secondary)]">
            Nenhum log de webhook encontrado para os filtros selecionados.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[var(--color-text-muted)] font-semibold">
                <th className="pb-2.5">Data/Hora</th>
                <th className="pb-2.5">Evento</th>
                <th className="pb-2.5">Status</th>
                <th className="pb-2.5 text-right">Valor</th>
                <th className="pb-2.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {events.map((evt) => (
                <tr
                  key={evt.id}
                  className="hover:bg-slate-800/20 transition-colors cursor-pointer group"
                  onClick={() => onSelectEvent(evt.id)}
                >
                  <td className="py-3 text-[11px] font-medium text-[var(--color-text-secondary)]">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      {formatDateTime(evt.createdAt)}
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="font-mono text-[10px] text-[var(--color-text-primary)]">
                      {evt.eventId}
                    </div>
                    <span className="text-[9px] text-[var(--color-text-muted)] uppercase">
                      {evt.eventType}
                    </span>
                  </td>
                  <td className="py-3">{getStatusBadge(evt.status)}</td>
                  <td className="py-3 text-right font-semibold text-[var(--color-text-primary)]">
                    {formatAmount(evt.amount)}
                  </td>
                  <td className="py-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectEvent(evt.id)
                      }}
                      className="px-2.5 py-1 text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg text-slate-300 transition-all active:scale-95"
                    >
                      Detalhes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Paginação */}
          {total > pageSize && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800/80">
              <span className="text-[10px] text-[var(--color-text-muted)]">
                Mostrando {events.length} de {total} logs
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={!hasPrev}
                  className="p-1.5 rounded-lg border border-slate-850 hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none text-slate-400"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold text-[var(--color-text-secondary)] px-2">
                  Pág. {page}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasNext}
                  className="p-1.5 rounded-lg border border-slate-850 hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none text-slate-400"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

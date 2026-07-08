'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/context/ToastContext'
import { EditMappingSheet } from './EditMappingSheet'
import { integrationClient } from '@/services/integration.client'
import { saveMappingAction } from '@/app/integracoes/actions'
import { Shuffle, Plus, Edit2, Wallet, Tag } from 'lucide-react'
import type { MappingDTO } from '@/platform/integrations/contracts'
import type { IntegrationOrigin } from '@/platform/integrations/origins'

interface MappingSectionProps {
  origin: string
  userId: string
  accessToken: string
}

export function MappingSection({ origin, userId, accessToken }: MappingSectionProps) {
  const [mappings, setMappings] = useState<MappingDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [selectedMapping, setSelectedMapping] = useState<MappingDTO | null>(null)
  const toast = useToast()

  const fetchMappings = useCallback(async () => {
    setLoading(true)
    try {
      const data = await integrationClient.listMappings(origin)
      setMappings(data)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao listar regras de mapeamento.')
    } finally {
      setLoading(false)
    }
  }, [origin, toast])

  useEffect(() => {
    fetchMappings()
  }, [fetchMappings])

  const handleToggle = async (mapping: MappingDTO) => {
    try {
      await saveMappingAction({
        userId,
        origin: mapping.origin as IntegrationOrigin,
        eventType: mapping.eventType,
        accountId: mapping.accountId,
        categoryId: mapping.categoryId,
        priority: mapping.priority,
        enabled: !mapping.enabled, // inverte
        accessToken,
      })
      toast.success('Status do mapeamento alterado.')
      fetchMappings()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao atualizar status do mapeamento.')
    }
  }

  const handleEdit = (mapping: MappingDTO) => {
    setSelectedMapping(mapping)
    setIsSheetOpen(true)
  }

  const handleCreateNew = () => {
    setSelectedMapping(null)
    setIsSheetOpen(true)
  }

  return (
    <Card className="p-5 mb-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Shuffle className="w-5 h-5 text-indigo-400" />
          <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">
            Mapeamentos de Entrada
          </h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCreateNew}
          icon={<Plus className="w-3.5 h-3.5" />}
        >
          Nova regra
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-12 w-full rounded-xl skeleton-shimmer" />
          <div className="h-12 w-full rounded-xl skeleton-shimmer" />
        </div>
      ) : mappings.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-slate-800 bg-slate-900/5 rounded-xl">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Nenhuma regra de mapeamento configurada.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {mappings.map((mapping) => (
            <div
              key={mapping.id}
              className={`p-3.5 rounded-xl border transition-all duration-150 ${
                mapping.enabled
                  ? 'border-slate-800/80 bg-slate-950/20'
                  : 'border-slate-800/40 bg-slate-950/5 opacity-55'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-mono text-[10px] font-semibold text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10">
                    {mapping.eventType}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)] ml-2">
                    Prioridade {mapping.priority}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {/* Toggle inline de status */}
                  <button
                    onClick={() => handleToggle(mapping)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                      mapping.enabled
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-800/60 text-slate-400 border border-slate-700/50'
                    }`}
                  >
                    {mapping.enabled ? 'Ativo' : 'Inativo'}
                  </button>

                  <button
                    onClick={() => handleEdit(mapping)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Roteamento Visual */}
              <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)] mt-1.5 pt-1.5 border-t border-slate-900/60">
                <div className="flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5 text-slate-500" />
                  <span className="truncate max-w-[120px]">{mapping.accountName}</span>
                </div>
                <span className="text-slate-700">→</span>
                <div className="flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-slate-500" />
                  <span className="truncate max-w-[120px]">{mapping.categoryName}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sheet de Criação/Edição */}
      <EditMappingSheet
        open={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        origin={origin}
        userId={userId}
        accessToken={accessToken}
        mapping={selectedMapping}
        onSaved={fetchMappings}
      />
    </Card>
  )
}

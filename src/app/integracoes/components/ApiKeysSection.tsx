'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/context/ToastContext'
import { useDialog } from '@/context/DialogContext'
import { CreateApiKeySheet } from './CreateApiKeySheet'
import { revokeApiKeyAction } from '@/app/integracoes/actions'
import { integrationClient } from '@/services/integration.client'
import { Key, Plus, Trash2, ShieldAlert, Calendar } from 'lucide-react'
import type { ApiKeyDTO } from '@/platform/integrations/contracts'

interface ApiKeysSectionProps {
  origin: string
  userId: string
  accessToken: string
}

export function ApiKeysSection({ origin, userId, accessToken }: ApiKeysSectionProps) {
  const [keys, setKeys] = useState<ApiKeyDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const toast = useToast()
  const { confirm } = useDialog()

  const fetchKeys = useCallback(async () => {
    setLoading(true)
    try {
      const data = await integrationClient.listApiKeys(origin)
      setKeys(data)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao listar chaves de API.')
    } finally {
      setLoading(false)
    }
  }, [origin, toast])

  useEffect(() => {
    fetchKeys()
  }, [fetchKeys])

  const handleCreated = (newKey: ApiKeyDTO) => {
    setKeys((prev) => [newKey, ...prev])
  }

  const handleRevoke = async (key: ApiKeyDTO) => {
    const ok = await confirm({
      title: 'Revogar Chave de API?',
      description: `A chave "${key.name}" (${key.prefix}) será desativada permanentemente. Sistemas terceiros que utilizam esta chave perderão o acesso imediatamente.`,
      confirmText: 'Revogar Chave',
      cancelText: 'Manter ativa',
      variant: 'danger',
    })

    if (!ok) return

    try {
      await revokeApiKeyAction({
        id: key.id,
        userId,
        accessToken,
      })
      toast.success('Chave de API revogada com sucesso.')
      // Remove da lista local ou atualiza status
      setKeys((prev) => prev.filter((k) => k.id !== key.id))
    } catch (err) {
      console.error(err)
      toast.error('Falha ao revogar chave.')
    }
  }

  return (
    <Card className="p-5 mb-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-indigo-400" />
          <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">
            Chaves de API
          </h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsSheetOpen(true)}
          icon={<Plus className="w-3.5 h-3.5" />}
        >
          Nova chave
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-10 w-full rounded-xl skeleton-shimmer" />
          <div className="h-10 w-full rounded-xl skeleton-shimmer" />
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-slate-800 bg-slate-900/5 rounded-xl">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Nenhuma chave de API ativa para esta integração.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between p-3 rounded-xl border border-slate-800/60 bg-slate-950/20"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-semibold text-[var(--color-text-primary)]">
                    {key.name}
                  </h4>
                  <span className="font-mono text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                    {key.prefix}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-secondary)]">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Criada em {new Date(key.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                  {key.lastUsedAt && (
                    <span className="text-[var(--color-text-muted)]">
                      · Uso: {new Date(key.lastUsedAt).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleRevoke(key)}
                className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 active:scale-95 transition-all"
                title="Revogar chave de API"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sheet de Criação */}
      <CreateApiKeySheet
        open={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        origin={origin}
        accessToken={accessToken}
        userId={userId}
        onCreated={handleCreated}
      />
    </Card>
  )
}

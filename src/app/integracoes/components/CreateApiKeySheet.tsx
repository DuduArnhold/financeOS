'use client'

import React, { useState } from 'react'
import { BottomSheet } from '@/components/feedback/BottomSheet'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/context/ToastContext'
import { createApiKeyAction } from '@/app/integracoes/actions'
import { Copy, Check, Eye, AlertTriangle } from 'lucide-react'
import type { ApiKeyDTO } from '@/platform/integrations/contracts'

interface CreateApiKeySheetProps {
  open: boolean
  onClose: () => void
  origin: string
  accessToken: string
  userId: string
  onCreated: (newKey: ApiKeyDTO) => void
}

export function CreateApiKeySheet({
  open,
  onClose,
  origin,
  accessToken,
  userId,
  onCreated,
}: CreateApiKeySheetProps) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [plainKey, setPlainKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const toast = useToast()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    try {
      const res = await createApiKeyAction({
        userId,
        name: name.trim(),
        origin: origin as any,
        accessToken,
      })

      setPlainKey(res.plainKey)
      onCreated(res.record)
      toast.success('Chave de API criada com sucesso!')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao gerar chave de API.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!plainKey) return
    try {
      await navigator.clipboard.writeText(plainKey)
      setCopied(true)
      toast.success('Chave copiada para a área de transferência!')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error('Falha ao copiar chave.')
    }
  }

  const handleClose = () => {
    // Reseta estados locais ao fechar
    setName('')
    setPlainKey(null)
    setCopied(false)
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={handleClose} title="Nova Chave de API">
      {!plainKey ? (
        <form onSubmit={handleCreate} className="space-y-4 pt-2">
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            As chaves de API permitem que sistemas terceiros enviem eventos diretamente para o seu FinanceOS. Defina um nome descritivo para identificação.
          </p>

          <Input
            label="Nome da Chave"
            placeholder="Ex: Lucro Simples Produção"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            required
            autoFocus
          />

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              state={loading ? 'loading' : 'idle'}
              className="flex-1"
              disabled={!name.trim()}
            >
              Gerar Chave
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4 pt-2">
          {/* Alerta de Cópia Única */}
          <div className="p-3.5 rounded-xl border border-warning/20 bg-warning/5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[var(--color-warning)] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-[var(--color-warning)]">
                Esta chave será mostrada apenas uma vez!
              </h4>
              <p className="text-[10px] text-slate-400 leading-relaxed mt-1">
                Por motivos de segurança, nós não armazenamos chaves em texto claro. Copie e salve em um local seguro agora. Depois de fechar, você não poderá visualizá-la novamente.
              </p>
            </div>
          </div>

          <div className="relative">
            <Input
              label="Chave gerada"
              value={plainKey}
              readOnly
              leftIcon={<Eye className="w-4 h-4 text-slate-500" />}
              rightElement={
                <button
                  onClick={handleCopy}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              }
            />
          </div>

          <Button
            type="button"
            onClick={handleClose}
            className="w-full"
          >
            Concluído
          </Button>
        </div>
      )}
    </BottomSheet>
  )
}

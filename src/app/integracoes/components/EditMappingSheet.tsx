'use client'

import React, { useState, useEffect } from 'react'
import { BottomSheet } from '@/components/feedback/BottomSheet'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/context/ToastContext'
import { saveMappingAction, fetchAccountsAction, fetchCategoriesAction } from '@/app/integracoes/actions'
import type { MappingDTO } from '@/platform/integrations/contracts'

interface EditMappingSheetProps {
  open: boolean
  onClose: () => void
  origin: string
  userId: string
  accessToken: string
  mapping?: MappingDTO | null // null se for criação
  onSaved: () => void
}

export function EditMappingSheet({
  open,
  onClose,
  origin,
  userId,
  accessToken,
  mapping,
  onSaved,
}: EditMappingSheetProps) {
  const [eventType, setEventType] = useState('sale.closed')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [priority, setPriority] = useState(1)
  const [enabled, setEnabled] = useState(true)
  const [accounts, setAccounts] = useState<{ value: string; label: string }[]>([])
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchingData, setFetchingData] = useState(false)
  const toast = useToast()

  // Carrega contas e categorias do usuário ativo
  useEffect(() => {
    if (!open) return

    const loadData = async () => {
      setFetchingData(true)
      try {
        const accs = await fetchAccountsAction(userId) ?? []
        const cats = await fetchCategoriesAction(userId, 'receita') ?? []
        
        setAccounts(accs.map((a) => ({ value: a.id, label: a.nome })))
        setCategories(cats.map((c) => ({ value: c.id, label: c.nome })))

        // Preenche com valores do mapeamento atual, se houver
        if (mapping) {
          setEventType(mapping.eventType)
          setAccountId(mapping.accountId)
          setCategoryId(mapping.categoryId)
          setPriority(mapping.priority)
          setEnabled(mapping.enabled)
        } else {
          setEventType('sale.closed')
          setAccountId(accs[0]?.id ?? '')
          setCategoryId(cats[0]?.id ?? '')
          setPriority(1)
          setEnabled(true)
        }
      } catch (err) {
        console.error(err)
        toast.error('Erro ao carregar dados de contas/categorias.')
      } finally {
        setFetchingData(false)
      }
    }

    loadData()
  }, [open, mapping, userId, toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountId || !categoryId) {
      toast.warning('Por favor, selecione uma conta e uma categoria.')
      return
    }

    setLoading(true)
    try {
      await saveMappingAction({
        userId,
        origin: origin as any,
        eventType,
        accountId,
        categoryId,
        priority,
        enabled,
        accessToken,
      })

      toast.success(mapping ? 'Regra atualizada com sucesso!' : 'Regra criada com sucesso!')
      onSaved()
      onClose()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao salvar regra de mapeamento.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={mapping ? 'Editar Regra de Mapeamento' : 'Nova Regra de Mapeamento'}
    >
      {fetchingData ? (
        <div className="space-y-4 pt-2">
          <div className="h-10 w-full rounded-xl skeleton-shimmer" />
          <div className="h-10 w-full rounded-xl skeleton-shimmer" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <Select
            label="Evento da Plataforma"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            disabled={loading}
            options={[
              { value: 'sale.closed', label: 'Venda Fechada (sale.closed)' },
              { value: 'sale.created', label: 'Venda Criada (sale.created)' },
            ]}
          />

          <Select
            label="Conta Destino"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            disabled={loading}
            options={accounts}
          />

          <Select
            label="Categoria"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={loading}
            options={categories}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                Prioridade da Regra
              </label>
              <input
                type="number"
                min="1"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value, 10) || 1)}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl text-sm glass-input bg-[var(--color-surface-alt)] text-[var(--color-text-primary)]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                Status da Regra
              </label>
              <div className="flex items-center h-[44px]">
                <label className="inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    disabled={loading}
                    className="sr-only peer"
                  />
                  <div className="relative w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white peer-checked:after:border-white"></div>
                  <span className="ms-2.5 text-xs font-semibold text-[var(--color-text-primary)]">
                    {enabled ? 'Ativa' : 'Inativa'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              state={loading ? 'loading' : 'idle'}
              className="flex-1"
            >
              Salvar Regra
            </Button>
          </div>
        </form>
      )}
    </BottomSheet>
  )
}

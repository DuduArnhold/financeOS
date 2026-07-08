'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth }   from '@/context/AuthContext'
import { useToast }  from '@/context/ToastContext'
import { useDialog } from '@/context/DialogContext'
import { formatCurrency } from '@/lib/utils'
import { Target, Plus, DollarSign, TrendingUp, Check, X } from 'lucide-react'

import { AppShell }       from '@/components/layout/AppShell'
import { PageHeader, PageTitle } from '@/components/layout/PageHeader'
import { Button }         from '@/components/ui/Button'
import { Card }           from '@/components/ui/Card'
import { Input }          from '@/components/ui/Input'
import { Badge }          from '@/components/ui/Badge'
import { ActionRow }      from '@/components/finance/ActionRow'
import { EmptyState }     from '@/components/feedback/EmptyState'
import { BottomSheet }    from '@/components/feedback/BottomSheet'
import { SkeletonTable }  from '@/components/feedback/Skeletons'
import { PullRefresh }    from '@/components/mobile/PullRefresh'

import { goalService, MetaConsolidated } from '@/services/goal.service'

const TODAY = new Date().toISOString().split('T')[0]

export default function MetasPage() {
  const { user, profile, loading } = useAuth()
  const toast  = useToast()
  const dialog = useDialog()
  const router = useRouter()

  const [metas,       setMetas]       = useState<MetaConsolidated[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [sheetOpen,   setSheetOpen]   = useState(false)
  const [submitState, setSubmitState] = useState<'idle'|'loading'|'success'|'error'>('idle')

  // Create / Edit Form State
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [nome,         setNome]         = useState('')
  const [valorMeta,    setValorMeta]    = useState('')
  const [valorInicial, setValorInicial] = useState('0')

  // Quick Deposit State
  const [activeDepositId, setActiveDepositId] = useState<string | null>(null)
  const [depositAmount,   setDepositAmount]   = useState('')
  const [depositing,      setDepositing]      = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const loadMetas = useCallback(async () => {
    if (!user || !profile) return
    setDataLoading(true)
    try {
      const result = await goalService.getMetas(user.id)
      if (result.success && result.data) {
        setMetas(result.data)
      } else if (result.error) {
        toast.error(result.error)
      }
    } catch {
      toast.error('Erro ao carregar metas.')
    } finally {
      setDataLoading(false)
    }
  }, [user, profile, toast])

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadMetas()
    }, 0)
    return () => clearTimeout(timeout)
  }, [loadMetas])

  const openNew = useCallback(() => {
    setEditingId(null); setNome(''); setValorMeta(''); setValorInicial('0')
    setSheetOpen(true)
  }, [])

  const openEdit = useCallback((meta: MetaConsolidated) => {
    setEditingId(meta.id)
    setNome(meta.nome)
    setValorMeta(meta.valorMeta.toString())
    setSheetOpen(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) { toast.error('Informe o nome da meta.'); return }
    if (!valorMeta || Number(valorMeta) <= 0) { toast.error('Informe um valor de meta maior que zero.'); return }

    setSubmitState('loading')
    try {
      const result = editingId
        ? await goalService.updateMeta(editingId, user!.id, nome.trim(), Number(valorMeta))
        : await goalService.createMeta(user!.id, nome.trim(), Number(valorMeta), Number(valorInicial))

      if (result.success) {
        setSubmitState('success')
        toast.success(editingId ? 'Meta atualizada!' : 'Meta criada!')
        setTimeout(() => { setSheetOpen(false); setSubmitState('idle'); loadMetas() }, 800)
      } else {
        setSubmitState('error')
        toast.error(result.error || 'Erro ao salvar meta.')
        setTimeout(() => setSubmitState('idle'), 2000)
      }
    } catch {
      setSubmitState('error')
      toast.error('Erro ao salvar meta.')
      setTimeout(() => setSubmitState('idle'), 2000)
    }
  }

  const handleDelete = useCallback(async (id: string) => {
    const ok = await dialog.confirm({
      title: 'Excluir meta?',
      description: 'Essa ação não pode ser desfeita e removerá todo o histórico de depósitos desta meta.',
      confirmText: 'Excluir',
      variant: 'danger',
    })
    if (!ok) return

    try {
      const result = await goalService.deleteMeta(id, user!.id)
      if (result.success) {
        toast.success('Meta excluída.')
        loadMetas()
      } else {
        toast.error(result.error || 'Erro ao excluir meta.')
      }
    } catch {
      toast.error('Erro ao excluir meta.')
    }
  }, [dialog, toast, user, loadMetas])

  const handleQuickDeposit = async (meta: MetaConsolidated) => {
    const amount = Number(depositAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Informe um valor de aporte válido.')
      return
    }

    setDepositing(true)
    const originalValue = meta.valorAtual
    const newTotal = Number(originalValue) + amount

    // Optimistic Update
    setMetas(prev => 
      prev.map(m => m.id === meta.id ? { ...m, valorAtual: newTotal } : m)
    )

    try {
      const result = await goalService.depositToMeta(
        meta.id,
        user!.id,
        amount,
        TODAY
      )

      if (result.success) {
        toast.success(`Aporte de ${formatCurrency(amount, profile?.moeda)} realizado!`)
        setDepositAmount('')
        setActiveDepositId(null)
        loadMetas()
      } else {
        // Revert on business error
        setMetas(prev => 
          prev.map(m => m.id === meta.id ? { ...m, valorAtual: originalValue } : m)
        )
        toast.error(result.error || 'Erro ao registrar aporte.')
      }
    } catch (err) {
      // Revert on exception
      setMetas(prev => 
        prev.map(m => m.id === meta.id ? { ...m, valorAtual: originalValue } : m)
      )
      console.error('Error updating meta value:', err)
      toast.error('Erro ao registrar aporte.')
    } finally {
      setDepositing(false)
    }
  }

  const currencySymbol = profile?.moeda || 'R$'

  return (
    <PullRefresh onRefresh={loadMetas}>
      <AppShell>
        <PageHeader
          left={<PageTitle eyebrow="Objetivos" title="Metas" />}
          right={
            <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNew}>
              Nova Meta
            </Button>
          }
        />

        {/* List Grid */}
        {dataLoading ? (
          <Card className="p-5"><SkeletonTable rows={4} /></Card>
        ) : metas.length === 0 ? (
          <Card className="p-2">
            <EmptyState
              icon="🎯"
              title="Nenhuma meta criada"
              description="Defina seus objetivos de economia e acompanhe seu progresso."
              actionLabel="Criar Meta"
              onAction={openNew}
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {metas.map((meta) => {
              const pct = Math.min(100, Math.round((meta.valorAtual / meta.valorMeta) * 100)) || 0
              const isDepositOpen = activeDepositId === meta.id

              return (
                <ActionRow
                  key={meta.id}
                  onEdit={() => openEdit(meta)}
                  onDelete={() => handleDelete(meta.id)}
                >
                  <Card animate className="p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />

                    {/* Meta Header */}
                    <div className="flex justify-between items-start mb-3.5">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                          <Target className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{meta.nome}</h3>
                          <p className="text-[10px] text-[var(--color-text-secondary)] font-medium">
                            Meta: {formatCurrency(meta.valorMeta, currencySymbol)}
                          </p>
                        </div>
                      </div>
                      <Badge variant={pct >= 100 ? 'success' : 'info'}>
                        {pct >= 100 ? 'Concluído' : `${pct}%`}
                      </Badge>
                    </div>

                    {/* Progress Stats */}
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-xs text-[var(--color-text-secondary)] font-medium">Progresso acumulado</span>
                      <span className="text-sm font-extrabold text-emerald-400">
                        {formatCurrency(meta.valorAtual, currencySymbol)}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden mb-4">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {/* Quick Add Inline Form */}
                    <div className="pt-3 border-t border-slate-800/40">
                      {isDepositOpen ? (
                        <div className="flex items-center gap-2 animate-fade-in-fast">
                          <div className="relative flex-1">
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={depositAmount}
                              onChange={e => setDepositAmount(e.target.value)}
                              placeholder="Valor do Aporte"
                              leftIcon={<DollarSign className="w-3.5 h-3.5 text-emerald-400" />}
                              disabled={depositing}
                              className="!py-1.5 !text-xs !h-9"
                              autoFocus
                            />
                          </div>
                          <button
                            onClick={() => handleQuickDeposit(meta)}
                            className="bg-emerald-650 hover:bg-emerald-600 text-white p-2 rounded-xl transition-all duration-120 active:scale-95 cursor-pointer flex items-center justify-center h-9 w-9 flex-shrink-0 border border-emerald-500/20"
                            disabled={depositing}
                            title="Confirmar aporte"
                          >
                            {depositing ? (
                              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setActiveDepositId(null)
                              setDepositAmount('')
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 p-2 rounded-xl transition-all duration-120 active:scale-95 cursor-pointer flex items-center justify-center h-9 w-9 flex-shrink-0 border border-slate-700/50"
                            disabled={depositing}
                            title="Cancelar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setActiveDepositId(meta.id)
                            setDepositAmount('')
                          }}
                          className="w-full text-center py-2 bg-indigo-500/5 border border-indigo-500/10 text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/20 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                          Fazer Aporte Rápido
                        </button>
                      )}
                    </div>
                  </Card>
                </ActionRow>
              )
            })}
          </div>
        )}

        {/* Form BottomSheet */}
        <BottomSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={editingId ? 'Editar Meta' : 'Nova Meta'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nome do objetivo"
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Notebook, Viagem, Reserva"
              required
            />
            <Input
              label="Valor total (meta)"
              type="number" step="0.01" min="0.01"
              value={valorMeta}
              onChange={e => setValorMeta(e.target.value)}
              placeholder="7000,00"
              leftIcon={<DollarSign className="w-4 h-4 text-indigo-400" />}
              required
            />
            {!editingId && (
              <Input
                label="Valor inicial guardado"
                type="number" step="0.01" min="0"
                value={valorInicial}
                onChange={e => setValorInicial(e.target.value)}
                placeholder="0,00"
                leftIcon={<DollarSign className="w-4 h-4 text-emerald-400" />}
                required
              />
            )}
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" variant="primary" state={submitState} className="flex-1">
                {editingId ? 'Salvar' : 'Criar Meta'}
              </Button>
            </div>
          </form>
        </BottomSheet>
      </AppShell>
    </PullRefresh>
  )
}

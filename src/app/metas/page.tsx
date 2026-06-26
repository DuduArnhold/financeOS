'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { 
  Target, 
  Plus, 
  Trash2, 
  X, 
  Check, 
  Edit2, 
  DollarSign,
  TrendingUp
} from 'lucide-react'
import Loader from '@/components/Loader'
import { toast } from 'sonner'

interface Meta {
  id: string
  nome: string
  valor_meta: number
  valor_atual: number // Calculado dinamicamente
}

export default function MetasPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  const [metas, setMetas] = useState<Meta[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [valorMeta, setValorMeta] = useState('')
  const [valorInicial, setValorInicial] = useState('0') // Apenas no cadastro de nova meta
  const [submitting, setSubmitting] = useState(false)

  // Quick Deposit State
  const [activeDepositId, setActiveDepositId] = useState<string | null>(null)
  const [depositAmount, setDepositAmount] = useState('')
  const [depositing, setDepositing] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  const loadMetas = async () => {
    if (!user || !profile) return
    setDataLoading(true)
    try {
      // 1. Buscar todas as metas do usuário
      const { data: metasData, error: metasError } = await supabase
        .from('finance_metas')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (metasError) throw metasError

      // 2. Buscar depósitos de metas (seguro via RLS)
      const { data: depositsData, error: depositsError } = await supabase
        .from('finance_goal_deposits')
        .select('meta_id, valor')

      if (depositsError) throw depositsError

      // 3. Mapear e consolidar os valores atuais (somatória de depósitos)
      const depositsMap: { [metaId: string]: number } = {}
      ;(depositsData || []).forEach((dep) => {
        depositsMap[dep.meta_id] = (depositsMap[dep.meta_id] || 0) + Number(dep.valor)
      })

      const consolidatedMetas = (metasData || []).map((meta: any) => ({
        id: meta.id,
        nome: meta.nome,
        valor_meta: Number(meta.valor_meta),
        valor_atual: depositsMap[meta.id] || 0
      }))

      setMetas(consolidatedMetas)
    } catch (err) {
      console.error('Error fetching metas:', err)
      toast.error('Erro ao carregar metas.')
    } finally {
      setDataLoading(false)
    }
  }

  useEffect(() => {
    loadMetas()
  }, [user, profile])

  const handleOpenNewForm = () => {
    setEditingId(null)
    setNome('')
    setValorMeta('')
    setValorInicial('0')
    setIsFormOpen(true)
  }

  const handleOpenEditForm = (meta: Meta) => {
    setEditingId(meta.id)
    setNome(meta.nome)
    setValorMeta(meta.valor_meta.toString())
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      toast.error('Informe o nome da meta.')
      return
    }
    if (!valorMeta || Number(valorMeta) <= 0) {
      toast.error('Informe um valor de meta maior que zero.')
      return
    }

    setSubmitting(true)
    try {
      if (editingId) {
        // Edit Mode (Apenas nome e valor alvo)
        const { error } = await supabase
          .from('finance_metas')
          .update({
            nome: nome.trim(),
            valor_meta: Number(valorMeta)
          })
          .eq('id', editingId)

        if (error) throw error
        toast.success('Meta atualizada com sucesso!')
      } else {
        // Create Mode
        const { data: newMeta, error: metaErr } = await supabase
          .from('finance_metas')
          .insert({
            user_id: user?.id,
            nome: nome.trim(),
            valor_meta: Number(valorMeta)
          })
          .select()
          .single()

        if (metaErr) throw metaErr

        // Se houver valor inicial guardado, registra o primeiro depósito
        if (Number(valorInicial) > 0) {
          const { error: depErr } = await supabase
            .from('finance_goal_deposits')
            .insert({
              meta_id: newMeta.id,
              valor: Number(valorInicial),
              data: new Date().toISOString().split('T')[0]
            })

          if (depErr) throw depErr
        }

        toast.success('Meta criada!')
      }

      handleCloseForm()
      await loadMetas()
    } catch (err: any) {
      console.error('Error submitting meta:', err)
      toast.error(err.message || 'Erro ao registrar meta.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta meta?')) return

    try {
      const { error } = await supabase
        .from('finance_metas')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Meta excluída.')
      await loadMetas()
    } catch (err: any) {
      console.error('Error deleting meta:', err)
      toast.error(err.message || 'Erro ao excluir meta.')
    }
  }

  const handleQuickDeposit = async (meta: Meta) => {
    const amount = Number(depositAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Informe um valor de aporte válido.')
      return
    }

    setDepositing(true)
    const newTotal = Number(meta.valor_atual) + amount

    // Optimistic Update
    setMetas(prev => 
      prev.map(m => m.id === meta.id ? { ...m, valor_atual: newTotal } : m)
    )

    try {
      // Registrar o aporte inserindo uma movimentação de depósito
      const { error } = await supabase
        .from('finance_goal_deposits')
        .insert({
          meta_id: meta.id,
          valor: amount,
          data: new Date().toISOString().split('T')[0]
        })

      if (error) throw error
      
      toast.success(`Aporte de ${formatCurrency(amount, profile?.moeda)} realizado!`)
      setDepositAmount('')
      setActiveDepositId(null)
      await loadMetas() // Sincronizar dados reais
    } catch (err: any) {
      // Reverter em caso de erro
      setMetas(prev => 
        prev.map(m => m.id === meta.id ? { ...m, valor_atual: meta.valor_atual } : m)
      )
      console.error('Error updating meta value:', err)
      toast.error(err.message || 'Erro ao registrar aporte.')
    } finally {
      setDepositing(false)
    }
  }

  if (loading || dataLoading || !profile) {
    return <Loader />
  }

  const currencySymbol = profile.moeda || 'R$'

  return (
    <main className="container max-w-lg mx-auto px-4 pt-6 pb-20 animate-fade-in">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Objetivos</span>
          <h1 className="text-2xl font-bold text-white tracking-tight">Metas</h1>
        </div>
        {!isFormOpen && (
          <button
            onClick={handleOpenNewForm}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-600/10 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova Meta
          </button>
        )}
      </div>

      {/* Form Section */}
      {isFormOpen && (
        <div className="glass-card rounded-2xl p-6 border-slate-800/80 mb-6 shadow-xl animate-fade-in">
          <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-800/40">
            <h2 className="text-sm font-semibold text-slate-200">
              {editingId ? 'Editar Meta' : 'Criar Nova Meta'}
            </h2>
            <button 
              onClick={handleCloseForm}
              className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-800/40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-medium">Nome do objetivo</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Notebook, Viagem, Reserva"
                className="w-full px-4 py-2 rounded-xl text-sm glass-input"
                disabled={submitting}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-medium">Valor total (meta)</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <DollarSign className="w-4 h-4 text-indigo-400" />
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={valorMeta}
                  onChange={(e) => setValorMeta(e.target.value)}
                  placeholder="7000,00"
                  className="w-full pl-9 pr-4 py-2 rounded-xl text-sm glass-input text-indigo-400 font-semibold"
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            {/* Apenas exibe o valor inicial ao CRIAR uma nova meta */}
            {!editingId && (
              <div className="space-y-1">
                <label className="text-slate-300 text-xs font-medium">Valor inicial guardado</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={valorInicial}
                    onChange={(e) => setValorInicial(e.target.value)}
                    placeholder="2100,00"
                    className="w-full pl-9 pr-4 py-2 rounded-xl text-sm glass-input text-emerald-400 font-semibold"
                    disabled={submitting}
                    required
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleCloseForm}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-xl text-xs font-medium transition-all duration-200 flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10 active:scale-95 cursor-pointer"
                disabled={submitting}
              >
                {submitting ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    {editingId ? 'Salvar' : 'Confirmar'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Metas List */}
      <div className="space-y-4">
        {metas.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 border-slate-800/80 text-center">
            <p className="text-xs text-slate-500 font-medium">
              Você ainda não criou nenhuma meta. Comece definindo seu primeiro objetivo!
            </p>
          </div>
        ) : (
          metas.map((meta) => {
            const pct = Math.min(100, Math.round((meta.valor_atual / meta.valor_meta) * 100)) || 0
            const isDepositOpen = activeDepositId === meta.id

            return (
              <div 
                key={meta.id} 
                className="glass-card rounded-2xl p-5 border-slate-800/80 shadow-md relative overflow-hidden group hover:border-slate-700 transition-all"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />

                {/* Meta Header */}
                <div className="flex justify-between items-start mb-3.5">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                      <Target className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-200">{meta.nome}</h3>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Meta: {formatCurrency(meta.valor_meta, currencySymbol)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenEditForm(meta)}
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(meta.id)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress Stats */}
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-xs text-slate-400 font-medium">Progresso acumulado</span>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-extrabold text-emerald-400">
                      {formatCurrency(meta.valor_atual, currencySymbol)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      ({pct}%)
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden mb-4">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Quick Add Inline Form */}
                <div className="pt-2.5 border-t border-slate-800/40">
                  {isDepositOpen ? (
                    <div className="flex items-center gap-2 animate-fade-in">
                      <div className="relative flex-1">
                        <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 pointer-events-none">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          placeholder="Valor do Aporte"
                          className="w-full pl-7 pr-3 py-1 rounded-lg text-xs glass-input font-medium"
                          disabled={depositing}
                          autoFocus
                        />
                      </div>
                      <button
                        onClick={() => handleQuickDeposit(meta)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                        disabled={depositing}
                        title="Confirmar aporte"
                      >
                        {depositing ? (
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setActiveDepositId(null)
                          setDepositAmount('')
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 p-1.5 rounded-lg transition-colors cursor-pointer"
                        disabled={depositing}
                        title="Cancelar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setActiveDepositId(meta.id)
                        setDepositAmount('')
                      }}
                      className="w-full text-center py-1.5 bg-indigo-500/5 border border-indigo-500/10 text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/20 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      Fazer Aporte Rápido
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </main>
  )
}

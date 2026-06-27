'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getBillingCycleRange, formatCurrency, formatDateLabel } from '@/lib/utils'
import { 
  TrendingUp, 
  Plus, 
  Trash2, 
  X, 
  Check, 
  Edit2, 
  Calendar,
  Tag,
  DollarSign,
  Briefcase
} from 'lucide-react'
import Loader from '@/components/Loader'
import { toast } from 'sonner'
import { movementService } from '@/services/movement.service'
import { accountService } from '@/services/account.service'
import { categoryService } from '@/services/category.service'
import { Movement } from '@/repositories/movement.repository'
import { Category } from '@/repositories/category.repository'
import { Account } from '@/repositories/account.repository'

export default function ReceitasPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  const [receitas, setReceitas] = useState<Movement[]>([])
  const [categorias, setCategorias] = useState<Category[]>([])
  const [contas, setContas] = useState<Account[]>([])
  
  const [dataLoading, setDataLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null)
  const [valor, setValor] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  const loadInitialData = async () => {
    if (!user || !profile) return
    setDataLoading(true)
    try {
      const closingDay = profile.fechamento_dia || 30
      const { startDate, endDate } = getBillingCycleRange(closingDay)
      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]

      // 1. Fetch categories
      const catResult = await categoryService.getCategoriesByType(user.id, 'receita')
      if (catResult.success && catResult.data) {
        setCategorias(catResult.data)
        if (catResult.data.length > 0) {
          setCategoriaId(catResult.data[0].id)
        }
      } else if (catResult.error) {
        toast.error(catResult.error)
      }

      // 2. Fetch accounts
      const accResult = await accountService.getActiveAccounts(user.id)
      if (accResult.success && accResult.data) {
        setContas(accResult.data)
        if (accResult.data.length > 0) {
          setAccountId(accResult.data[0].id)
        }
      } else if (accResult.error) {
        toast.error(accResult.error)
      }

      // 3. Fetch movements
      const movResult = await movementService.getMovements(user.id, 'receita', {
        startDate: startDateStr,
        endDate: endDateStr
      })
      if (movResult.success && movResult.data) {
        setReceitas(movResult.data)
      } else if (movResult.error) {
        toast.error(movResult.error)
      }
    } catch (err) {
      console.error('Error fetching data:', err)
      toast.error('Erro ao carregar receitas.')
    } finally {
      setDataLoading(false)
    }
  }

  useEffect(() => {
    loadInitialData()
  }, [user, profile])

  const handleOpenNewForm = () => {
    setEditingId(null)
    setValor('')
    if (categorias.length > 0) setCategoriaId(categorias[0].id)
    if (contas.length > 0) setAccountId(contas[0].id)
    setDescricao('')
    setData(new Date().toISOString().split('T')[0])
    setIsFormOpen(true)
  }

  const handleOpenEditForm = (rec: Movement) => {
    setEditingId(rec.id)
    setValor(rec.valor.toString())
    setCategoriaId(rec.categoriaId || '')
    setAccountId(rec.accountId)
    setDescricao(rec.descricao || '')
    setData(rec.data)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valor || Number(valor) <= 0) {
      toast.error('Informe um valor maior que zero.')
      return
    }
    if (!categoriaId) {
      toast.error('Selecione uma categoria.')
      return
    }
    if (!accountId) {
      toast.error('Selecione uma conta financeira.')
      return
    }

    setSubmitting(true)
    try {
      if (editingId) {
        // Edit Mode
        const result = await movementService.updateMovement(editingId, user!.id, {
          valor: Number(valor),
          categoriaId: categoriaId,
          accountId: accountId,
          descricao: descricao.trim() || null,
          data
        })

        if (result.success) {
          toast.success('Receita atualizada!')
          handleCloseForm()
          await loadInitialData()
        } else {
          toast.error(result.error || 'Erro ao atualizar receita.')
        }
      } else {
        // Create Mode
        const result = await movementService.createMovement({
          userId: user!.id,
          tipo: 'receita',
          valor: Number(valor),
          categoriaId: categoriaId,
          accountId: accountId,
          formaPagamento: 'Pix', // Valor default para o MVP
          descricao: descricao.trim() || null,
          data,
          origem: 'manual'
        })

        if (result.success) {
          toast.success('Receita registrada!')
          handleCloseForm()
          await loadInitialData()
        } else {
          toast.error(result.error || 'Erro ao registrar receita.')
        }
      }
    } catch (err: any) {
      console.error('Error submitting receita:', err)
      toast.error('Erro ao registrar receita.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta receita?')) return

    try {
      const result = await movementService.deleteMovement(id, user!.id)
      if (result.success) {
        toast.success('Receita excluída.')
        await loadInitialData()
      } else {
        toast.error(result.error || 'Erro ao excluir receita.')
      }
    } catch (err: any) {
      console.error('Error deleting receita:', err)
      toast.error('Erro ao excluir receita.')
    }
  }

  if (loading || dataLoading || !profile) {
    return <Loader />
  }

  const currencySymbol = profile.moeda || 'R$'
  const totalReceitas = receitas.reduce((sum, r) => sum + r.valor, 0)

  return (
    <main className="container max-w-lg mx-auto px-4 pt-6 pb-20 animate-fade-in">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Entradas</span>
          <h1 className="text-2xl font-bold text-white tracking-tight">Receitas</h1>
        </div>
        {!isFormOpen && (
          <button
            onClick={handleOpenNewForm}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-600/10 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova Receita
          </button>
        )}
      </div>

      {/* Header Totalizer */}
      <div className="glass-card rounded-2xl p-5 border-slate-800/80 mb-6 flex justify-between items-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Total recebido no ciclo</p>
            <p className="text-xl font-bold text-emerald-400 mt-0.5">
              {formatCurrency(totalReceitas, currencySymbol)}
            </p>
          </div>
        </div>
        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-medium">
          Dia de Fechamento: {profile.fechamento_dia}
        </span>
      </div>

      {/* Form Section */}
      {isFormOpen && (
        <div className="glass-card rounded-2xl p-6 border-slate-800/80 mb-6 shadow-xl animate-fade-in">
          <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-800/40">
            <h2 className="text-sm font-semibold text-slate-200">
              {editingId ? 'Editar Receita' : 'Registrar Nova Receita'}
            </h2>
            <button 
              onClick={handleCloseForm}
              className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-800/40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Valor */}
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-medium">Valor</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-9 pr-4 py-2 rounded-xl text-sm glass-input text-emerald-400 font-semibold"
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            {/* Categoria */}
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-medium">Categoria</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <Tag className="w-4 h-4" />
                </span>
                <select
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl text-sm glass-input appearance-none bg-[#0a0f1d] cursor-pointer"
                  disabled={submitting}
                  required
                >
                  {categorias.map((cat) => (
                    <option key={cat.id} value={cat.id} className="bg-slate-900 text-slate-200">
                      {cat.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Conta Financeira */}
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-medium">Destino (Conta Financeira)</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <Briefcase className="w-4 h-4" />
                </span>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl text-sm glass-input appearance-none bg-[#0a0f1d] cursor-pointer"
                  disabled={submitting}
                  required
                >
                  {contas.map((acc) => (
                    <option key={acc.id} value={acc.id} className="bg-slate-900 text-slate-200">
                      {acc.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-medium">Descrição (opcional)</label>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Freelance da semana"
                className="w-full px-4 py-2 rounded-xl text-sm glass-input"
                disabled={submitting}
              />
            </div>

            {/* Data */}
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-medium">Data</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <Calendar className="w-4 h-4" />
                </span>
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl text-sm glass-input cursor-pointer"
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            {/* Buttons */}
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
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-medium transition-all duration-200 flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/10 active:scale-95 cursor-pointer"
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

      {/* List of Receitas */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-300 mb-3 px-1">Registros deste ciclo</h2>
        {receitas.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 border-slate-800/80 text-center">
            <p className="text-xs text-slate-500 font-medium">
              Nenhuma receita registrada neste ciclo de faturamento.
            </p>
          </div>
        ) : (
          receitas.map((rec) => {
            const catName = rec.financeCategories?.nome || 'Outros'
            const catColor = rec.financeCategories?.cor || '#10b981'
            const accName = rec.financeAccounts?.nome || 'Carteira'

            return (
              <div 
                key={rec.id} 
                className="glass-card rounded-xl p-4 border-slate-800/80 flex items-center justify-between shadow-md relative group hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="p-2 rounded-xl"
                    style={{ 
                      backgroundColor: `${catColor}10`,
                      color: catColor
                    }}
                  >
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-200 line-clamp-1">
                      {rec.descricao || catName}
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {catName} • {accName} • {formatDateLabel(rec.data)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-sm font-bold text-emerald-400">
                    + {formatCurrency(rec.valor, currencySymbol)}
                  </div>
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenEditForm(rec)}
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(rec.id)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </main>
  )
}

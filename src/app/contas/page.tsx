'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency, formatDateLabel } from '@/lib/utils'
import { 
  CalendarDays, 
  Plus, 
  Trash2, 
  X, 
  Check, 
  Edit2, 
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  CreditCard,
  Briefcase,
  Tag,
  MessageSquare
} from 'lucide-react'
import Loader from '@/components/Loader'
import { toast } from 'sonner'
import { contaService } from '@/services/conta.service'
import { accountService } from '@/services/account.service'
import { categoryService } from '@/services/category.service'
import { Conta } from '@/repositories/conta.repository'
import { Account } from '@/repositories/account.repository'
import { Category } from '@/repositories/category.repository'

const FORMAS_PAGAMENTO = ['Pix', 'Boleto', 'Cartão de Crédito', 'Cartão de Débito', 'Dinheiro', 'Outro']

export default function ContasPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  const [contas, setContas] = useState<Conta[]>([])
  const [categorias, setCategorias] = useState<Category[]>([])
  const [contasFinanceiras, setContasFinanceiras] = useState<Account[]>([])
  
  const [dataLoading, setDataLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [vencimento, setVencimento] = useState(new Date().toISOString().split('T')[0])
  const [recorrente, setRecorrente] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Payment Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false)
  const [payingConta, setPayingConta] = useState<Conta | null>(null)
  const [payAccountId, setPayAccountId] = useState('')
  const [payCategoryId, setPayCategoryId] = useState('')
  const [payMethod, setPayMethod] = useState(FORMAS_PAGAMENTO[0])
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [payObservation, setPayObservation] = useState('')
  const [paying, setPaying] = useState(false)

  // Unpay Modal State
  const [isUnpayModalOpen, setIsUnpayModalOpen] = useState(false)
  const [unpayingConta, setUnpayingConta] = useState<Conta | null>(null)
  const [unpaying, setUnpaying] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  const loadContas = async () => {
    if (!user || !profile) return
    setDataLoading(true)
    try {
      const result = await contaService.getContas(user.id)
      if (result.success && result.data) {
        setContas(result.data)
      } else if (result.error) {
        toast.error(result.error)
      }
    } catch (err) {
      console.error('Error fetching contas:', err)
      toast.error('Erro ao carregar contas.')
    } finally {
      setDataLoading(false)
    }
  }

  const loadInitialData = async () => {
    if (!user || !profile) return
    try {
      const [contasRes, catRes] = await Promise.all([
        accountService.getActiveAccounts(user.id),
        categoryService.getCategoriesByType(user.id, 'despesa')
      ])
      if (contasRes.success && contasRes.data) {
        setContasFinanceiras(contasRes.data)
      }
      if (catRes.success && catRes.data) {
        setCategorias(catRes.data)
      }
    } catch (err) {
      console.error('Error loading static data for payment modal:', err)
    }
  }

  useEffect(() => {
    loadContas()
    loadInitialData()
  }, [user, profile])

  const handleOpenNewForm = () => {
    setEditingId(null)
    setNome('')
    setValor('')
    setVencimento(new Date().toISOString().split('T')[0])
    setRecorrente(false)
    setIsFormOpen(true)
  }

  const handleOpenEditForm = (conta: Conta) => {
    setEditingId(conta.id)
    setNome(conta.nome)
    setValor(conta.valor.toString())
    setVencimento(conta.vencimento)
    setRecorrente(conta.recorrente)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      toast.error('Informe o nome da conta.')
      return
    }
    if (!valor || Number(valor) <= 0) {
      toast.error('Informe um valor maior que zero.')
      return
    }
    if (!vencimento) {
      toast.error('Informe a data de vencimento.')
      return
    }

    setSubmitting(true)
    try {
      if (editingId) {
        // Edit Mode
        const result = await contaService.updateConta(
          editingId,
          user!.id,
          nome.trim(),
          Number(valor),
          vencimento,
          recorrente
        )
        if (result.success) {
          toast.success('Conta atualizada com sucesso!')
          handleCloseForm()
          await loadContas()
        } else {
          toast.error(result.error || 'Erro ao atualizar conta.')
        }
      } else {
        // Create Mode
        const result = await contaService.createConta(
          user!.id,
          nome.trim(),
          Number(valor),
          vencimento,
          recorrente
        )
        if (result.success) {
          toast.success('Conta registrada!')
          handleCloseForm()
          await loadContas()
        } else {
          toast.error(result.error || 'Erro ao registrar conta.')
        }
      }
    } catch (err: any) {
      console.error('Error submitting conta:', err)
      toast.error('Erro ao registrar conta.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta conta?')) return

    try {
      const result = await contaService.deleteConta(id, user!.id)
      if (result.success) {
        toast.success('Conta excluída.')
        await loadContas()
      } else {
        toast.error(result.error || 'Erro ao excluir conta.')
      }
    } catch (err: any) {
      console.error('Error deleting conta:', err)
      toast.error('Erro ao excluir conta.')
    }
  }

  const handleConfirmPayment = async () => {
    if (!payingConta || !user) return
    setPaying(true)
    try {
      const result = await contaService.payConta(
        payingConta.id,
        user.id,
        payAccountId,
        payCategoryId,
        payMethod,
        payDate,
        payObservation.trim()
      )
      if (result.success) {
        toast.success('Pagamento registrado com sucesso!')
        setIsPayModalOpen(false)
        setPayingConta(null)
        await loadContas()
      } else {
        toast.error(result.error || 'Erro ao registrar pagamento.')
      }
    } catch (err) {
      console.error(err)
      toast.error('Erro ao processar pagamento.')
    } finally {
      setPaying(false)
    }
  }

  const handleConfirmUnpay = async (deleteMovement: boolean) => {
    if (!unpayingConta || !user) return
    setUnpaying(true)
    try {
      const result = await contaService.unpayConta(
        unpayingConta.id,
        user.id,
        deleteMovement
      )
      if (result.success) {
        toast.success('Pagamento desfeito!')
        setIsUnpayModalOpen(false)
        setUnpayingConta(null)
        await loadContas()
      } else {
        toast.error(result.error || 'Erro ao desfazer pagamento.')
      }
    } catch (err) {
      console.error(err)
      toast.error('Erro ao desfazer pagamento.')
    } finally {
      setUnpaying(false)
    }
  }

  const toggleStatus = (conta: Conta) => {
    if (conta.paga) {
      setUnpayingConta(conta)
      setIsUnpayModalOpen(true)
    } else {
      setPayingConta(conta)
      
      // Default configurations
      if (contasFinanceiras.length > 0) {
        setPayAccountId(contasFinanceiras[0].id)
      }
      
      // Memory Link (Categoria preferida)
      if (conta.categoriaPreferidaId && categorias.some(c => c.id === conta.categoriaPreferidaId)) {
        setPayCategoryId(conta.categoriaPreferidaId)
      } else if (categorias.length > 0) {
        setPayCategoryId(categorias[0].id)
      } else {
        setPayCategoryId('')
      }

      setPayMethod(FORMAS_PAGAMENTO[0])
      setPayDate(new Date().toISOString().split('T')[0])
      setPayObservation(`Pagamento da conta: ${conta.nome}`)
      setIsPayModalOpen(true)
    }
  }

  if (loading || dataLoading || !profile) {
    return <Loader />
  }

  const currencySymbol = profile.moeda || 'R$'

  const contasPendentes = contas.filter(c => !c.paga)
  const contasPagas = contas.filter(c => c.paga)
  const totalPendente = contasPendentes.reduce((sum, c) => sum + c.valor, 0)

  return (
    <main className="container max-w-lg mx-auto px-4 pt-6 pb-20 animate-fade-in">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Compromissos</span>
          <h1 className="text-2xl font-bold text-white tracking-tight">Contas</h1>
        </div>
        {!isFormOpen && (
          <button
            onClick={handleOpenNewForm}
            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all duration-200 shadow-lg shadow-amber-600/10 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova Conta
          </button>
        )}
      </div>

      {/* Header Totalizer */}
      <div className="glass-card rounded-2xl p-5 border-slate-800/80 mb-6 flex justify-between items-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Total em contas pendentes</p>
            <p className="text-xl font-bold text-amber-400 mt-0.5">
              {formatCurrency(totalPendente, currencySymbol)}
            </p>
          </div>
        </div>
        <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
          {contasPendentes.length} {contasPendentes.length === 1 ? 'pendente' : 'pendentes'}
        </span>
      </div>

      {/* Form Section */}
      {isFormOpen && (
        <div className="glass-card rounded-2xl p-6 border-slate-800/80 mb-6 shadow-xl animate-fade-in">
          <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-800/40">
            <h2 className="text-sm font-semibold text-slate-200">
              {editingId ? 'Editar Conta' : 'Adicionar Nova Conta'}
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
              <label className="text-slate-300 text-xs font-medium">Nome da conta</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Internet, Aluguel, Luz"
                className="w-full px-4 py-2 rounded-xl text-sm glass-input"
                disabled={submitting}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-medium">Valor</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <DollarSign className="w-4 h-4 text-amber-400" />
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-9 pr-4 py-2 rounded-xl text-sm glass-input text-amber-400 font-semibold"
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-medium">Data de Vencimento</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <Calendar className="w-4 h-4" />
                </span>
                <input
                  type="date"
                  value={vencimento}
                  onChange={(e) => setVencimento(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl text-sm glass-input cursor-pointer"
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2 py-2">
              <input
                type="checkbox"
                id="recorrente"
                checked={recorrente}
                onChange={(e) => setRecorrente(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500/30 cursor-pointer"
                disabled={submitting}
              />
              <label htmlFor="recorrente" className="text-slate-300 text-xs font-medium flex items-center gap-1.5 select-none cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                Esta conta é recorrente? (Repete todo mês)
              </label>
            </div>

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
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2 rounded-xl text-xs font-medium transition-all duration-200 flex items-center justify-center gap-1.5 shadow-lg shadow-amber-600/10 active:scale-95 cursor-pointer"
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

      {/* Contas List */}
      <div className="space-y-6">
        {/* Section: Pendentes */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1 flex items-center gap-2 animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Pendentes ({contasPendentes.length})
          </h2>
          {contasPendentes.length === 0 ? (
            <div className="glass-card rounded-xl p-6 border-slate-800/80 text-center">
              <p className="text-xs text-slate-500 font-medium">Tudo pago! Nenhuma conta pendente.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {contasPendentes.map((conta) => (
                <div 
                  key={conta.id} 
                  className="glass-card rounded-xl p-4 border-slate-800/80 flex items-center justify-between shadow-md relative group hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleStatus(conta)}
                      className="p-1.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-slate-500 hover:text-emerald-400 hover:border-emerald-400/30 hover:bg-emerald-400/5 transition-all cursor-pointer"
                      title="Marcar como paga"
                    >
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    </button>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-slate-200 line-clamp-1">{conta.nome}</h3>
                        {conta.recorrente && (
                          <span className="text-[8px] bg-indigo-500/10 text-indigo-400 px-1 py-0.5 rounded font-medium flex items-center gap-0.5">
                            <RefreshCw className="w-2.5 h-2.5" />
                            Mensal
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Vence em {formatDateLabel(conta.vencimento)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-bold text-amber-400">
                      {formatCurrency(conta.valor, currencySymbol)}
                    </div>
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEditForm(conta)}
                        className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(conta.id)}
                        className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section: Pagas */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1 flex items-center gap-2 animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Pagas ({contasPagas.length})
          </h2>
          {contasPagas.length === 0 ? (
            <div className="glass-card rounded-xl p-6 border-slate-800/80 text-center">
              <p className="text-xs text-slate-500 font-medium">Nenhuma conta paga ainda.</p>
            </div>
          ) : (
            <div className="space-y-2.5 opacity-60 hover:opacity-90 transition-opacity">
              {contasPagas.map((conta) => (
                <div 
                  key={conta.id} 
                  className="glass-card rounded-xl p-4 border-slate-800/80 flex items-center justify-between shadow-md relative group hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleStatus(conta)}
                      className="p-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:text-amber-500 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all cursor-pointer"
                      title="Marcar como pendente"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </button>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-slate-300 line-clamp-1 line-through">{conta.nome}</h3>
                        {conta.recorrente && (
                          <span className="text-[8px] bg-indigo-500/10 text-indigo-400 px-1 py-0.5 rounded font-medium flex items-center gap-0.5">
                            <RefreshCw className="w-2.5 h-2.5" />
                            Mensal
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Paga • Vencimento: {formatDateLabel(conta.vencimento)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-bold text-slate-400 line-through">
                      {formatCurrency(conta.valor, currencySymbol)}
                    </div>
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleDelete(conta.id)}
                        className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Pagamento */}
      {isPayModalOpen && payingConta && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 border-slate-800 max-w-sm w-full shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Confirmar Pagamento
              </h3>
              <button 
                onClick={() => { setIsPayModalOpen(false); setPayingConta(null); }}
                className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Você está marcando a conta <strong className="text-slate-200">{payingConta.nome}</strong> no valor de <strong className="text-emerald-400">{formatCurrency(payingConta.valor, currencySymbol)}</strong> como paga.
            </p>

            <div className="space-y-4">
              {/* Conta Financeira */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                  Conta de Origem
                </label>
                <select
                  value={payAccountId}
                  onChange={(e) => setPayAccountId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold glass-input cursor-pointer"
                >
                  {contasFinanceiras.length === 0 ? (
                    <option value="">Nenhuma conta ativa disponível</option>
                  ) : (
                    contasFinanceiras.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.nome}</option>
                    ))
                  )}
                </select>
              </div>

              {/* Categoria */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-rose-400" />
                  Categoria da Despesa
                </label>
                <select
                  value={payCategoryId}
                  onChange={(e) => setPayCategoryId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold glass-input cursor-pointer"
                >
                  {categorias.length === 0 ? (
                    <option value="">Nenhuma categoria de despesa disponível</option>
                  ) : (
                    categorias.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nome}</option>
                    ))
                  )}
                </select>
              </div>

              {/* Forma de Pagamento */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  Forma de Pagamento
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold glass-input cursor-pointer"
                >
                  {FORMAS_PAGAMENTO.map(method => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>

              {/* Data de Pagamento */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  Data de Pagamento
                </label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold glass-input"
                />
              </div>

              {/* Observação / Descrição */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                  Descrição da Transação
                </label>
                <input
                  type="text"
                  value={payObservation}
                  onChange={(e) => setPayObservation(e.target.value)}
                  placeholder="Ex: Pagamento da conta de Luz"
                  className="w-full px-3 py-2 rounded-xl text-xs font-medium glass-input"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => { setIsPayModalOpen(false); setPayingConta(null); }}
                className="flex-1 bg-slate-850 hover:bg-slate-800 text-slate-300 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                disabled={paying}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/10 active:scale-95 cursor-pointer"
                disabled={paying || !payAccountId || !payCategoryId}
              >
                {paying ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Pagar Conta
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Desfazer Pagamento */}
      {isUnpayModalOpen && unpayingConta && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 border-slate-800 max-w-sm w-full shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Desfazer Pagamento
              </h3>
              <button 
                onClick={() => { setIsUnpayModalOpen(false); setUnpayingConta(null); }}
                className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Você deseja reverter o pagamento da conta <strong className="text-white">{unpayingConta.nome}</strong> de <strong className="text-amber-400">{formatCurrency(unpayingConta.valor, currencySymbol)}</strong> para o status de <strong>Pendente</strong>?
            </p>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 mb-5">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Esta conta gerou uma despesa correspondente em seu histórico financeiro. O que gostaria de fazer com essa movimentação?
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleConfirmUnpay(true)}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/10 active:scale-95 cursor-pointer"
                disabled={unpaying}
              >
                {unpaying ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Sim, excluir despesa
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmUnpay(false)}
                className="w-full bg-slate-850 hover:bg-slate-800 text-slate-300 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                disabled={unpaying}
              >
                Não, manter despesa (desvincular)
              </button>
              <button
                type="button"
                onClick={() => { setIsUnpayModalOpen(false); setUnpayingConta(null); }}
                className="w-full bg-transparent hover:bg-slate-900/40 text-slate-400 hover:text-slate-300 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                disabled={unpaying}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

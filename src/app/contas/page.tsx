'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth }   from '@/context/AuthContext'
import { useToast }  from '@/context/ToastContext'
import { useDialog } from '@/context/DialogContext'
import { formatCurrency, formatDateLabel } from '@/lib/utils'
import {
  CalendarDays, Plus, Calendar, DollarSign, AlertCircle, CheckCircle2,
  RefreshCw, CreditCard, Tag, MessageSquare, Trash2
} from 'lucide-react'

import { AppShell }       from '@/components/layout/AppShell'
import { PageHeader, PageTitle } from '@/components/layout/PageHeader'
import { Button }         from '@/components/ui/Button'
import { Card }           from '@/components/ui/Card'
import { Input }          from '@/components/ui/Input'
import { Select }         from '@/components/ui/Select'
import { Badge }          from '@/components/ui/Badge'
import { ActionRow }      from '@/components/finance/ActionRow'
import { BottomSheet }    from '@/components/feedback/BottomSheet'
import { SkeletonTable }  from '@/components/feedback/Skeletons'
import { PullRefresh }    from '@/components/mobile/PullRefresh'
import { KPIWidget }      from '@/components/finance/Widgets'

import { contaService }   from '@/services/conta.service'
import { accountService }  from '@/services/account.service'
import { categoryService }  from '@/services/category.service'
import { Conta }           from '@/repositories/conta.repository'
import { Account }         from '@/repositories/account.repository'
import { Category }        from '@/repositories/category.repository'

const TODAY = new Date().toISOString().split('T')[0]
const FORMAS_PAGAMENTO = [
  { value: 'Pix', label: 'Pix' },
  { value: 'Boleto', label: 'Boleto' },
  { value: 'Cartão de Crédito', label: 'Cartão de Crédito' },
  { value: 'Cartão de Débito', label: 'Cartão de Débito' },
  { value: 'Dinheiro', label: 'Dinheiro' },
  { value: 'Outro', label: 'Outro' }
]

export default function ContasPage() {
  const { user, profile, loading } = useAuth()
  const toast  = useToast()
  const dialog = useDialog()
  const router = useRouter()

  const [contas,            setContas]            = useState<Conta[]>([])
  const [categorias,        setCategorias]        = useState<Category[]>([])
  const [contasFinanceiras, setContasFinanceiras] = useState<Account[]>([])
  const [dataLoading,       setDataLoading]       = useState(true)
  
  // Create / Edit Form State
  const [sheetOpen,   setSheetOpen]   = useState(false)
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [nome,        setNome]        = useState('')
  const [valor,       setValor]       = useState('')
  const [vencimento,  setVencimento]  = useState(TODAY)
  const [recorrente,  setRecorrente]  = useState(false)
  const [submitState, setSubmitState] = useState<'idle'|'loading'|'success'|'error'>('idle')

  // Payment BottomSheet State
  const [paySheetOpen,    setPaySheetOpen]    = useState(false)
  const [payingConta,     setPayingConta]     = useState<Conta | null>(null)
  const [payAccountId,    setPayAccountId]    = useState('')
  const [payCategoryId,   setPayCategoryId]   = useState('')
  const [payMethod,       setPayMethod]       = useState(FORMAS_PAGAMENTO[0].value)
  const [payDate,         setPayDate]         = useState(TODAY)
  const [payObservation,  setPayObservation]  = useState('')
  const [paySubmitState,  setPaySubmitState]  = useState<'idle'|'loading'|'success'|'error'>('idle')

  // Unpay BottomSheet State
  const [unpaySheetOpen,  setUnpaySheetOpen]  = useState(false)
  const [unpayingConta,   setUnpayingConta]   = useState<Conta | null>(null)
  const [unpaySubmitState,setUnpaySubmitState]= useState<'idle'|'loading'|'success'|'error'>('idle')

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const loadContas = useCallback(async () => {
    if (!user || !profile) return
    setDataLoading(true)
    try {
      const result = await contaService.getContas(user.id)
      if (result.success && result.data) {
        setContas(result.data)
      } else if (result.error) {
        toast.error(result.error)
      }
    } catch {
      toast.error('Erro ao carregar contas.')
    } finally {
      setDataLoading(false)
    }
  }, [user, profile, toast])

  const loadInitialData = useCallback(async () => {
    if (!user) return
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
      console.error('Error loading account and categories data for payment modal:', err)
    }
  }, [user])

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadContas()
      loadInitialData()
    }, 0)
    return () => clearTimeout(timeout)
  }, [loadContas, loadInitialData])

  const openNew = useCallback(() => {
    setEditingId(null); setNome(''); setValor(''); setVencimento(TODAY); setRecorrente(false)
    setSheetOpen(true)
  }, [])

  const openEdit = useCallback((conta: Conta) => {
    setEditingId(conta.id)
    setNome(conta.nome)
    setValor(conta.valor.toString())
    setVencimento(conta.vencimento)
    setRecorrente(conta.recorrente)
    setSheetOpen(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) { toast.error('Informe o nome da conta.'); return }
    if (!valor || Number(valor) <= 0) { toast.error('Informe um valor maior que zero.'); return }
    if (!vencimento) { toast.error('Informe a data de vencimento.'); return }

    setSubmitState('loading')
    try {
      const result = editingId
        ? await contaService.updateConta(editingId, user!.id, nome.trim(), Number(valor), vencimento, recorrente)
        : await contaService.createConta(user!.id, nome.trim(), Number(valor), vencimento, recorrente)

      if (result.success) {
        setSubmitState('success')
        toast.success(editingId ? 'Conta atualizada!' : 'Conta registrada!')
        setTimeout(() => { setSheetOpen(false); setSubmitState('idle'); loadContas() }, 800)
      } else {
        setSubmitState('error')
        toast.error(result.error || 'Erro ao registrar conta.')
        setTimeout(() => setSubmitState('idle'), 2000)
      }
    } catch {
      setSubmitState('error')
      toast.error('Erro ao salvar conta.')
      setTimeout(() => setSubmitState('idle'), 2000)
    }
  }

  const handleDelete = useCallback(async (id: string) => {
    const ok = await dialog.confirm({
      title: 'Excluir conta?',
      description: 'Essa ação não pode ser desfeita e removerá os dados de vencimento.',
      confirmText: 'Excluir',
      variant: 'danger',
    })
    if (!ok) return

    try {
      const result = await contaService.deleteConta(id, user!.id)
      if (result.success) {
        toast.success('Conta excluída.')
        loadContas()
      } else {
        toast.error(result.error || 'Erro ao excluir conta.')
      }
    } catch {
      toast.error('Erro ao excluir conta.')
    }
  }, [dialog, toast, user, loadContas])

  const handleConfirmPayment = async () => {
    if (!payingConta || !user) return
    setPaySubmitState('loading')
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
        setPaySubmitState('success')
        toast.success('Pagamento registrado!')
        setTimeout(() => { setPaySheetOpen(false); setPayingConta(null); setPaySubmitState('idle'); loadContas() }, 800)
      } else {
        setPaySubmitState('error')
        toast.error(result.error || 'Erro ao registrar pagamento.')
        setTimeout(() => setPaySubmitState('idle'), 2000)
      }
    } catch {
      setPaySubmitState('error')
      toast.error('Erro ao processar pagamento.')
      setTimeout(() => setPaySubmitState('idle'), 2000)
    }
  }

  const handleConfirmUnpay = async (deleteMovement: boolean) => {
    if (!unpayingConta || !user) return
    setUnpaySubmitState('loading')
    try {
      const result = await contaService.unpayConta(unpayingConta.id, user.id, deleteMovement)
      if (result.success) {
        setUnpaySubmitState('success')
        toast.success('Pagamento desfeito!')
        setTimeout(() => { setUnpaySheetOpen(false); setUnpayingConta(null); setUnpaySubmitState('idle'); loadContas() }, 800)
      } else {
        setUnpaySubmitState('error')
        toast.error(result.error || 'Erro ao desfazer pagamento.')
        setTimeout(() => setUnpaySubmitState('idle'), 2000)
      }
    } catch {
      setUnpaySubmitState('error')
      toast.error('Erro ao desfazer pagamento.')
      setTimeout(() => setUnpaySubmitState('idle'), 2000)
    }
  }

  const toggleStatus = useCallback((conta: Conta) => {
    if (conta.paga) {
      setUnpayingConta(conta)
      setUnpaySheetOpen(true)
    } else {
      setPayingConta(conta)
      
      if (contasFinanceiras.length > 0) {
        setPayAccountId(contasFinanceiras[0].id)
      } else {
        setPayAccountId('')
      }
      
      if (conta.categoriaPreferidaId && categorias.some(c => c.id === conta.categoriaPreferidaId)) {
        setPayCategoryId(conta.categoriaPreferidaId)
      } else if (categorias.length > 0) {
        setPayCategoryId(categorias[0].id)
      } else {
        setPayCategoryId('')
      }

      setPayMethod(FORMAS_PAGAMENTO[0].value)
      setPayDate(TODAY)
      setPayObservation(`Pagamento da conta: ${conta.nome}`)
      setPaySheetOpen(true)
    }
  }, [contasFinanceiras, categorias])

  const currencySymbol = profile?.moeda || 'R$'
  const contasPendentes = useMemo(() => contas.filter(c => !c.paga), [contas])
  const contasPagas     = useMemo(() => contas.filter(c => c.paga), [contas])
  const totalPendente   = useMemo(() => contasPendentes.reduce((sum, c) => sum + c.valor, 0), [contasPendentes])

  const accOptions = useMemo(() => contasFinanceiras.map(a => ({ value: a.id, label: a.nome })), [contasFinanceiras])
  const catOptions = useMemo(() => categorias.map(c => ({ value: c.id, label: c.nome })), [categorias])

  return (
    <PullRefresh onRefresh={loadContas}>
      <AppShell>
        <PageHeader
          left={<PageTitle eyebrow="Compromissos" title="Contas" />}
          right={
            <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNew}>
              Nova Conta
            </Button>
          }
        />

        {/* Totalizer */}
        <KPIWidget
          title="Total em contas pendentes"
          value={totalPendente}
          prefix={`${currencySymbol} `}
          icon={<CalendarDays className="w-5 h-5" />}
          accentClass="text-amber-400"
          glowClass="bg-amber-500/8"
          className="mb-4"
        >
          <div className="flex justify-between items-center mt-1.5">
            <span className="text-[11px] text-[var(--color-text-muted)]">Ciclo corrente</span>
            <Badge variant="warning">
              {contasPendentes.length} {contasPendentes.length === 1 ? 'pendente' : 'pendentes'}
            </Badge>
          </div>
        </KPIWidget>

        {/* List Grid */}
        <div className="space-y-6">
          {/* Skeletons */}
          {dataLoading ? (
            <Card className="p-5"><SkeletonTable rows={4} /></Card>
          ) : (
            <>
              {/* Section: Pendentes */}
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] px-1 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Pendentes ({contasPendentes.length})
                </h2>
                {contasPendentes.length === 0 ? (
                  <Card className="p-6 text-center text-xs text-[var(--color-text-muted)] font-medium">
                    Tudo pago! Nenhuma conta pendente. 🎉
                  </Card>
                ) : (
                  <Card className="p-1 divide-y divide-slate-800/40">
                    {contasPendentes.map((conta) => (
                      <ActionRow
                        key={conta.id}
                        onEdit={() => openEdit(conta)}
                        onDelete={() => handleDelete(conta.id)}
                      >
                        <div className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              onClick={() => toggleStatus(conta)}
                              className="p-1.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-slate-500 hover:text-emerald-400 hover:border-emerald-400/30 hover:bg-emerald-400/5 transition-all cursor-pointer"
                              title="Marcar como paga"
                            >
                              <AlertCircle className="w-4 h-4 text-amber-500" />
                            </button>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h3 className="text-sm font-bold text-[var(--color-text-primary)] line-clamp-1">{conta.nome}</h3>
                                {conta.recorrente && (
                                  <Badge variant="info" className="text-[9px] px-1 py-0.5">
                                    <RefreshCw className="w-2.5 h-2.5 mr-0.5" />
                                    Mensal
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[10px] text-[var(--color-text-secondary)]">
                                Vence em {formatDateLabel(conta.vencimento)}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-amber-400 flex-shrink-0 ml-3">
                            {formatCurrency(conta.valor, currencySymbol)}
                          </span>
                        </div>
                      </ActionRow>
                    ))}
                  </Card>
                )}
              </div>

              {/* Section: Pagas */}
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] px-1 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Pagas ({contasPagas.length})
                </h2>
                {contasPagas.length === 0 ? (
                  <Card className="p-6 text-center text-xs text-[var(--color-text-muted)] font-medium">
                    Nenhuma conta paga ainda.
                  </Card>
                ) : (
                  <Card className="p-1 divide-y divide-slate-800/40 opacity-60 hover:opacity-100 transition-opacity duration-150">
                    {contasPagas.map((conta) => (
                      <ActionRow
                        key={conta.id}
                        onDelete={() => handleDelete(conta.id)}
                      >
                        <div className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              onClick={() => toggleStatus(conta)}
                              className="p-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:text-amber-500 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all cursor-pointer"
                              title="Marcar como pendente"
                            >
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            </button>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h3 className="text-sm font-bold text-[var(--color-text-secondary)] line-through line-clamp-1">{conta.nome}</h3>
                                {conta.recorrente && (
                                  <Badge variant="default" className="text-[9px] px-1 py-0.5">
                                    <RefreshCw className="w-2.5 h-2.5 mr-0.5" />
                                    Mensal
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[10px] text-[var(--color-text-muted)]">
                                Paga · Vencimento: {formatDateLabel(conta.vencimento)}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-slate-400 line-through flex-shrink-0 ml-3">
                            {formatCurrency(conta.valor, currencySymbol)}
                          </span>
                        </div>
                      </ActionRow>
                    ))}
                  </Card>
                )}
              </div>
            </>
          )}
        </div>

        {/* Form BottomSheet */}
        <BottomSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={editingId ? 'Editar Conta' : 'Nova Conta'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nome da conta"
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Internet, Aluguel, Luz"
              required
            />
            <Input
              label="Valor"
              type="number" step="0.01" min="0.01"
              value={valor}
              onChange={e => setValor(e.target.value)}
              placeholder="0,00"
              leftIcon={<DollarSign className="w-4 h-4 text-amber-400" />}
              required
            />
            <Input
              label="Data de Vencimento"
              type="date"
              value={vencimento}
              onChange={e => setVencimento(e.target.value)}
              leftIcon={<Calendar className="w-4 h-4" />}
              required
            />
            <div className="flex items-center gap-2.5 py-1">
              <input
                type="checkbox"
                id="recorrente"
                checked={recorrente}
                onChange={e => setRecorrente(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500/30 cursor-pointer"
                disabled={submitState === 'loading'}
              />
              <label htmlFor="recorrente" className="text-xs font-semibold text-[var(--color-text-secondary)] flex items-center gap-1.5 select-none cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                Esta conta é recorrente? (Repete todo mês)
              </label>
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" variant="primary" state={submitState} className="flex-1">
                {editingId ? 'Salvar' : 'Registrar'}
              </Button>
            </div>
          </form>
        </BottomSheet>

        {/* Payment BottomSheet */}
        <BottomSheet
          open={paySheetOpen}
          onClose={() => { setPaySheetOpen(false); setPayingConta(null); }}
          title="Confirmar Pagamento"
        >
          {payingConta && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Marcando <strong className="text-[var(--color-text-primary)]">{payingConta.nome}</strong> de <strong className="text-emerald-400">{formatCurrency(payingConta.valor, currencySymbol)}</strong> como paga.
                </p>
              </div>

              <form onSubmit={e => { e.preventDefault(); handleConfirmPayment(); }} className="space-y-4">
                <Select
                  label="Conta de origem"
                  options={accOptions}
                  value={payAccountId}
                  onChange={e => setPayAccountId(e.target.value)}
                  leftIcon={<CreditCard className="w-4 h-4 text-indigo-400" />}
                  required
                />
                <Select
                  label="Categoria de Despesa"
                  options={catOptions}
                  value={payCategoryId}
                  onChange={e => setPayCategoryId(e.target.value)}
                  leftIcon={<Tag className="w-4 h-4 text-rose-400" />}
                  required
                />
                <Select
                  label="Forma de Pagamento"
                  options={FORMAS_PAGAMENTO}
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value)}
                  leftIcon={<DollarSign className="w-4 h-4 text-emerald-400" />}
                  required
                />
                <Input
                  label="Data do Pagamento"
                  type="date"
                  value={payDate}
                  onChange={e => setPayDate(e.target.value)}
                  leftIcon={<Calendar className="w-4 h-4 text-amber-400" />}
                  required
                />
                <Input
                  label="Descrição da Transação"
                  type="text"
                  value={payObservation}
                  onChange={e => setPayObservation(e.target.value)}
                  placeholder="Ex: Pagamento da conta de Luz"
                  leftIcon={<MessageSquare className="w-4 h-4 text-slate-500" />}
                />

                <div className="flex gap-3 pt-1">
                  <Button type="button" variant="outline" onClick={() => { setPaySheetOpen(false); setPayingConta(null); }} className="flex-1">
                    Cancelar
                  </Button>
                  <Button type="submit" variant="success-variant" state={paySubmitState} disabled={!payAccountId || !payCategoryId} className="flex-1">
                    Pagar Conta
                  </Button>
                </div>
              </form>
            </div>
          )}
        </BottomSheet>

        {/* Unpay BottomSheet */}
        <BottomSheet
          open={unpaySheetOpen}
          onClose={() => { setUnpaySheetOpen(false); setUnpayingConta(null); }}
          title="Desfazer Pagamento"
        >
          {unpayingConta && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Você quer reverter o pagamento da conta <strong className="text-[var(--color-text-primary)]">{unpayingConta.nome}</strong> no valor de <strong className="text-amber-400">{formatCurrency(unpayingConta.valor, currencySymbol)}</strong> para o status de <strong className="text-amber-400">Pendente</strong>?
              </p>

              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800">
                <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                  Isso gerará uma ação sobre o registro de despesa correspondente que foi criado no seu histórico financeiro.
                </p>
              </div>

              <div className="space-y-2.5">
                <Button
                  variant="danger"
                  state={unpaySubmitState}
                  onClick={() => handleConfirmUnpay(true)}
                  className="w-full flex justify-center"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Sim, excluir despesa
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleConfirmUnpay(false)}
                  className="w-full flex justify-center border-slate-700 hover:bg-slate-800/80 text-[var(--color-text-primary)]"
                >
                  Não, manter despesa (desvincular)
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setUnpaySheetOpen(false); setUnpayingConta(null); }}
                  className="w-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </BottomSheet>
      </AppShell>
    </PullRefresh>
  )
}

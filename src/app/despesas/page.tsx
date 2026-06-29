'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth }   from '@/context/AuthContext'
import { useToast }  from '@/context/ToastContext'
import { useDialog } from '@/context/DialogContext'
import { getBillingCycleRange, formatCurrency, formatDateLabel } from '@/lib/utils'
import { TrendingDown, Plus, Calendar, Tag, DollarSign, Briefcase, CreditCard } from 'lucide-react'

import { AppShell }       from '@/components/layout/AppShell'
import { PageHeader, PageTitle } from '@/components/layout/PageHeader'
import { Button }         from '@/components/ui/Button'
import { Card }           from '@/components/ui/Card'
import { Input }          from '@/components/ui/Input'
import { Select }         from '@/components/ui/Select'
import { Badge }          from '@/components/ui/Badge'
import { ActionRow }      from '@/components/finance/ActionRow'
import { EmptyState }     from '@/components/feedback/EmptyState'
import { BottomSheet }    from '@/components/feedback/BottomSheet'
import { SkeletonTable }  from '@/components/feedback/Skeletons'
import { PullRefresh }    from '@/components/mobile/PullRefresh'
import { KPIWidget }      from '@/components/finance/Widgets'

import { movementService }  from '@/services/movement.service'
import { accountService }   from '@/services/account.service'
import { categoryService }  from '@/services/category.service'
import { Movement }         from '@/repositories/movement.repository'
import { Category }         from '@/repositories/category.repository'
import { Account }          from '@/repositories/account.repository'

const TODAY = new Date().toISOString().split('T')[0]
const FORMAS_PAGAMENTO = [
  { value: 'Dinheiro', label: 'Dinheiro' },
  { value: 'Cartão de Débito', label: 'Cartão de Débito' },
  { value: 'Cartão de Crédito', label: 'Cartão de Crédito' },
  { value: 'Pix', label: 'Pix' },
  { value: 'Boleto', label: 'Boleto' },
  { value: 'Outro', label: 'Outro' }
]

export default function DespesasPage() {
  const { user, profile, loading } = useAuth()
  const toast  = useToast()
  const dialog = useDialog()
  const router = useRouter()

  const [despesas,    setDespesas]    = useState<Movement[]>([])
  const [categorias,  setCategorias]  = useState<Category[]>([])
  const [contas,      setContas]      = useState<Account[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [sheetOpen,   setSheetOpen]   = useState(false)
  const [submitState, setSubmitState] = useState<'idle'|'loading'|'success'|'error'>('idle')

  // Form State
  const [editingId,      setEditingId]      = useState<string | null>(null)
  const [valor,          setValor]          = useState('')
  const [categoriaId,    setCategoriaId]    = useState('')
  const [accountId,      setAccountId]      = useState('')
  const [formaPagamento, setFormaPagamento] = useState(FORMAS_PAGAMENTO[0].value)
  const [descricao,      setDescricao]      = useState('')
  const [data,           setData]           = useState(TODAY)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const load = useCallback(async () => {
    if (!user || !profile) return
    setDataLoading(true)
    try {
      const { startDate, endDate } = getBillingCycleRange(profile.fechamento_dia || 30)
      const [catR, accR, movR] = await Promise.all([
        categoryService.getCategoriesByType(user.id, 'despesa'),
        accountService.getActiveAccounts(user.id),
        movementService.getMovements(user.id, 'despesa', {
          startDate: startDate.toISOString().split('T')[0],
          endDate:   endDate.toISOString().split('T')[0],
        }),
      ])
      if (catR.success && catR.data) { setCategorias(catR.data); if (!categoriaId && catR.data[0]) setCategoriaId(catR.data[0].id) }
      if (accR.success && accR.data) { setContas(accR.data);     if (!accountId   && accR.data[0]) setAccountId(accR.data[0].id)   }
      if (movR.success && movR.data)   setDespesas(movR.data)
    } catch { toast.error('Erro ao carregar despesas.') }
    finally  { setDataLoading(false) }
  }, [user, profile, toast]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  const openNew = useCallback(() => {
    setEditingId(null); setValor(''); setDescricao(''); setData(TODAY)
    setFormaPagamento(FORMAS_PAGAMENTO[0].value)
    if (categorias[0]) setCategoriaId(categorias[0].id)
    if (contas[0])     setAccountId(contas[0].id)
    setSheetOpen(true)
  }, [categorias, contas])

  const openEdit = useCallback((desp: Movement) => {
    setEditingId(desp.id)
    setValor(desp.valor.toString())
    setCategoriaId(desp.categoriaId || '')
    setAccountId(desp.accountId)
    setFormaPagamento(desp.formaPagamento)
    setDescricao(desp.descricao || '')
    setData(desp.data)
    setSheetOpen(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valor || Number(valor) <= 0) { toast.error('Informe um valor maior que zero.'); return }
    if (!categoriaId)                  { toast.error('Selecione uma categoria.');         return }
    if (!accountId)                    { toast.error('Selecione uma conta.');              return }

    setSubmitState('loading')
    try {
      const result = editingId
        ? await movementService.updateMovement(editingId, user!.id, {
            valor: Number(valor), categoriaId, accountId, formaPagamento,
            descricao: descricao.trim() || null, data,
          })
        : await movementService.createMovement({
            userId: user!.id, tipo: 'despesa', valor: Number(valor),
            categoriaId, accountId, formaPagamento,
            descricao: descricao.trim() || null, data, origem: 'manual',
          })

      if (result.success) {
        setSubmitState('success')
        toast.success(editingId ? 'Despesa atualizada!' : 'Despesa registrada!')
        setTimeout(() => { setSheetOpen(false); setSubmitState('idle'); load() }, 800)
      } else {
        setSubmitState('error')
        toast.error(result.error || 'Erro ao salvar despesa.')
        setTimeout(() => setSubmitState('idle'), 2000)
      }
    } catch {
      setSubmitState('error')
      toast.error('Erro ao salvar despesa.')
      setTimeout(() => setSubmitState('idle'), 2000)
    }
  }

  const handleDelete = useCallback(async (id: string) => {
    const ok = await dialog.confirm({
      title:       'Excluir despesa?',
      description: 'Essa ação não pode ser desfeita.',
      confirmText: 'Excluir',
      variant:     'danger',
    })
    if (!ok) return
    try {
      const result = await movementService.deleteMovement(id, user!.id)
      if (result.success) { toast.success('Despesa excluída.'); load() }
      else                  toast.error(result.error || 'Erro ao excluir.')
    } catch { toast.error('Erro ao excluir despesa.') }
  }, [dialog, toast, user, load])

  const currency    = profile?.moeda || 'R$'
  const totalDespesas = useMemo(() => despesas.reduce((s, r) => s + r.valor, 0), [despesas])
  const catOptions    = useMemo(() => categorias.map(c => ({ value: c.id, label: c.nome })), [categorias])
  const accOptions    = useMemo(() => contas.map(a => ({ value: a.id, label: a.nome })),     [contas])

  return (
    <PullRefresh onRefresh={load}>
      <AppShell>
        <PageHeader
          left={<PageTitle eyebrow="Saídas" title="Despesas" />}
          right={
            <Button variant="danger" size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNew}>
              Nova Despesa
            </Button>
          }
        />

        {/* Totalizer */}
        <KPIWidget
          title="Total gasto no ciclo"
          value={totalDespesas}
          prefix={`${currency} `}
          icon={<TrendingDown className="w-5 h-5" />}
          accentClass="text-rose-400"
          glowClass="bg-rose-500/8"
          className="mb-4"
        >
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            Fechamento dia {profile?.fechamento_dia}
          </p>
        </KPIWidget>

        {/* List */}
        {dataLoading ? (
          <Card className="p-5"><SkeletonTable rows={5} /></Card>
        ) : despesas.length === 0 ? (
          <Card className="p-2">
            <EmptyState
              icon="💸"
              title="Nenhuma despesa registrada"
              description="Registre sua primeira saída deste ciclo de faturamento."
              actionLabel="Nova Despesa"
              onAction={openNew}
            />
          </Card>
        ) : (
          <Card className="p-1 divide-y divide-slate-800/40">
            {despesas.map((desp) => {
              const catName  = desp.financeCategories?.nome || 'Outros'
              const catColor = desp.financeCategories?.cor  || '#f43f5e'
              const accName  = desp.financeAccounts?.nome   || 'Carteira'
              return (
                <ActionRow
                  key={desp.id}
                  onEdit={() => openEdit(desp)}
                  onDelete={() => handleDelete(desp.id)}
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="p-2 rounded-xl flex-shrink-0"
                        style={{ backgroundColor: `${catColor}15`, color: catColor }}
                      >
                        <TrendingDown className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[var(--color-text-primary)] line-clamp-1">
                          {desp.descricao || catName}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                          {catName} · {accName} · {desp.formaPagamento} · {formatDateLabel(desp.data)}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-rose-400 flex-shrink-0 ml-3">
                      − {formatCurrency(desp.valor, currency)}
                    </span>
                  </div>
                </ActionRow>
              )
            })}
          </Card>
        )}

        {/* Form BottomSheet */}
        <BottomSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={editingId ? 'Editar Despesa' : 'Nova Despesa'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Valor"
              type="number" step="0.01" min="0.01"
              value={valor}
              onChange={e => setValor(e.target.value)}
              placeholder="0,00"
              leftIcon={<DollarSign className="w-4 h-4 text-rose-400" />}
              required
            />
            <Select
              label="Categoria"
              options={catOptions}
              value={categoriaId}
              onChange={e => setCategoriaId(e.target.value)}
              leftIcon={<Tag className="w-4 h-4" />}
              required
            />
            <Select
              label="Conta de origem"
              options={accOptions}
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              leftIcon={<Briefcase className="w-4 h-4" />}
              required
            />
            <Select
              label="Forma de Pagamento"
              options={FORMAS_PAGAMENTO}
              value={formaPagamento}
              onChange={e => setFormaPagamento(e.target.value)}
              leftIcon={<CreditCard className="w-4 h-4" />}
              required
            />
            <Input
              label="Descrição (opcional)"
              type="text"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Ex: Almoço no restaurante"
            />
            <Input
              label="Data"
              type="date"
              value={data}
              onChange={e => setData(e.target.value)}
              leftIcon={<Calendar className="w-4 h-4" />}
              required
            />
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" variant="danger" state={submitState} className="flex-1">
                {editingId ? 'Salvar' : 'Registrar'}
              </Button>
            </div>
          </form>
        </BottomSheet>
      </AppShell>
    </PullRefresh>
  )
}

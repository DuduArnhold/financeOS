'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth }   from '@/context/AuthContext'
import { useToast }  from '@/context/ToastContext'
import { useDialog } from '@/context/DialogContext'
import { getBillingCycleRange, formatCurrency, formatDateLabel } from '@/lib/utils'
import { TrendingUp, Plus, Calendar, Tag, DollarSign, Briefcase } from 'lucide-react'

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

export default function ReceitasPage() {
  const { user, profile, loading } = useAuth()
  const toast  = useToast()
  const dialog = useDialog()
  const router = useRouter()

  const [receitas,         setReceitas]        = useState<Movement[]>([])
  const [categorias,       setCategorias]      = useState<Category[]>([])
  const [contas,           setContas]          = useState<Account[]>([])
  const [dataLoading,      setDataLoading]     = useState(true)
  const [sheetOpen,        setSheetOpen]       = useState(false)
  const [submitState,      setSubmitState]     = useState<'idle'|'loading'|'success'|'error'>('idle')
  const [filtroAccountId,  setFiltroAccountId] = useState('all')

  // Form
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [valor,       setValor]       = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [accountId,   setAccountId]   = useState('')
  const [descricao,   setDescricao]   = useState('')
  const [data,        setData]        = useState(TODAY)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const load = useCallback(async () => {
    if (!user || !profile) return
    setDataLoading(true)
    try {
      const { startDate, endDate } = getBillingCycleRange(profile.fechamento_dia || 30)
      const [catR, accR, movR] = await Promise.all([
        categoryService.getCategoriesByType(user.id, 'receita'),
        accountService.getActiveAccounts(user.id),
        movementService.getMovements(user.id, 'receita', {
          startDate: startDate.toISOString().split('T')[0],
          endDate:   endDate.toISOString().split('T')[0],
        }),
      ])
      if (catR.success && catR.data) { setCategorias(catR.data); if (!categoriaId && catR.data[0]) setCategoriaId(catR.data[0].id) }
      if (accR.success && accR.data) { setContas(accR.data);     if (!accountId   && accR.data[0]) setAccountId(accR.data[0].id)   }
      if (movR.success && movR.data)   setReceitas(movR.data)
    } catch { toast.error('Erro ao carregar receitas.') }
    finally  { setDataLoading(false) }
  }, [user, profile, toast]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  const openNew = useCallback(() => {
    setEditingId(null); setValor(''); setDescricao(''); setData(TODAY)
    if (categorias[0]) setCategoriaId(categorias[0].id)
    if (contas[0])     setAccountId(contas[0].id)
    setSheetOpen(true)
  }, [categorias, contas])

  const openEdit = useCallback((rec: Movement) => {
    setEditingId(rec.id)
    setValor(rec.valor.toString())
    setCategoriaId(rec.categoriaId || '')
    setAccountId(rec.accountId)
    setDescricao(rec.descricao || '')
    setData(rec.data)
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
            valor: Number(valor), categoriaId, accountId,
            descricao: descricao.trim() || null, data,
          })
        : await movementService.createMovement({
            userId: user!.id, tipo: 'receita', valor: Number(valor),
            categoriaId, accountId, formaPagamento: 'Pix',
            descricao: descricao.trim() || null, data, origem: 'manual',
          })

      if (result.success) {
        setSubmitState('success')
        toast.success(editingId ? 'Receita atualizada!' : 'Receita registrada!')
        setTimeout(() => { setSheetOpen(false); setSubmitState('idle'); load() }, 800)
      } else {
        setSubmitState('error')
        toast.error(result.error || 'Erro ao salvar receita.')
        setTimeout(() => setSubmitState('idle'), 2000)
      }
    } catch {
      setSubmitState('error')
      toast.error('Erro ao salvar receita.')
      setTimeout(() => setSubmitState('idle'), 2000)
    }
  }

  const handleDelete = useCallback(async (id: string) => {
    const ok = await dialog.confirm({
      title:       'Excluir receita?',
      description: 'Essa ação não pode ser desfeita.',
      confirmText: 'Excluir',
      variant:     'danger',
    })
    if (!ok) return
    try {
      const result = await movementService.deleteMovement(id, user!.id)
      if (result.success) { toast.success('Receita excluída.'); load() }
      else                  toast.error(result.error || 'Erro ao excluir.')
    } catch { toast.error('Erro ao excluir receita.') }
  }, [dialog, toast, user, load])

  const currency    = profile?.moeda || 'R$'

  // Computed and filtered values
  const filteredReceitas = useMemo(() => {
    if (filtroAccountId === 'all') return receitas
    return receitas.filter(r => r.accountId === filtroAccountId)
  }, [receitas, filtroAccountId])

  const totalReceitas = useMemo(() => filteredReceitas.reduce((s, r) => s + r.valor, 0), [filteredReceitas])
  const catOptions    = useMemo(() => categorias.map(c => ({ value: c.id, label: c.nome })), [categorias])
  const accOptions    = useMemo(() => contas.map(a => ({ value: a.id, label: a.nome })),     [contas])

  return (
    <PullRefresh onRefresh={load}>
      <AppShell>
        <PageHeader
          left={<PageTitle eyebrow="Entradas" title="Receitas" />}
          right={
            <Button variant="success-variant" size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNew}>
              Nova Receita
            </Button>
          }
        />

        {/* Totalizer */}
        <KPIWidget
          title="Total recebido no ciclo"
          value={totalReceitas}
          prefix={`${currency} `}
          icon={<TrendingUp className="w-5 h-5" />}
          accentClass="text-emerald-400"
          glowClass="bg-emerald-500/8"
          className="mb-4"
        >
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            Fechamento dia {profile?.fechamento_dia}
          </p>
        </KPIWidget>

        {/* Filter bar */}
        {!dataLoading && contas.length > 0 && receitas.length > 0 && (
          <div className="flex items-center justify-between mb-3.5 px-1 animate-fade-in-fast">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Registros do ciclo
            </span>
            <select
              value={filtroAccountId}
              onChange={e => setFiltroAccountId(e.target.value)}
              className="py-1.5 px-2.5 rounded-xl text-xs font-semibold glass-input bg-slate-900 border-slate-800 text-[var(--color-text-secondary)] cursor-pointer outline-none hover:border-slate-700 transition-colors"
            >
              <option value="all">Todas as contas</option>
              {contas.map(acc => (
                <option key={acc.id} value={acc.id} className="bg-slate-900">{acc.nome}</option>
              ))}
            </select>
          </div>
        )}

        {/* List */}
        {dataLoading ? (
          <Card className="p-5"><SkeletonTable rows={5} /></Card>
        ) : filteredReceitas.length === 0 ? (
          <Card className="p-2">
            <EmptyState
              icon="💰"
              title="Nenhuma receita registrada"
              description={filtroAccountId === 'all' 
                ? "Registre sua primeira entrada deste ciclo de faturamento."
                : "Nenhuma receita registrada nesta conta neste ciclo."
              }
              actionLabel="Nova Receita"
              onAction={openNew}
            />
          </Card>
        ) : (
          <Card className="p-1 divide-y divide-slate-800/40">
            {filteredReceitas.map((rec) => {
              const catName  = rec.financeCategories?.nome || 'Transferência'
              const catColor = rec.financeCategories?.cor  || '#818cf8'
              const accName  = rec.financeAccounts?.nome   || 'Carteira'
              return (
                <ActionRow
                  key={rec.id}
                  onEdit={rec.origem !== 'transferencia' ? () => openEdit(rec) : undefined}
                  onDelete={() => handleDelete(rec.id)}
                >
                  <div className="flex items-center justify-between p-4 select-none">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="p-2 rounded-xl flex-shrink-0"
                        style={{ backgroundColor: `${catColor}15`, color: catColor }}
                      >
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[var(--color-text-primary)] line-clamp-1">
                          {rec.descricao || catName}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                          {catName} · {accName} · {formatDateLabel(rec.data)}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-emerald-400 flex-shrink-0 ml-3">
                      + {formatCurrency(rec.valor, currency)}
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
          title={editingId ? 'Editar Receita' : 'Nova Receita'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Valor"
              type="number" step="0.01" min="0.01"
              value={valor}
              onChange={e => setValor(e.target.value)}
              placeholder="0,00"
              leftIcon={<DollarSign className="w-4 h-4 text-emerald-400" />}
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
              label="Conta de destino"
              options={accOptions}
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              leftIcon={<Briefcase className="w-4 h-4" />}
              required
            />
            <Input
              label="Descrição (opcional)"
              type="text"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Ex: Freelance da semana"
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
              <Button type="submit" variant="success-variant" state={submitState} className="flex-1">
                {editingId ? 'Salvar' : 'Registrar'}
              </Button>
            </div>
          </form>
        </BottomSheet>
      </AppShell>
    </PullRefresh>
  )
}

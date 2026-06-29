'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { getBillingCycleRange, formatCurrency, formatDateLabel } from '@/lib/utils'
import {
  Wallet, ArrowUpRight, ArrowDownRight, PiggyBank,
  CalendarClock, Target, TrendingUp, TrendingDown,
  PlusCircle, RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import { AppShell }  from '@/components/layout/AppShell'
import { PageHeader, PageTitle } from '@/components/layout/PageHeader'
import { Card }      from '@/components/ui/Card'
import { Badge }     from '@/components/ui/Badge'
import { KPIWidget, InfoWidget } from '@/components/finance/Widgets'
import { PullRefresh } from '@/components/mobile/PullRefresh'
import { SkeletonCard, SkeletonTable } from '@/components/feedback/Skeletons'
import { EmptyState } from '@/components/feedback/EmptyState'
import { dashboardService, DashboardSnapshot } from '@/services/dashboard.service'

// ─── Skeleton do Dashboard ────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <AppShell>
      <div className="flex justify-between items-center mb-6">
        <div className="space-y-1.5">
          <div className="h-2.5 w-16 rounded-full skeleton-shimmer" />
          <div className="h-7 w-40 rounded-xl skeleton-shimmer" />
        </div>
        <div className="flex gap-2">
          <div className="w-9 h-9 rounded-full skeleton-shimmer" />
          <div className="w-9 h-9 rounded-full skeleton-shimmer" />
        </div>
      </div>
      <SkeletonCard className="mb-4 h-28" />
      <div className="grid grid-cols-2 gap-3 mb-4">
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-24" />
      </div>
      <SkeletonCard className="mb-4 h-24" />
      <Card className="p-5">
        <div className="h-4 w-40 rounded-full skeleton-shimmer mb-4" />
        <SkeletonTable rows={4} />
      </Card>
    </AppShell>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, profile, loading } = useAuth()
  const toast  = useToast()
  const router = useRouter()

  const [snapshot,     setSnapshot]     = useState<DashboardSnapshot | null>(null)
  const [dataLoading,  setDataLoading]  = useState(true)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const load = useCallback(async () => {
    if (!user || !profile) return
    setDataLoading(true)
    try {
      const closingDay = profile.fechamento_dia || 30
      const { startDate, endDate } = getBillingCycleRange(closingDay)
      const range = {
        startDate: startDate.toISOString().split('T')[0],
        endDate:   endDate.toISOString().split('T')[0],
      }
      const result = await dashboardService.getSnapshot(user.id, range)
      if (result.success) setSnapshot(result.data)
      else toast.error(result.error)
    } catch {
      toast.error('Erro ao carregar painel.')
    } finally {
      setDataLoading(false)
    }
  }, [user, profile, toast])

  useEffect(() => { load() }, [load])

  if (loading || dataLoading || !profile) return <DashboardSkeleton />

  const currency = profile.moeda || 'R$'
  const s = snapshot

  return (
    <PullRefresh onRefresh={load}>
      <AppShell>
        {/* Header */}
        <PageHeader
          left={
            <PageTitle
              eyebrow="Boas-vindas"
              title={`Olá, ${profile.nome.split(' ')[0]}! 👋`}
            />
          }
          right={
            <div className="flex gap-2">
              <Link
                href="/receitas"
                title="Nova Receita"
                aria-label="Nova Receita"
                className="p-2 rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <PlusCircle className="w-5 h-5" />
              </Link>
              <Link
                href="/despesas"
                title="Nova Despesa"
                aria-label="Nova Despesa"
                className="p-2 rounded-full bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <PlusCircle className="w-5 h-5" />
              </Link>
            </div>
          }
        />

        {/* Saldo Atual — card principal */}
        <Card animate className="p-6 mb-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/8 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center gap-2 text-[var(--color-text-secondary)] mb-2">
            <Wallet className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-medium">Saldo Atual</span>
          </div>
          <div className="text-4xl font-extrabold text-white tracking-tight mb-1">
            {s ? formatCurrency(s.summary.saldoAtual, currency) : '—'}
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Ciclo de faturamento · Fechamento dia {profile.fechamento_dia}
          </p>
        </Card>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <KPIWidget
            title="Receitas do mês"
            value={s?.summary.receitasMes ?? 0}
            prefix={`${currency} `}
            icon={<ArrowUpRight className="w-4 h-4" />}
            accentClass="text-emerald-400"
            glowClass="bg-emerald-500/8"
          />
          <KPIWidget
            title="Despesas do mês"
            value={s?.summary.despesasMes ?? 0}
            prefix={`${currency} `}
            icon={<ArrowDownRight className="w-4 h-4" />}
            accentClass="text-rose-400"
            glowClass="bg-rose-500/8"
          />
          <KPIWidget
            title="Economia do mês"
            value={s?.summary.economiaMes ?? 0}
            prefix={`${currency} `}
            icon={<PiggyBank className="w-4 h-4" />}
            accentClass={s && s.summary.economiaMes >= 0 ? 'text-indigo-400' : 'text-rose-400'}
            glowClass="bg-indigo-500/8"
          />

          {/* Próxima Conta */}
          <InfoWidget
            title="Próxima conta"
            icon={<CalendarClock className="w-4 h-4" />}
            accentClass="text-amber-400"
            glowClass="bg-amber-500/8"
          >
            {s?.nextBill ? (
              <div>
                <p className="text-sm font-bold text-[var(--color-text-primary)] line-clamp-1">
                  {s.nextBill.nome}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  {formatCurrency(s.nextBill.valor, currency)}
                </p>
                <Badge variant="warning" className="mt-1.5 text-[10px]">
                  Vence {formatDateLabel(s.nextBill.vencimento)}
                </Badge>
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)]">Nenhuma conta pendente 🎉</p>
            )}
          </InfoWidget>
        </div>

        {/* Meta mais próxima */}
        {s?.nearestGoal && (
          <InfoWidget
            title="Meta mais próxima"
            icon={<Target className="w-4 h-4" />}
            accentClass="text-violet-400"
            glowClass="bg-violet-500/8"
          >
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <p className="text-sm font-bold text-[var(--color-text-primary)]">{s.nearestGoal.nome}</p>
                <span className="text-xs font-bold text-violet-400">
                  {s.nearestGoal.progressPct.toFixed(0)}%
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-500"
                  style={{ width: `${s.nearestGoal.progressPct}%` }}
                />
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                {formatCurrency(s.nearestGoal.valorAtual, currency)} de {formatCurrency(s.nearestGoal.valorMeta, currency)}
              </p>
            </div>
          </InfoWidget>
        )}

        {/* Últimas movimentações */}
        <Card className="p-5 mt-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Últimas movimentações</h2>
            <Badge variant="default">Atividades</Badge>
          </div>

          {!s?.lastMovement ? (
            <EmptyState
              icon="💸"
              title="Nenhuma movimentação"
              description="Registre sua primeira receita ou despesa para começar."
              actionLabel="Nova Receita"
              onAction={() => router.push('/receitas')}
            />
          ) : (
            // Mostramos o lastMovement como preview — a lista completa está em Receitas/Despesas
            <div className="space-y-1">
              {[s.lastMovement].map((tx) => {
                const isReceita = tx.tipo === 'receita'
                const catColor = tx.financeCategories?.cor || '#94a3b8'
                return (
                  <div key={tx.id} className="flex items-center gap-3 py-2.5">
                    <div
                      className="p-2 rounded-xl flex-shrink-0"
                      style={{ backgroundColor: `${catColor}15`, color: catColor }}
                    >
                      {isReceita
                        ? <TrendingUp className="w-4 h-4" />
                        : <TrendingDown className="w-4 h-4" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] line-clamp-1">
                        {tx.descricao || tx.financeCategories?.nome || 'Outros'}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">
                        {tx.financeCategories?.nome} · {formatDateLabel(tx.data)}
                      </p>
                    </div>
                    <span className={`text-sm font-bold flex-shrink-0 ${isReceita ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isReceita ? '+' : '−'} {formatCurrency(tx.valor, currency)}
                    </span>
                  </div>
                )
              })}

              <Link
                href={s.lastMovement.tipo === 'receita' ? '/receitas' : '/despesas'}
                className="flex items-center justify-center gap-1 mt-2 py-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors duration-120"
              >
                Ver todas as movimentações
              </Link>
            </div>
          )}
        </Card>
      </AppShell>
    </PullRefresh>
  )
}

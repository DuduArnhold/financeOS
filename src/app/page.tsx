'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { getBillingCycleRange, formatCurrency, formatDateLabel } from '@/lib/utils'
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  AlertCircle, 
  PiggyBank, 
  PlusCircle, 
  ArrowRight,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import Link from 'next/link'
import Loader from '@/components/Loader'
import { toast } from 'sonner'

interface Transaction {
  id: string
  valor: number
  descricao: string
  data: string
  tipo: 'receita' | 'despesa'
  forma_pagamento: string
  finance_categories?: {
    nome: string
    cor: string
    icone: string
  } | null
}

export default function Dashboard() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  const [dashboardData, setDashboardData] = useState({
    saldoAtual: 0,
    receitasMes: 0,
    despesasMes: 0,
    contasPendentes: 0,
    economiaMes: 0,
  })
  const [latestTransactions, setLatestTransactions] = useState<Transaction[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!user || !profile) return

    const loadDashboardData = async () => {
      setDataLoading(true)
      try {
        const closingDay = profile.fechamento_dia || 30
        const { startDate, endDate } = getBillingCycleRange(closingDay)
        
        // Format dates as YYYY-MM-DD for PG comparison
        const startDateStr = startDate.toISOString().split('T')[0]
        const endDateStr = endDate.toISOString().split('T')[0]

        // 1. Fetch ALL movements and paid bills to calculate real Saldo Atual
        const [
          { data: allMovements },
          { data: allPaidBills }
        ] = await Promise.all([
          supabase.from('finance_movements').select('valor, tipo').eq('user_id', user.id),
          supabase.from('finance_contas').select('valor').eq('user_id', user.id).eq('paga', true)
        ])

        const totalRevenues = (allMovements || [])
          .filter(m => m.tipo === 'receita')
          .reduce((acc, curr) => acc + Number(curr.valor), 0)

        const totalExpenses = (allMovements || [])
          .filter(m => m.tipo === 'despesa')
          .reduce((acc, curr) => acc + Number(curr.valor), 0)

        const totalPaidBills = (allPaidBills || []).reduce((acc, curr) => acc + Number(curr.valor), 0)
        
        // Saldo Atual = Receitas de sempre - Despesas de sempre - Contas pagas de sempre
        const saldoCalculado = totalRevenues - totalExpenses - totalPaidBills

        // 2. Fetch current month metrics (within the cycle range) and pending bills
        const [
          { data: currentMovements },
          { data: currentPendingBills }
        ] = await Promise.all([
          supabase.from('finance_movements')
            .select('valor, tipo')
            .eq('user_id', user.id)
            .gte('data', startDateStr)
            .lte('data', endDateStr),
          supabase.from('finance_contas')
            .select('valor')
            .eq('user_id', user.id)
            .eq('paga', false)
        ])

        const receitasMesSum = (currentMovements || [])
          .filter(m => m.tipo === 'receita')
          .reduce((acc, curr) => acc + Number(curr.valor), 0)

        const despesasMesSum = (currentMovements || [])
          .filter(m => m.tipo === 'despesa')
          .reduce((acc, curr) => acc + Number(curr.valor), 0)

        const contasPendentesSum = (currentPendingBills || []).reduce((acc, curr) => acc + Number(curr.valor), 0)
        
        // Economia do Mês = Receitas do Mês - Despesas do Mês
        const economiaMesCalculada = receitasMesSum - despesasMesSum

        setDashboardData({
          saldoAtual: saldoCalculado,
          receitasMes: receitasMesSum,
          despesasMes: despesasMesSum,
          contasPendentes: contasPendentesSum,
          economiaMes: economiaMesCalculada,
        })

        // 3. Fetch latest transactions (5 items) joined with categories
        const { data: recentMovements, error: txError } = await supabase
          .from('finance_movements')
          .select(`
            id,
            valor,
            descricao,
            data,
            tipo,
            forma_pagamento,
            finance_categories:categoria_id (
              nome,
              cor,
              icone
            )
          `)
          .eq('user_id', user.id)
          .order('data', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(5)

        if (txError) throw txError
        setLatestTransactions((recentMovements as any[]) || [])
      } catch (err) {
        console.error('Error loading dashboard data:', err)
        toast.error('Erro ao atualizar o painel.')
      } finally {
        setDataLoading(false)
      }
    }

    loadDashboardData()
  }, [user, profile])

  if (loading || dataLoading || !profile) {
    return <Loader />
  }

  const currencySymbol = profile.moeda || 'R$'

  return (
    <main className="container max-w-lg mx-auto px-4 pt-6 pb-20 animate-fade-in">
      {/* Header Greeting */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Boas-vindas</span>
          <h1 className="text-2xl font-bold text-white tracking-tight">Olá, {profile.nome}!</h1>
        </div>
        <div className="flex gap-2">
          <Link 
            href="/receitas" 
            className="p-2 rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all cursor-pointer"
            title="Nova Receita"
          >
            <PlusCircle className="w-5 h-5" />
          </Link>
          <Link 
            href="/despesas" 
            className="p-2 rounded-full bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 active:scale-95 transition-all cursor-pointer"
            title="Nova Despesa"
          >
            <PlusCircle className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Saldo Card */}
      <div className="glass-card rounded-2xl p-6 border-slate-800/80 mb-6 shadow-xl relative overflow-hidden">
        {/* Accent Glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center gap-3 text-slate-400 mb-2">
          <Wallet className="w-5 h-5 text-indigo-400" />
          <span className="text-sm font-medium">Saldo Pessoal</span>
        </div>
        <div className="text-3xl font-extrabold text-white tracking-tight">
          {formatCurrency(dashboardData.saldoAtual, currencySymbol)}
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Receitas Card */}
        <div className="glass-card rounded-xl p-4 border-slate-800/80">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium">Receitas / Mês</span>
          </div>
          <div className="text-lg font-bold text-emerald-400">
            {formatCurrency(dashboardData.receitasMes, currencySymbol)}
          </div>
        </div>

        {/* Despesas Card */}
        <div className="glass-card rounded-xl p-4 border-slate-800/80">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <ArrowDownRight className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-medium">Despesas / Mês</span>
          </div>
          <div className="text-lg font-bold text-rose-400">
            {formatCurrency(dashboardData.despesasMes, currencySymbol)}
          </div>
        </div>

        {/* Contas Pendentes Card */}
        <div className="glass-card rounded-xl p-4 border-slate-800/80">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium">Contas Pendentes</span>
          </div>
          <div className="text-lg font-bold text-amber-400">
            {formatCurrency(dashboardData.contasPendentes, currencySymbol)}
          </div>
        </div>

        {/* Economia Card */}
        <div className="glass-card rounded-xl p-4 border-slate-800/80">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <PiggyBank className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-medium">Economia / Mês</span>
          </div>
          <div className={`text-lg font-bold ${
            dashboardData.economiaMes >= 0 ? 'text-indigo-400' : 'text-rose-400'
          }`}>
            {formatCurrency(dashboardData.economiaMes, currencySymbol)}
          </div>
        </div>
      </div>

      {/* Latest Transactions */}
      <div className="glass-card rounded-2xl p-5 border-slate-800/80 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-semibold text-slate-200">Últimas movimentações</h2>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-medium">
            Atividades
          </span>
        </div>

        <div className="space-y-3.5">
          {latestTransactions.length === 0 ? (
            <p className="text-center py-6 text-xs text-slate-500 font-medium">
              Nenhuma movimentação registrada este mês.
            </p>
          ) : (
            latestTransactions.map((tx) => {
              const isReceita = tx.tipo === 'receita'
              const catName = tx.finance_categories?.nome || 'Outros'
              const catColor = tx.finance_categories?.cor || '#94a3b8'

              return (
                <div 
                  key={tx.id} 
                  className="flex items-center justify-between py-2 border-b border-slate-800/40 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2 rounded-xl"
                      style={{ 
                        backgroundColor: `${catColor}15`, 
                        color: catColor 
                      }}
                    >
                      {isReceita ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200 line-clamp-1">
                        {tx.descricao || catName}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {catName} • {formatDateLabel(tx.data)}
                      </p>
                    </div>
                  </div>
                  <div className={`text-sm font-bold ${
                    isReceita ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {isReceita ? '+' : '-'} {formatCurrency(tx.valor, currencySymbol)}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </main>
  )
}

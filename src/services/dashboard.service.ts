import { movementRepository, Movement } from '@/repositories/movement.repository'
import { contaRepository, Conta }       from '@/repositories/conta.repository'
import { metaRepository }               from '@/repositories/meta.repository'
import { accountRepository, Account }   from '@/repositories/account.repository'
import { MetaConsolidated }             from '@/services/goal.service'
import { logger }                       from '@/lib/logger'

// ─── Date Range ───────────────────────────────────────────────────────────────

export interface DateRange {
  startDate: string  // YYYY-MM-DD
  endDate:   string
}

// ─── DashboardSnapshot DTO ────────────────────────────────────────────────────
// Representa um retrato do momento financeiro do usuário.
// Futuramente: DashboardHistory, DashboardForecast, DashboardComparison.

export interface DashboardAccountSnapshot extends Account {
  balance: number
}

export interface DashboardSnapshot {
  summary: {
    saldoAtual:   number
    receitasMes:  number
    despesasMes:  number
    economiaMes:  number
  }
  nextBill:       Conta | null
  nearestGoal:    (MetaConsolidated & { progressPct: number }) | null
  lastMovement:   Movement | null
  accounts:       DashboardAccountSnapshot[]
}

// ─── Repository Interface ─────────────────────────────────────────────────────
// O Service depende desta interface — não de Supabase diretamente.
// No futuro: OfflineDashboardRepository, CachedDashboardRepository.

export interface DashboardRepository {
  getSnapshot(userId: string, range: DateRange): Promise<DashboardSnapshot>
}

// ─── Supabase Implementation ──────────────────────────────────────────────────

class SupabaseDashboardRepository implements DashboardRepository {
  async getSnapshot(userId: string, range: DateRange): Promise<DashboardSnapshot> {
    // 1. Todas as movimentações (para saldo real)
    const allMovements = await movementRepository.getAll(userId)

    const totalRevenues = allMovements
      .filter(m => m.tipo === 'receita')
      .reduce((sum, m) => sum + m.valor, 0)

    const totalExpenses = allMovements
      .filter(m => m.tipo === 'despesa')
      .reduce((sum, m) => sum + m.valor, 0)

    // 2. Movimentações do ciclo atual
    const cycleMovements = allMovements.filter(
      m => m.data >= range.startDate && m.data <= range.endDate
    )

    const receitasMes = cycleMovements
      .filter(m => m.tipo === 'receita')
      .reduce((sum, m) => sum + m.valor, 0)

    const despesasMes = cycleMovements
      .filter(m => m.tipo === 'despesa')
      .reduce((sum, m) => sum + m.valor, 0)

    // 3. Próxima conta não paga
    const today = new Date().toISOString().split('T')[0]
    const allContas = await contaRepository.getAll(userId)
    const nextBill = allContas
      .filter(c => !c.paga && c.vencimento >= today)
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0] ?? null

    // 4. Meta mais próxima da conclusão (< 100%)
    const metas    = await metaRepository.getAll(userId)
    const deposits = await metaRepository.getAllDeposits(userId)

    const depositsMap: Record<string, number> = {}
    deposits.forEach(d => {
      depositsMap[d.metaId] = (depositsMap[d.metaId] || 0) + d.valor
    })

    const consolidated = metas.map(m => ({
      id:          m.id,
      nome:        m.nome,
      valorMeta:   m.valorMeta,
      valorAtual:  depositsMap[m.id] || 0,
      progressPct: m.valorMeta > 0 ? Math.min((depositsMap[m.id] || 0) / m.valorMeta * 100, 100) : 0,
    }))

    const nearestGoal = consolidated
      .filter(m => m.progressPct < 100)
      .sort((a, b) => b.progressPct - a.progressPct)[0] ?? null

    // 5. Última movimentação
    const lastMovement = [...allMovements]
      .sort((a, b) => b.data.localeCompare(a.data))[0] ?? null

    // 6. Carregar contas financeiras e calcular seus saldos reais dinamicamente
    const activeAccounts = await accountRepository.getActiveAccounts(userId)
    
    // Mapear saldo acumulado por conta
    const accountsWithBalance: DashboardAccountSnapshot[] = activeAccounts.map(acc => {
      const accountMovements = allMovements.filter(m => m.accountId === acc.id)
      
      const revenues = accountMovements
        .filter(m => m.tipo === 'receita')
        .reduce((sum, m) => sum + m.valor, 0)
        
      const expenses = accountMovements
        .filter(m => m.tipo === 'despesa')
        .reduce((sum, m) => sum + m.valor, 0)
        
      return {
        ...acc,
        balance: acc.saldoInicial + revenues - expenses
      }
    })

    return {
      summary: {
        saldoAtual:  totalRevenues - totalExpenses,
        receitasMes,
        despesasMes,
        economiaMes: receitasMes - despesasMes,
      },
      nextBill,
      nearestGoal,
      lastMovement,
      accounts: accountsWithBalance
    }
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

const defaultRepository: DashboardRepository = new SupabaseDashboardRepository()

export const dashboardService = {
  async getSnapshot(
    userId: string,
    range: DateRange,
    repository: DashboardRepository = defaultRepository
  ): Promise<{ success: true; data: DashboardSnapshot } | { success: false; error: string }> {
    try {
      const data = await repository.getSnapshot(userId, range)
      return { success: true, data }
    } catch (err) {
      logger.error('dashboardService.getSnapshot error', { error: err })
      const errorMsg = err instanceof Error ? err.message : 'Erro ao calcular resumo do painel.'
      return { success: false, error: errorMsg }
    }
  }
}

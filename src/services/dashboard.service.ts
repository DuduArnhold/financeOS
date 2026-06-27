import { movementRepository } from '@/repositories/movement.repository'
import { contaRepository } from '@/repositories/conta.repository'
import { ServiceResult } from './conta.service'

export interface DashboardSummary {
  saldoAtual: number
  receitasMes: number
  despesasMes: number
  contasPendentes: number
  economiaMes: number
}

export const dashboardService = {
  async getDashboardSummary(
    userId: string,
    billingCycleRange: { startDate: string; endDate: string }
  ): Promise<ServiceResult<DashboardSummary>> {
    try {
      // 1. Obter todas as transações para calcular o Saldo Atual real
      const allMovements = await movementRepository.getAll(userId)

      const totalRevenues = allMovements
        .filter((m) => m.tipo === 'receita')
        .reduce((acc, curr) => acc + curr.valor, 0)

      const totalExpenses = allMovements
        .filter((m) => m.tipo === 'despesa')
        .reduce((acc, curr) => acc + curr.valor, 0)

      const saldoCalculado = totalRevenues - totalExpenses

      // 2. Obter transações do ciclo de faturamento atual
      const currentCycleMovements = allMovements.filter(
        (m) => m.data >= billingCycleRange.startDate && m.data <= billingCycleRange.endDate
      )

      const receitasMesSum = currentCycleMovements
        .filter((m) => m.tipo === 'receita')
        .reduce((acc, curr) => acc + curr.valor, 0)

      const despesasMesSum = currentCycleMovements
        .filter((m) => m.tipo === 'despesa')
        .reduce((acc, curr) => acc + curr.valor, 0)

      // 3. Obter contas pendentes
      const allContas = await contaRepository.getAll(userId)
      const contasPendentesSum = allContas
        .filter((c) => !c.paga)
        .reduce((acc, curr) => acc + curr.valor, 0)

      const economiaMesCalculada = receitasMesSum - despesasMesSum

      return {
        success: true,
        data: {
          saldoAtual: saldoCalculado,
          receitasMes: receitasMesSum,
          despesasMes: despesasMesSum,
          contasPendentes: contasPendentesSum,
          economiaMes: economiaMesCalculada,
        },
      }
    } catch (err: any) {
      console.error('Error in getDashboardSummary service:', err)
      return { success: false, error: err.message || 'Erro ao calcular resumo do painel.' }
    }
  }
}

import { contaRepository, Conta } from '@/repositories/conta.repository'
import { logger } from '@/lib/logger'
import { eventBus } from '@/lib/event-bus'

export interface ServiceResult<T> {
  success: boolean
  data?: T
  error?: string
}

export const contaService = {
  async getContas(userId: string): Promise<ServiceResult<Conta[]>> {
    try {
      const data = await contaRepository.getAll(userId)
      return { success: true, data }
    } catch (err) {
      logger.error('Error in getContas service:', { error: err })
      const errorMsg = err instanceof Error ? err.message : 'Erro ao carregar contas.'
      return { success: false, error: errorMsg }
    }
  },

  async createConta(
    userId: string,
    nome: string,
    valor: number,
    vencimento: string,
    recorrente: boolean
  ): Promise<ServiceResult<Conta>> {
    try {
      if (!nome.trim()) {
        return { success: false, error: 'O nome da conta é obrigatório.' }
      }
      if (valor <= 0) {
        return { success: false, error: 'O valor da conta deve ser maior que zero.' }
      }
      if (!vencimento) {
        return { success: false, error: 'A data de vencimento é obrigatória.' }
      }

      const newConta = await contaRepository.insert({
        userId,
        nome: nome.trim(),
        valor,
        vencimento,
        paga: false,
        recorrente,
        categoriaPreferidaId: null,
      })
      return { success: true, data: newConta }
    } catch (err) {
      logger.error('Error in createConta service:', { error: err })
      const errorMsg = err instanceof Error ? err.message : 'Erro ao criar conta.'
      return { success: false, error: errorMsg }
    }
  },

  async updateConta(
    id: string,
    userId: string,
    nome: string,
    valor: number,
    vencimento: string,
    recorrente: boolean
  ): Promise<ServiceResult<Conta>> {
    try {
      if (!nome.trim()) {
        return { success: false, error: 'O nome da conta é obrigatório.' }
      }
      if (valor <= 0) {
        return { success: false, error: 'O valor da conta deve ser maior que zero.' }
      }
      if (!vencimento) {
        return { success: false, error: 'A data de vencimento é obrigatória.' }
      }

      const updated = await contaRepository.update(id, userId, {
        nome: nome.trim(),
        valor,
        vencimento,
        recorrente,
      })
      return { success: true, data: updated }
    } catch (err) {
      logger.error('Error in updateConta service:', { error: err })
      const errorMsg = err instanceof Error ? err.message : 'Erro ao atualizar conta.'
      return { success: false, error: errorMsg }
    }
  },

  async deleteConta(id: string, userId: string): Promise<ServiceResult<void>> {
    try {
      await contaRepository.softDelete(id, userId)
      return { success: true }
    } catch (err) {
      logger.error('Error in deleteConta service:', { error: err })
      const errorMsg = err instanceof Error ? err.message : 'Erro ao excluir conta.'
      return { success: false, error: errorMsg }
    }
  },

  async payConta(
    contaId: string,
    userId: string,
    accountId: string,
    categoriaId: string,
    formaPagamento: string,
    data: string,
    observacao: string
  ): Promise<ServiceResult<void>> {
    try {
      if (!accountId) {
        return { success: false, error: 'A conta financeira de origem é obrigatória.' }
      }
      if (!categoriaId) {
        return { success: false, error: 'A categoria da despesa é obrigatória.' }
      }
      if (!formaPagamento) {
        return { success: false, error: 'A forma de pagamento é obrigatória.' }
      }
      if (!data) {
        return { success: false, error: 'A data do pagamento é obrigatória.' }
      }

      await contaRepository.pay(
        contaId,
        userId,
        accountId,
        categoriaId,
        formaPagamento,
        data,
        observacao || 'Pagamento de conta'
      )

      // Get bill value to emit event
      const contas = await contaRepository.getAll(userId)
      const target = contas.find(c => c.id === contaId)
      const billValue = target ? target.valor : 0

      // Emit event with eventId and version
      eventBus.publish('BILL_PAID', {
        eventId: crypto.randomUUID(),
        version: 1,
        userId,
        id: contaId,
        valor: billValue
      })

      return { success: true }
    } catch (err) {
      logger.error('Error in payConta service:', { error: err })
      const errorMsg = err instanceof Error ? err.message : 'Erro ao efetuar pagamento da conta.'
      return { success: false, error: errorMsg }
    }
  },

  async unpayConta(contaId: string, userId: string, deleteMovement: boolean): Promise<ServiceResult<void>> {
    try {
      await contaRepository.unpay(contaId, userId, deleteMovement)
      
      // Emit event with eventId and version
      eventBus.publish('BILL_UNPAID', {
        eventId: crypto.randomUUID(),
        version: 1,
        userId,
        id: contaId
      })

      return { success: true }
    } catch (err) {
      logger.error('Error in unpayConta service:', { error: err })
      const errorMsg = err instanceof Error ? err.message : 'Erro ao reverter pagamento da conta.'
      return { success: false, error: errorMsg }
    }
  }
}

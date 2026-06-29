import { transferRepository, Transfer } from '@/repositories/transfer.repository'
import { movementRepository } from '@/repositories/movement.repository'
import { ServiceResult } from './conta.service'
import { logger } from '@/lib/logger'

export const transferService = {
  async getTransfers(userId: string): Promise<ServiceResult<Transfer[]>> {
    try {
      const data = await transferRepository.getAll(userId)
      return { success: true, data }
    } catch (err: any) {
      logger.error('Error in getTransfers service', { error: err })
      return { success: false, error: err.message || 'Erro ao carregar transferências.' }
    }
  },

  async createTransfer(
    userId: string,
    sourceAccountId: string,
    targetAccountId: string,
    valor: number,
    data: string,
    descricao: string | null
  ): Promise<ServiceResult<Transfer>> {
    try {
      if (valor <= 0) {
        return { success: false, error: 'O valor da transferência deve ser maior que zero.' }
      }
      if (!sourceAccountId || !targetAccountId) {
        return { success: false, error: 'As contas de origem e destino são obrigatórias.' }
      }
      if (sourceAccountId === targetAccountId) {
        return { success: false, error: 'As contas de origem e destino devem ser diferentes.' }
      }
      if (!data) {
        return { success: false, error: 'A data é obrigatória.' }
      }

      // 1. Criar transferência
      const newTransfer = await transferRepository.insert({
        userId,
        sourceAccountId,
        targetAccountId,
        valor,
        data,
        descricao
      })

      // 2. Criar a despesa de saída na conta de origem (sem categoria)
      await movementRepository.insert({
        userId,
        tipo: 'despesa',
        valor,
        categoriaId: null,
        accountId: sourceAccountId,
        formaPagamento: 'Transferência',
        data,
        descricao: descricao ? `Saída: ${descricao}` : 'Transferência enviada',
        contaId: null,
        origem: 'transferencia',
        origemUuid: newTransfer.id,
        origemRef: null
      })

      // 3. Criar a receita de entrada na conta de destino (sem categoria)
      await movementRepository.insert({
        userId,
        tipo: 'receita',
        valor,
        categoriaId: null,
        accountId: targetAccountId,
        formaPagamento: 'Transferência',
        data,
        descricao: descricao ? `Entrada: ${descricao}` : 'Transferência recebida',
        contaId: null,
        origem: 'transferencia',
        origemUuid: newTransfer.id,
        origemRef: null
      })

      return { success: true, data: newTransfer }
    } catch (err: any) {
      logger.error('Error in createTransfer service', { error: err })
      return { success: false, error: err.message || 'Erro ao realizar transferência.' }
    }
  },

  async deleteTransfer(id: string, userId: string): Promise<ServiceResult<void>> {
    try {
      // 1. Remover registros de movimentação associados do caixa geral
      await movementRepository.deleteByTransfer(id, userId)

      // 2. Remover a transferência em si
      await transferRepository.delete(id, userId)

      return { success: true }
    } catch (err: any) {
      logger.error('Error in deleteTransfer service', { error: err })
      return { success: false, error: err.message || 'Erro ao excluir transferência.' }
    }
  }
}

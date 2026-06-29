import { movementRepository, Movement } from '@/repositories/movement.repository'
import { ServiceResult } from './conta.service'
import { logger } from '@/lib/logger'
import { eventBus } from '@/lib/event-bus'

export const movementService = {
  async getMovements(
    userId: string,
    tipo?: 'receita' | 'despesa',
    range?: { startDate: string; endDate: string },
    limit?: number
  ): Promise<ServiceResult<Movement[]>> {
    try {
      const data = await movementRepository.getAll(userId, tipo, range, limit)
      return { success: true, data }
    } catch (err: any) {
      logger.error('Error in getMovements service:', err)
      return { success: false, error: err.message || 'Erro ao carregar movimentações.' }
    }
  },

  async createMovement(
    movement: Omit<Movement, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
  ): Promise<ServiceResult<Movement>> {
    try {
      if (movement.valor <= 0) {
        return { success: false, error: 'O valor da movimentação deve ser maior que zero.' }
      }
      if (!movement.accountId) {
        return { success: false, error: 'A conta financeira é obrigatória.' }
      }
      if (!movement.categoriaId) {
        return { success: false, error: 'A categoria é obrigatória.' }
      }
      if (!movement.data) {
        return { success: false, error: 'A data é obrigatória.' }
      }

      const newMovement = await movementRepository.insert(movement)
      
      // Emit event to EventBus with eventId and version
      eventBus.publish('MOVEMENT_CREATED', {
        eventId: crypto.randomUUID(),
        version: 1,
        userId: newMovement.userId,
        id: newMovement.id,
        tipo: newMovement.tipo,
        valor: newMovement.valor
      })

      return { success: true, data: newMovement }
    } catch (err: any) {
      logger.error('Error in createMovement service:', err)
      return { success: false, error: err.message || 'Erro ao criar movimentação.' }
    }
  },

  async updateMovement(
    id: string,
    userId: string,
    movement: Partial<Omit<Movement, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'deletedAt'>>
  ): Promise<ServiceResult<Movement>> {
    try {
      if (movement.valor !== undefined && movement.valor <= 0) {
        return { success: false, error: 'O valor da movimentação deve ser maior que zero.' }
      }

      const updated = await movementRepository.update(id, userId, movement)
      return { success: true, data: updated }
    } catch (err: any) {
      logger.error('Error in updateMovement service:', err)
      return { success: false, error: err.message || 'Erro ao atualizar movimentação.' }
    }
  },

  async deleteMovement(id: string, userId: string): Promise<ServiceResult<void>> {
    try {
      await movementRepository.softDelete(id, userId)
      
      // Emit event to EventBus with eventId and version
      eventBus.publish('MOVEMENT_DELETED', {
        eventId: crypto.randomUUID(),
        version: 1,
        userId,
        id
      })

      return { success: true }
    } catch (err: any) {
      logger.error('Error in deleteMovement service:', err)
      return { success: false, error: err.message || 'Erro ao excluir movimentação.' }
    }
  }
}

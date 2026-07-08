import { PlatformEvent, NormalizedSale } from '../../../types'
import { IntegrationMapping } from '@/repositories/integration.repository'
import { IntegrationHandler } from '../registry'
import { movementRepository } from '@/repositories/movement.repository'
import { movementService } from '@/services/movement.service'
import { logger } from '@/lib/logger'

export class SaleCancelledHandler implements IntegrationHandler<NormalizedSale, NormalizedSale> {
  /**
   * Trata o evento de venda cancelada (sale.cancelled).
   * Localiza a movimentação de receita correspondente e a soft-deleta.
   */
  async handle(event: PlatformEvent<NormalizedSale>, mapping: IntegrationMapping): Promise<NormalizedSale> {
    const vendaId = event.payload.vendaId
    if (!vendaId) {
      throw new Error('SaleCancelledHandler: vendaId do payload é obrigatório para cancelamento')
    }

    const userId = event.metadata.tenantId

    // Localizar receita correspondente usando a referência de origem externa
    const movement = await movementRepository.getByOrigemRef(userId, event.origin, vendaId)
    
    if (!movement) {
      logger.warn('SaleCancelledHandler: original movement not found for cancellation', {
        userId,
        origin: event.origin,
        vendaId
      })
      return event.payload
    }

    // TODO: Temporary implementation. Soft-delete is used as a workaround.
    // In a future database migration, replace soft-delete with an enum check constraint:
    // finance_movements status (ACTIVE/CANCELLED/REFUNDED).
    const result = await movementService.deleteMovement(movement.id, userId)
    if (!result.success) {
      throw new Error(result.error || 'Erro ao cancelar receita vinculada no FinanceOS')
    }

    logger.info('SaleCancelledHandler: original revenue movement cancelled successfully', {
      userId,
      movementId: movement.id,
      vendaId
    })

    return event.payload
  }
}

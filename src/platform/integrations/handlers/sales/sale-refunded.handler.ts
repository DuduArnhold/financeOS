import { PlatformEvent, NormalizedSale, CreateMovementCommand } from '../../../types'
import { IntegrationMapping } from '@/repositories/integration.repository'
import { IntegrationHandler } from '../registry'
import { commandBus } from '../../../command-bus'

export class SaleRefundedHandler implements IntegrationHandler<NormalizedSale, NormalizedSale> {
  /**
   * Trata o evento de reembolso/estorno de venda (sale.refunded).
   * Traduz o evento para um comando CreateMovementCommand de despesa (estorno).
   */
  async handle(event: PlatformEvent<NormalizedSale>, mapping: IntegrationMapping): Promise<NormalizedSale> {
    const rawDate = event.payload.occurredAt.split('T')[0]

    // Registra o estorno como uma despesa associada
    const command: CreateMovementCommand = {
      type: 'CreateMovementCommand',
      userId: event.metadata.tenantId,
      tipo: 'despesa',
      valor: event.payload.amount,
      accountId: mapping.accountId,
      categoryId: mapping.categoryId,
      formaPagamento: 'Dinheiro',
      data: rawDate,
      descricao: `Estorno: ${event.payload.description}`,
      origin: event.origin,
      origemRef: event.payload.vendaId || event.id
    }

    await commandBus.dispatch(command)
    return event.payload
  }
}

import { PlatformEvent, NormalizedSale, CreateMovementCommand } from '../../../types'
import { IntegrationMapping } from '@/repositories/integration.repository'
import { IntegrationHandler } from '../registry'
import { commandBus } from '../../../command-bus'

export class SaleClosedHandler implements IntegrationHandler<NormalizedSale, NormalizedSale> {
  /**
   * Trata o evento de venda concluída (sale.closed).
   * Traduz o evento para um comando CreateMovementCommand e despacha via CommandBus.
   */
  async handle(event: PlatformEvent<NormalizedSale>, mapping: IntegrationMapping): Promise<NormalizedSale> {
    const rawDate = event.payload.occurredAt.split('T')[0]

    const command: CreateMovementCommand = {
      type: 'CreateMovementCommand',
      userId: event.metadata.userId,
      tipo: 'receita',
      valor: event.payload.amount,
      accountId: mapping.accountId,
      categoryId: mapping.categoryId,
      formaPagamento: 'Dinheiro', // Caixa fechado é recebimento físico padrão
      data: rawDate,
      descricao: event.payload.description,
      origin: event.metadata.origin,
      origemRef: event.payload.vendaId || event.id // Armazena a referência da venda
    }

    await commandBus.dispatch(command)
    return event.payload
  }
}

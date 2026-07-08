import { PlatformEvent, NormalizedPurchase } from '../../../types'
import { IntegrationMapping } from '@/repositories/integration.repository'
import { IntegrationHandler } from '../registry'
import { contaService } from '@/services/conta.service'
import { contaRepository } from '@/repositories/conta.repository'
import { logger } from '@/lib/logger'

export class PurchasePaidHandler implements IntegrationHandler<NormalizedPurchase, NormalizedPurchase> {
  /**
   * Trata a baixa de compras (purchase.paid).
   * Localiza a conta a pagar correspondente e executa a baixa.
   */
  async handle(event: PlatformEvent<NormalizedPurchase>, mapping: IntegrationMapping): Promise<NormalizedPurchase> {
    const userId = event.metadata.tenantId
    const compraId = event.payload.compraId

    // 1. Localizar a conta pendente por referência (encapsulado no repositório)
    // TODO: Temporary implementation. Replacing with Integration References central table in the future.
    const conta = await contaRepository.getByReference(userId, compraId)

    if (!conta) {
      logger.warn('PurchasePaidHandler: original bill to pay not found for reference', {
        userId,
        compraId
      })
      return event.payload
    }

    // Se já estiver paga, apenas retorna (idempotência local no nível de negócio)
    if (conta.paga) {
      logger.info('PurchasePaidHandler: bill already paid, skipping redundant operation', {
        userId,
        contaId: conta.id,
        compraId
      })
      return event.payload
    }

    const payDate = event.payload.occurredAt.split('T')[0]

    // 2. Dar baixa na despesa (cria a transação real no extrato)
    const result = await contaService.payConta(
      conta.id,
      userId,
      mapping.accountId,
      mapping.categoryId,
      'Dinheiro', // Caixa fechado
      payDate,
      `Baixa de Compra automática via Webhook Lucro Simples`
    )

    if (!result.success) {
      throw new Error(result.error || 'Erro ao efetuar baixa de conta correspondente no FinanceOS')
    }

    logger.info('PurchasePaidHandler: bill marked as paid successfully', {
      userId,
      contaId: conta.id,
      compraId
    })

    return event.payload
  }
}

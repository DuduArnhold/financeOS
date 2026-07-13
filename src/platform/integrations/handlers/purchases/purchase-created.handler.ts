import { PlatformEvent, NormalizedPurchase } from '../../../types'
import { IntegrationMapping } from '@/repositories/integration.repository'
import { IntegrationHandler } from '../registry'
import { contaService } from '@/services/conta.service'
import { contaRepository } from '@/repositories/conta.repository'

export class PurchaseCreatedHandler implements IntegrationHandler<NormalizedPurchase, NormalizedPurchase> {
  /**
   * Trata a criação de compras (purchase.created).
   * Insere uma conta a pagar pendente no ledger do FinanceOS.
   */
  async handle(event: PlatformEvent<NormalizedPurchase>, mapping: IntegrationMapping): Promise<NormalizedPurchase> {
    const userId = event.metadata.userId
    const rawDate = event.payload.occurredAt.split('T')[0]

    // 1. Criar a conta pendente
    const result = await contaService.createConta(
      userId,
      event.payload.description || 'Compra Lucro Simples',
      event.payload.amount,
      rawDate,
      false // recorrente
    )

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Erro ao criar conta a pagar correspondente no FinanceOS')
    }

    // 2. Encapsular a referência externa no repositório (evita expor o acoplamento temporário no Handler)
    // TODO: Temporary implementation. Replacing with Integration References central table in the future.
    await contaRepository.saveReference(result.data.id, userId, event.payload.compraId)

    return event.payload
  }
}

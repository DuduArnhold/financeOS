import { ICommandHandler } from '../../command-bus'
import { CreateMovementCommand } from '../../types'
import { movementService } from '@/services/movement.service'
import { Movement } from '@/repositories/movement.repository'

export class CreateMovementCommandHandler implements ICommandHandler<CreateMovementCommand> {
  /**
   * Executa a intenção de criar uma movimentação no FinanceOS.
   * Nota de Intenção Arquitetural: O movementService atua como o Application Service do
   * domínio financeiro nesta fase do projeto.
   */
  async handle(command: CreateMovementCommand): Promise<void> {
    // 1. Validar dados do comando
    if (!command.userId) throw new Error('CreateMovementCommandHandler: userId is required')
    if (command.valor <= 0) throw new Error('CreateMovementCommandHandler: valor must be greater than zero')
    if (!command.accountId) throw new Error('CreateMovementCommandHandler: accountId is required')
    if (!command.categoryId) throw new Error('CreateMovementCommandHandler: categoryId is required')

    // 2. Mapear origem para o enum de domínio
    const mappedOrigin = command.origin as Movement['origem']

    // 3. Executar o caso de uso chamando o serviço de domínio/aplicação correspondente
    const result = await movementService.createMovement({
      userId: command.userId,
      tipo: command.tipo,
      valor: command.valor,
      categoriaId: command.categoryId,
      accountId: command.accountId,
      formaPagamento: command.formaPagamento,
      data: command.data,
      descricao: command.descricao,
      origem: mappedOrigin,
      origemRef: command.origemRef,
      origemUuid: command.origemUuid
    })

    if (!result.success) {
      throw new Error(result.error || 'Erro ao persistir movimentação no FinanceOS')
    }
  }
}

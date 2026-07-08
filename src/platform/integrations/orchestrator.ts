import { PlatformEvent } from '../types'
import { IIntegrationRepository } from '@/repositories/integration.repository'
import { handlerRegistry } from './handlers/registry'
import { logger } from '@/lib/logger'

export class MoneyBridgeOrchestrator {
  /**
   * @param repository - Repositório injetado. Na produção usa SupabaseIntegrationRepository;
   * nos testes de infraestrutura usa MemoryIntegrationRepository.
   * O Orchestrator não sabe nem precisa saber qual implementação está ativa.
   */
  constructor(private readonly repository: IIntegrationRepository) {}

  /**
   * Processador central de eventos do MoneyBridge.
   * Gerencia idempotência, logging, resolução de handlers e execução do fluxo completo.
   */
  async process(event: PlatformEvent<unknown>): Promise<void> {
    const startTime = Date.now()
    let dbLogId: string | null = null

    try {
      // 1. Idempotência: verificar se o evento já foi processado com sucesso
      const isAlreadyProcessed = await this.repository.isEventProcessed(event.origin, event.id)
      if (isAlreadyProcessed) {
        logger.warn('MoneyBridgeOrchestrator: event already processed, skipping', {
          origin: event.origin,
          eventId: event.id
        })
        return
      }

      // 2. Registrar início do processamento (status: processing)
      const dbLog = await this.repository.insertEventLog({
        userId: event.metadata.tenantId,
        origin: event.origin,
        eventId: event.id,
        eventType: event.type,
        status: 'processing',
        payload: event.payload
      })
      dbLogId = dbLog.id

      // 3. Resolver handler cadastrado para a assinatura (origin, type, version)
      const handler = handlerRegistry.get(event.origin, event.type, event.version)
      if (!handler) {
        throw new Error(
          `Handler não localizado no HandlerRegistry para: (${event.origin}, ${event.type}, v${event.version})`
        )
      }

      // 4. Buscar mapeamento de regras configurado para o usuário
      const mappings = await this.repository.findMappings(
        event.metadata.tenantId,
        event.origin,
        event.type
      )

      if (mappings.length === 0) {
        throw new Error(
          `Nenhum mapeamento de integração ativo para (${event.origin}, ${event.type})`
        )
      }

      // 5. First-Match Wins: mapeamento prioritário (priority ASC já vem ordenado do repository)
      const mapping = mappings[0]

      // 6. Executar handler (retorna o payload normalizado que foi processado)
      const normalizedPayload = await handler.handle(event, mapping)

      // 7. Atualizar log para 'processed'
      const durationMs = Date.now() - startTime
      await this.repository.updateEventLog(dbLogId, {
        status: 'processed',
        normalizedPayload,
        durationMs,
        processedBy: handler.constructor.name
      })

      logger.info('MoneyBridgeOrchestrator: event processed successfully', {
        origin: event.origin,
        eventId: event.id,
        durationMs
      })
    } catch (err) {
      const durationMs = Date.now() - startTime
      const errorMsg = err instanceof Error ? err.message : String(err)

      logger.error('MoneyBridgeOrchestrator: error processing event', {
        origin: event.origin,
        eventId: event.id,
        error: errorMsg
      })

      // Atualizar log para 'failed' se o log inicial foi criado
      if (dbLogId) {
        try {
          await this.repository.updateEventLog(dbLogId, {
            status: 'failed',
            error: errorMsg,
            durationMs
          })
        } catch (dbErr) {
          logger.error('MoneyBridgeOrchestrator: failed to write failed status', { error: dbErr })
        }
      }
    }
  }
}

/**
 * Singleton de produção — criado no bootstrap com SupabaseIntegrationRepository.
 * O Playground usa uma instância separada com MemoryIntegrationRepository na Etapa 1.
 *
 * Exportado aqui apenas como placeholder; o valor real é atribuído pelo bootstrap.
 */
export let moneyBridgeOrchestrator: MoneyBridgeOrchestrator
export function setMoneyBridgeOrchestrator(instance: MoneyBridgeOrchestrator): void {
  moneyBridgeOrchestrator = instance
}

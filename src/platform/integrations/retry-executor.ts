import { IIntegrationRepository, MoneybridgeEventLog } from '@/repositories/integration.repository'
import { connectorRegistry } from './connectors/registry'
import { logger } from '@/lib/logger'

export class RetryExecutor {
  constructor(
    private readonly repository: IIntegrationRepository,
    private readonly maxAttempts: number = 5
  ) {}

  /**
   * Varre o banco de dados em busca de eventos com status 'failed'
   * elegíveis para nova tentativa e executa o processamento deles.
   *
   * @param options.limit Limite máximo de registros a serem processados por lote
   */
  async scan(options: { limit: number }): Promise<{ processed: number; failed: number }> {
    // 1. Obter registros falhos com lock ativo do repositório (SKIP LOCKED)
    const failedEvents = await this.repository.findFailedEventsForRetry({
      maxAttempts: this.maxAttempts,
      limit: options.limit
    })

    let processedCount = 0
    let failedCount = 0

    for (const eventLog of failedEvents) {
      try {
        logger.info('RetryExecutor: starting re-processing of failed event', {
          eventId: eventLog.eventId,
          origin: eventLog.origin,
          attempt: (eventLog.attemptCount ?? 1) + 1
        })

        // 2. Resolver o conector correspondente à origem
        const registration = connectorRegistry.get(eventLog.origin)
        if (!registration) {
          throw new Error(`Conector não registrado para a plataforma de origem: "${eventLog.origin}"`)
        }

        // 3. Atualizar log informando o início do retry (auditoria)
        const nowStr = new Date().toISOString()
        const newAttemptCount = (eventLog.attemptCount ?? 1) + 1

        await this.repository.updateEventLog(eventLog.id, {
          status: 'processing',
          attemptCount: newAttemptCount,
          lastAttemptAt: nowStr,
          processingStartedAt: nowStr,
          error: null // Limpar o erro anterior
        })

        // 4. Delegar reprocessamento (rehidratação) mantendo o payload original intocado
        await registration.connector.rehydrateEvent({
          userId: eventLog.userId,
          eventId: eventLog.eventId,
          eventType: eventLog.eventType,
          payload: eventLog.payload
        })

        processedCount++
      } catch (err) {
        failedCount++
        const errorMsg = err instanceof Error ? err.message : String(err)
        logger.error('RetryExecutor: failed to reprocess event', {
          eventId: eventLog.eventId,
          origin: eventLog.origin,
          error: errorMsg
        })

        // Se houver falha na chamada, garantimos a persistência do status failed
        // O orchestrator também atualiza ao processar, mas se falhar antes do orchestrator
        // ser executado ou na resolução do conector, a marcação abaixo garante a integridade.
        try {
          await this.repository.updateEventLog(eventLog.id, {
            status: 'failed',
            error: `[RetryExecutor] ${errorMsg}`
          })
        } catch (dbErr) {
          logger.error('RetryExecutor: failed to record failure state', { error: dbErr })
        }
      }
    }

    return {
      processed: processedCount,
      failed: failedCount
    }
  }
}

import { PlatformEvent } from '../types'
import { IIntegrationRepository, MoneybridgeEventLog } from '@/repositories/integration.repository'
import { handlerRegistry } from './handlers/registry'
import { logger } from '@/lib/logger'

function calculateNextRetryAt(attemptCount: number, baseBackoffMinutes: number = 5): string {
  // Backoff exponencial: base * 2^(tentativa - 1)
  const backoffMs = baseBackoffMinutes * 60 * 1000 * Math.pow(2, attemptCount - 1)
  // Jitter de variação aleatória de ±15% para evitar ondas simultâneas (storms)
  const jitterMs = (Math.random() * 0.3 - 0.15) * backoffMs
  return new Date(Date.now() + backoffMs + jitterMs).toISOString()
}

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
    const nowStr = new Date().toISOString()
    let dbLogId: string | null = null
    let currentAttemptCount = 1

    try {
      // 1. Idempotência: verificar se o evento já foi processado com sucesso
      const isAlreadyProcessed = await this.repository.isEventProcessed(event.metadata.origin, event.id)
      if (isAlreadyProcessed) {
        logger.warn('MoneyBridgeOrchestrator: event already processed, skipping', {
          origin: event.metadata.origin,
          eventId: event.id
        })
        return
      }

      // 2. Registrar início do processamento (status: processing)
      let dbLog = await this.repository.findEventLog(event.metadata.origin, event.id)
      if (dbLog) {
        const attempt = dbLog.attemptCount ?? 1
        const updates: Partial<MoneybridgeEventLog> = {
          status: 'processing',
          error: null,
          processingStartedAt: nowStr,
          normalizerVersion: event.metadata.connectorVersion ?? 1
        }

        // Se a última tentativa não foi muito recente (evitando loops síncronos), incrementa
        const lastAttemptMs = new Date(dbLog.lastAttemptAt || '').getTime()
        const isVeryRecent = Date.now() - lastAttemptMs < 1000
        if (!event.metadata.replay && !isVeryRecent) {
          updates.attemptCount = attempt + 1
          updates.lastAttemptAt = nowStr
        } else {
          updates.attemptCount = attempt
        }

        if (!dbLog.firstAttemptAt) {
          updates.firstAttemptAt = dbLog.lastAttemptAt || nowStr
        }

        currentAttemptCount = updates.attemptCount ?? attempt
        await this.repository.updateEventLog(dbLog.id, updates)
        dbLogId = dbLog.id
      } else {
        const inserted = await this.repository.insertEventLog({
          userId: event.metadata.userId,
          origin: event.metadata.origin,
          eventId: event.id,
          eventType: event.type,
          status: 'processing',
          payload: event.payload,
          attemptCount: 1,
          lastAttemptAt: nowStr,
          firstAttemptAt: nowStr,
          processingStartedAt: nowStr,
          normalizerVersion: event.metadata.connectorVersion ?? 1
        })
        currentAttemptCount = 1
        dbLogId = inserted.id
      }

      // 3. Resolver handler cadastrado para a assinatura (origin, type, version)
      const handler = handlerRegistry.get(event.metadata.origin, event.type, event.version)
      if (!handler) {
        throw new Error(
          `Handler não localizado no HandlerRegistry para: (${event.metadata.origin}, ${event.type}, v${event.version})`
        )
      }

      // 4. Buscar mapeamento de regras configurado para o usuário
      const mappings = await this.repository.findMappings(
        event.metadata.userId,
        event.metadata.origin,
        event.type
      )

      if (mappings.length === 0) {
        throw new Error(
          `Nenhum mapeamento de integração ativo para (${event.metadata.origin}, ${event.type})`
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
        origin: event.metadata.origin,
        eventId: event.id,
        durationMs
      })
    } catch (err) {
      const durationMs = Date.now() - startTime
      const errorMsg = err instanceof Error 
        ? err.message 
        : (typeof err === 'object' && err !== null 
            ? ((err as any).message || JSON.stringify(err)) 
            : String(err))

      logger.error('MoneyBridgeOrchestrator: error processing event', {
        origin: event.metadata.origin,
        eventId: event.id,
        error: errorMsg
      })

      // Atualizar log para 'failed' se o log inicial foi criado
      if (dbLogId) {
        try {
          const nextRetryAt = calculateNextRetryAt(currentAttemptCount)
          await this.repository.updateEventLog(dbLogId, {
            status: 'failed',
            error: errorMsg,
            durationMs,
            nextRetryAt
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

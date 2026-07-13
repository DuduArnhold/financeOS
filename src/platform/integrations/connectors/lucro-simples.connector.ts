import { PlatformEvent } from '../../types'
import { LucroSimplesNormalizer } from './lucro-simples.normalizer'
import { IConnector, ConnectorCapability, WebhookRequest } from './registry'
import { EventType } from '../event-types'
import { MoneyBridgeOrchestrator } from '../orchestrator'

export class LucroSimplesConnector implements IConnector {
  // Metadados ricos de capabilities (Event Types, versões e sinalizações de recursos)
  readonly capabilities: readonly ConnectorCapability[] = [
    { eventType: 'sale.closed',      version: 1, enabled: true, replayable: true, idempotent: true },
    { eventType: 'sale.cancelled',   version: 1, enabled: true, replayable: true, idempotent: true },
    { eventType: 'sale.refunded',    version: 1, enabled: true, replayable: true, idempotent: true },
    { eventType: 'purchase.created', version: 1, enabled: true, replayable: true, idempotent: true },
    { eventType: 'purchase.paid',    version: 1, enabled: true, replayable: true, idempotent: true }
  ]

  private lastSyncAt?: string

  constructor(private readonly orchestrator: MoneyBridgeOrchestrator) {}

  async health() {
    return {
      status: 'OK' as const,
      lastSyncAt: this.lastSyncAt,
      version: '1.0.0'
    }
  }

  /**
   * Ponto de entrada unificado para requisições de webhook do Lucro Simples.
   */
  async handleWebhook(request: WebhookRequest): Promise<void> {
    const eventType = LucroSimplesNormalizer.detectEventType(request.payload, request.context.headers)
    
    const event = LucroSimplesNormalizer.normalize(request.payload, {
      userId: request.userId,
      eventId: request.eventId,
      correlationId: request.context.correlationId,
      eventType,
      connectorVersion: 1,
      replay: false
    })

    this.lastSyncAt = new Date().toISOString()
    await this.orchestrator.process(event)
  }

  /**
   * Ponto de entrada unificado para reprocessamento (replay/retry) de eventos de auditoria.
   */
  async rehydrateEvent(eventLog: {
    userId: string
    eventId: string
    eventType: string
    payload: unknown
  }): Promise<void> {
    const event = LucroSimplesNormalizer.normalize(eventLog.payload, {
      userId: eventLog.userId,
      eventId: eventLog.eventId,
      correlationId: crypto.randomUUID(), // Geração de um novo ID de rastreamento para o replay/retry
      eventType: eventLog.eventType as EventType,
      connectorVersion: 1,
      replay: true
    })

    await this.orchestrator.process(event)
  }
}

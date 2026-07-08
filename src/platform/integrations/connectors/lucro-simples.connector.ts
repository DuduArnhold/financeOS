import { PlatformEvent, NormalizedSale, NormalizedPurchase } from '../../types'
import { LucroSimplesNormalizer, RawLucroSimplesSale } from './lucro-simples.normalizer'
import { PlatformPublisher } from '../../publisher'
import { IConnector, ConnectorCapability } from './registry'
import { EventTypes, EventType } from '../event-types'

export class LucroSimplesConnector implements IConnector {
  // Metadados ricos de capabilities (Event Types, versões e sinalizações de recursos)
  readonly capabilities: readonly ConnectorCapability[] = [
    { eventType: EventTypes.SALE_CLOSED,      version: 1, enabled: true, replayable: true, idempotent: true },
    { eventType: EventTypes.SALE_CANCELLED,   version: 1, enabled: true, replayable: true, idempotent: true },
    { eventType: EventTypes.SALE_REFUNDED,    version: 1, enabled: true, replayable: true, idempotent: true },
    { eventType: EventTypes.PURCHASE_CREATED, version: 1, enabled: true, replayable: true, idempotent: true },
    { eventType: EventTypes.PURCHASE_PAID,    version: 1, enabled: true, replayable: true, idempotent: true }
  ]

  private lastSyncAt?: string

  async health() {
    return {
      status: 'OK' as const,
      lastSyncAt: this.lastSyncAt,
      version: '1.0.0'
    }
  }

  /**
   * Implementação do contrato genérico IConnector.
   * Roteia a execução com base no tipo de evento recebido do webhook.
   */
  async handleEvent(userId: string, eventId: string, eventType: string, rawPayload: unknown): Promise<void> {
    if (eventType === EventTypes.SALE_CLOSED) {
      await this.handleSaleClosed(userId, eventId, rawPayload as RawLucroSimplesSale)
    } else if (eventType === EventTypes.SALE_CANCELLED) {
      await this.handleSaleCancelled(userId, eventId, rawPayload as RawLucroSimplesSale)
    } else if (eventType === EventTypes.SALE_REFUNDED) {
      await this.handleSaleRefunded(userId, eventId, rawPayload as RawLucroSimplesSale)
    } else if (eventType === EventTypes.PURCHASE_CREATED) {
      await this.handlePurchaseCreated(userId, eventId, rawPayload as RawLucroSimplesSale)
    } else if (eventType === EventTypes.PURCHASE_PAID) {
      await this.handlePurchasePaid(userId, eventId, rawPayload as RawLucroSimplesSale)
    } else {
      throw new Error(`LucroSimplesConnector: tipo de evento não suportado — "${eventType}"`)
    }
  }

  /**
   * Implementação do replay genérico.
   * Re-injeta o payload original na porta de entrada handleEvent para passar por todo o pipeline.
   */
  async handleStoredEvent(eventLog: {
    userId: string
    eventId: string
    eventType: string
    payload: unknown
  }): Promise<void> {
    await this.handleEvent(eventLog.userId, eventLog.eventId, eventLog.eventType, eventLog.payload)
  }

  /**
   * Recebe um fechamento de caixa cru do Lucro Simples, normaliza, constrói
   * o envelope PlatformEvent imutável e despacha ao PlatformPublisher.
   */
  async handleSaleClosed(
    userId: string,
    eventId: string,
    rawSale: RawLucroSimplesSale,
    traceId?: string
  ): Promise<void> {
    const normalized = LucroSimplesNormalizer.normalize(rawSale)
    
    // NOTE: PlatformEvent.version representa a Event Version do contrato de payload do evento.
    // ConnectorRegistration.version (configurado no bootstrap) representa a versão do conector.
    const event: PlatformEvent<NormalizedSale> = {
      id: eventId,
      version: 1,
      schemaVersion: 1,
      type: EventTypes.SALE_CLOSED,
      origin: 'lucro_simples',
      occurredAt: normalized.occurredAt,
      payload: {
        ...normalized,
        vendaId: rawSale.vendaId
      },
      metadata: {
        tenantId: userId,
        traceId: traceId || crypto.randomUUID()
      }
    }

    this.lastSyncAt = new Date().toISOString()
    await PlatformPublisher.publishAsync(event)
  }

  async handleSaleCancelled(userId: string, eventId: string, rawSale: RawLucroSimplesSale): Promise<void> {
    const normalized = LucroSimplesNormalizer.normalize(rawSale)
    const event: PlatformEvent<NormalizedSale> = {
      id: eventId,
      version: 1,
      schemaVersion: 1,
      type: EventTypes.SALE_CANCELLED,
      origin: 'lucro_simples',
      occurredAt: normalized.occurredAt,
      payload: {
        ...normalized,
        vendaId: rawSale.vendaId
      },
      metadata: {
        tenantId: userId,
        traceId: crypto.randomUUID()
      }
    }
    await PlatformPublisher.publishAsync(event)
  }

  async handleSaleRefunded(userId: string, eventId: string, rawSale: RawLucroSimplesSale): Promise<void> {
    const normalized = LucroSimplesNormalizer.normalize(rawSale)
    const event: PlatformEvent<NormalizedSale> = {
      id: eventId,
      version: 1,
      schemaVersion: 1,
      type: EventTypes.SALE_REFUNDED,
      origin: 'lucro_simples',
      occurredAt: normalized.occurredAt,
      payload: {
        ...normalized,
        vendaId: rawSale.vendaId
      },
      metadata: {
        tenantId: userId,
        traceId: crypto.randomUUID()
      }
    }
    await PlatformPublisher.publishAsync(event)
  }

  async handlePurchaseCreated(userId: string, eventId: string, rawSale: RawLucroSimplesSale): Promise<void> {
    const normalized = LucroSimplesNormalizer.normalize(rawSale)
    const event: PlatformEvent<NormalizedPurchase> = {
      id: eventId,
      version: 1,
      schemaVersion: 1,
      type: EventTypes.PURCHASE_CREATED,
      origin: 'lucro_simples',
      occurredAt: normalized.occurredAt,
      payload: {
        occurredAt: normalized.occurredAt,
        amount: normalized.amount,
        currency: normalized.currency,
        description: normalized.description,
        tags: normalized.tags,
        compraId: rawSale.vendaId || eventId // usa vendaId como compraId fallback
      },
      metadata: {
        tenantId: userId,
        traceId: crypto.randomUUID()
      }
    }
    await PlatformPublisher.publishAsync(event)
  }

  async handlePurchasePaid(userId: string, eventId: string, rawSale: RawLucroSimplesSale): Promise<void> {
    const normalized = LucroSimplesNormalizer.normalize(rawSale)
    const event: PlatformEvent<NormalizedPurchase> = {
      id: eventId,
      version: 1,
      schemaVersion: 1,
      type: EventTypes.PURCHASE_PAID,
      origin: 'lucro_simples',
      occurredAt: normalized.occurredAt,
      payload: {
        occurredAt: normalized.occurredAt,
        amount: normalized.amount,
        currency: normalized.currency,
        description: normalized.description,
        tags: normalized.tags,
        compraId: rawSale.vendaId || eventId
      },
      metadata: {
        tenantId: userId,
        traceId: crypto.randomUUID()
      }
    }
    await PlatformPublisher.publishAsync(event)
  }
}

export const lucroSimplesConnector = new LucroSimplesConnector()

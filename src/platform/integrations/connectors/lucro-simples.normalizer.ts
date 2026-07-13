import { PlatformEvent, NormalizedSale, NormalizedPurchase } from '../../types'
import { NormalizationContext } from './registry'
import { EventTypes, EventType } from '../event-types'

export interface RawLucroSimplesSale {
  valorLiquido: number
  dataFechamento: string
  descricao: string
  vendaId?: string
}

export class LucroSimplesNormalizer {
  /**
   * Converte o payload proprietário do Lucro Simples no contrato PlatformEvent unificado da plataforma.
   */
  static normalize(raw: any, context: NormalizationContext): PlatformEvent<NormalizedSale | NormalizedPurchase> {
    // Validações estruturais: o campo existe e tem o tipo correto?
    if (raw.valorLiquido === undefined || raw.valorLiquido === null || typeof raw.valorLiquido !== 'number' || isNaN(raw.valorLiquido)) {
      throw new Error('LucroSimplesNormalizer: valorLiquido ausente ou não é um número')
    }
    if (!raw.dataFechamento) {
      throw new Error('LucroSimplesNormalizer: dataFechamento ausente')
    }

    // Formatar dataFechamento (YYYY-MM-DD) → ISO 8601
    let occurredAtIso: string
    try {
      const date = new Date(raw.dataFechamento)
      if (isNaN(date.getTime())) {
        throw new Error('Data inválida')
      }
      occurredAtIso = date.toISOString()
    } catch {
      // Fallback para o dia atual se o parsing falhar
      occurredAtIso = new Date().toISOString()
    }

    let payload: NormalizedSale | NormalizedPurchase

    // Normalização específica baseada no EventType
    if (
      context.eventType === EventTypes.SALE_CLOSED ||
      context.eventType === EventTypes.SALE_CANCELLED ||
      context.eventType === EventTypes.SALE_REFUNDED
    ) {
      payload = {
        occurredAt: occurredAtIso,
        amount: raw.valorLiquido,
        currency: 'BRL',
        description: raw.descricao || 'Fechamento de Caixa Lucro Simples',
        tags: ['lucro_simples'],
        vendaId: raw.vendaId
      }
    } else if (
      context.eventType === EventTypes.PURCHASE_CREATED ||
      context.eventType === EventTypes.PURCHASE_PAID
    ) {
      payload = {
        occurredAt: occurredAtIso,
        amount: raw.valorLiquido,
        currency: 'BRL',
        description: raw.descricao || 'Compra Lucro Simples',
        tags: ['lucro_simples'],
        compraId: raw.vendaId || context.eventId
      }
    } else {
      throw new Error(`LucroSimplesNormalizer: tipo de evento não suportado — "${context.eventType}"`)
    }

    return {
      id: context.eventId,
      type: context.eventType,
      version: 1, // Versão do payload do evento
      occurredAt: occurredAtIso,
      payload,
      metadata: {
        origin: 'lucro_simples',
        userId: context.userId,
        requestId: context.correlationId,
        correlationId: context.correlationId,
        connectorVersion: context.connectorVersion,
        replay: context.replay
      }
    }
  }

  /**
   * Identifica o EventType a partir de headers ou propriedades do payload.
   */
  static detectEventType(payload: any, headers?: Record<string, string>): EventType {
    const typeHeader = headers?.['x-event-type'] || headers?.['X-Event-Type']
    if (typeHeader) {
      return typeHeader as EventType
    }
    if (payload && typeof payload === 'object') {
      if ('event_type' in payload && payload.event_type) return payload.event_type as EventType
      if ('eventType' in payload && payload.eventType) return payload.eventType as EventType
      if ('type' in payload && payload.type) return payload.type as EventType
    }
    return EventTypes.SALE_CLOSED
  }
}

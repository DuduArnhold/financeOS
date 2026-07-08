import { PlatformEvent } from './types'
import { eventBus } from './event-bus'

/**
 * Erro lançado quando um PlatformEvent não satisfaz o contrato estrutural mínimo.
 * O barramento nunca deve receber eventos incompletos.
 */
export class InvalidPlatformEvent extends Error {
  constructor(field: string) {
    super(`InvalidPlatformEvent: campo obrigatório ausente ou inválido — "${field}"`)
    this.name = 'InvalidPlatformEvent'
  }
}

export class PlatformPublisher {
  /**
   * Valida estruturalmente o evento (sem publicar).
   * Usado pela Server Action para testar schema antes de enviar ao bus.
   */
  static validate(event: PlatformEvent<unknown>): void {
    if (!event.id)                               throw new InvalidPlatformEvent('id')
    if (!event.type)                             throw new InvalidPlatformEvent('type')
    if (!event.origin)                           throw new InvalidPlatformEvent('origin')
    if (typeof event.version !== 'number')       throw new InvalidPlatformEvent('version')
    if (typeof event.schemaVersion !== 'number') throw new InvalidPlatformEvent('schemaVersion')
    if (!event.occurredAt)                       throw new InvalidPlatformEvent('occurredAt')
    if (event.payload === undefined || event.payload === null) throw new InvalidPlatformEvent('payload')
    if (!event.metadata?.tenantId)               throw new InvalidPlatformEvent('metadata.tenantId')
    if (!event.metadata?.traceId)                throw new InvalidPlatformEvent('metadata.traceId')
  }

  /**
   * Valida estruturalmente o evento e publica no barramento de eventos.
   * Qualquer campo obrigatório ausente lança InvalidPlatformEvent imediatamente.
   * O barramento nunca recebe lixo.
   */
  static publish(event: PlatformEvent<unknown>): void {
    PlatformPublisher.validate(event)
    eventBus.publish(event)
  }

  /**
   * Valida estruturalmente o evento e publica de forma assíncrona, aguardando
   * a conclusão de todos os subscribers assíncronos registrados.
   */
  static async publishAsync(event: PlatformEvent<unknown>): Promise<void> {
    PlatformPublisher.validate(event)
    await eventBus.publishAsync(event)
  }
}

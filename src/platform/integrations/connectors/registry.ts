import { IntegrationOrigin } from '../origins'

/**
 * Contrato que todos os conectores de sistemas terceiros devem implementar.
 * Garante que a plataforma possa chamá-los ou reprocessar eventos falhos genericamente.
 */
export interface IConnector {
  /**
   * Processa um evento recebido em tempo real pela porta de entrada (Webhook).
   */
  handleEvent(userId: string, eventId: string, eventType: string, rawPayload: unknown): Promise<void>

  /**
   * Reprocessa (Replay) um evento histórico que falhou, recebendo o registro de auditoria completo.
   */
  handleStoredEvent(eventLog: {
    userId: string
    eventId: string
    eventType: string
    payload: unknown
  }): Promise<void>
}

import { EventType } from '../event-types'

export interface ConnectorCapability {
  readonly eventType: EventType
  readonly version: number // Versão do Evento (Event Version)
  readonly enabled: boolean
  readonly replayable: boolean
  readonly idempotent: boolean
}

/**
 * Metadados de registro de um conector no barramento central.
 */
export interface ConnectorRegistration {
  readonly origin: IntegrationOrigin
  readonly connector: IConnector
  readonly version: number // Versão do Conector
  readonly capabilities: readonly ConnectorCapability[]
  // ─── Metadados de exibição ─────────────────────────────────────────────────
  readonly name: string            // ex: "Lucro Simples"
  readonly icon: string            // ex: "plug" (lucide-react icon name)
  readonly supportsReplay: boolean
  readonly supportsMappings: boolean
  readonly supportsApiKey: boolean
  readonly enabled: boolean        // Feature Flag para ativar/desativar o conector
}

class ConnectorRegistry {
  private registrations = new Map<string, ConnectorRegistration>()

  /**
   * Registra um conector na plataforma com seus metadados.
   */
  register(registration: ConnectorRegistration): void {
    const key = registration.origin
    if (this.registrations.has(key)) {
      console.warn(`ConnectorRegistry: overriding connector for origin "${key}"`)
    }
    this.registrations.set(key, registration)
  }

  /**
   * Obtém o registro de um conector com base na sua origem.
   */
  get(origin: string): ConnectorRegistration | null {
    return this.registrations.get(origin) || null
  }

  /**
   * Lista todas as conexões cadastradas no barramento.
   */
  getAll(): ConnectorRegistration[] {
    return Array.from(this.registrations.values())
  }
}

export const connectorRegistry = new ConnectorRegistry()

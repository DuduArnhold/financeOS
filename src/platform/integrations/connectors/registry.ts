import { IntegrationOrigin } from '../origins'
import { EventType } from '../event-types'

/**
 * Contrato que todos os conectores de sistemas terceiros devem implementar.
 * Garante que a plataforma possa chamá-los ou reprocessar eventos falhos genericamente.
 */
export interface WebhookContext {
  readonly headers: Readonly<Record<string, string>>;
  readonly ip?: string;
  readonly requestId: string;
  readonly correlationId: string;
}

export interface WebhookRequest {
  readonly userId: string;
  readonly eventId: string;
  readonly payload: unknown;
  readonly context: WebhookContext;
}

export interface NormalizationContext {
  readonly userId: string;
  readonly eventId: string;
  readonly correlationId: string;
  readonly eventType: EventType;
  readonly connectorVersion: number;
  readonly replay: boolean;
}

/**
 * Contrato que todos os conectores de sistemas terceiros devem implementar.
 */
export interface IConnector {
  /**
   * Processa uma requisição recebida no Webhook de entrada.
   */
  handleWebhook(request: WebhookRequest): Promise<void>

  /**
   * Reprocessa (Replay/Retry) um evento histórico ou falhou, recebendo o registro de auditoria completo.
   * Reconstrói o PlatformEvent canônico a partir do payload bruto (raw data).
   */
  rehydrateEvent(eventLog: {
    userId: string
    eventId: string
    eventType: string
    payload: unknown
  }): Promise<void>
}

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

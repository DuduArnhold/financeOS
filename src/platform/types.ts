import { EventType } from './integrations/event-types'

/**
 * Contrato unificado de Venda Normalizada.
 * Todo conector de vendas deve normalizar seu payload para esta estrutura.
 */
export interface NormalizedSale {
  readonly occurredAt: string;        // Data/Hora ISO 8601 da ocorrência da venda
  readonly amount: number;            // Valor decimal absoluto da transação (ex: 1300.00)
  readonly currency: string;          // Moeda em formato padrão ISO 4217 (ex: 'BRL')
  readonly description: string;       // Descrição legível da transação
  readonly tags: readonly string[];   // Etiquetas adicionais (ex: ['lucro_simples'])
  readonly vendaId?: string;          // ID de referência externa (opcional, usado em cancelamentos)
}

/**
 * Contrato unificado de Compra/Despesa Normalizada.
 * Todo conector de despesas/compras deve normalizar seu payload para esta estrutura.
 */
export interface NormalizedPurchase {
  readonly occurredAt: string;        // Data/Hora ISO 8601 da ocorrência da compra
  readonly amount: number;            // Valor decimal absoluto da transação (ex: 450.00)
  readonly currency: string;          // Moeda em formato padrão ISO 4217 (ex: 'BRL')
  readonly description: string;       // Descrição legível da transação
  readonly tags: readonly string[];   // Etiquetas adicionais (ex: ['lucro_simples'])
  readonly compraId: string;          // ID de referência externa da compra
}

/**
 * Interface genérica imutável para eventos da JA Platform.
 */
export interface PlatformEvent<T> {
  readonly id: string;
  // NOTE: PlatformEvent.version representa a versão do contrato de payload do evento (Event Version).
  // Ela é independente e isolada da versão lógica do conector (ConnectorRegistration.version).
  readonly version: number;
  readonly schemaVersion: number;  // Versão da estrutura física do payload
  readonly type: EventType;        // Tipo estrito do evento (sale.closed, etc.)
  readonly origin: string;         // Ex: 'lucro_simples'
  readonly occurredAt: string;     // Carimbo de data/hora em formato ISO 8601
  readonly payload: T;
  readonly metadata: {
    readonly tenantId: string;     // ID do Usuário (user_id no Supabase)
    readonly traceId: string;      // ID único para rastrear todo o fluxo
    readonly causationId?: string; // ID do evento/comando imediato que causou este evento
    readonly sourceEventId?: string; // ID do evento original de disparo
  };
}

/**
 * Interface base para Comandos executados na JA Platform (CQRS).
 */
export interface PlatformCommand {
  readonly type: string;
}

/**
 * Comando para criação de movimentação financeira no FinanceOS.
 * Mantém apenas dados escalares primitivos, livre de acoplamento com banco.
 */
export interface CreateMovementCommand extends PlatformCommand {
  readonly type: 'CreateMovementCommand';
  readonly userId: string;
  readonly tipo: 'receita' | 'despesa';
  readonly valor: number;
  readonly accountId: string;
  readonly categoryId: string;
  readonly formaPagamento: string;
  readonly data: string;
  readonly descricao: string;
  readonly origin: string;
  readonly origemRef?: string | null;  // Identificador de referência externa
  readonly origemUuid?: string | null; // Identificador interno correlacionado
}

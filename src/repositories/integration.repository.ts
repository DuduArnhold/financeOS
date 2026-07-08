import { supabase } from '@/lib/supabase'
import { SupabaseClient } from '@supabase/supabase-js'

// ─── Tipos compartilhados ────────────────────────────────────────────────────

export interface IntegrationMapping {
  id: string
  userId: string
  origin: string
  eventType: string
  accountId: string
  categoryId: string
  priority: number
  enabled: boolean
  createdAt: string
}

export interface MoneybridgeEventLog {
  id: string
  userId: string
  origin: string
  eventId: string
  eventType: string
  status: 'processing' | 'processed' | 'failed'
  payload: unknown
  normalizedPayload?: unknown
  durationMs?: number
  error?: string | null
  processedBy?: string
  attemptCount?: number
  lastAttemptAt?: string
  createdAt?: string
}

// ─── Contrato (Interface) ─────────────────────────────────────────────────────

/**
 * Contrato que o MoneyBridgeOrchestrator usa para persistir e consultar
 * logs de eventos de integração e mapeamentos de regras.
 *
 * Duas implementações existem:
 *  - SupabaseIntegrationRepository (produção)
 *  - MemoryIntegrationRepository   (testes / Etapa 1 sem banco)
 */
export interface IIntegrationRepository {
  isEventProcessed(origin: string, eventId: string): Promise<boolean>
  insertEventLog(log: Omit<MoneybridgeEventLog, 'id' | 'createdAt'>): Promise<MoneybridgeEventLog>
  updateEventLog(id: string, updates: Partial<MoneybridgeEventLog>): Promise<void>
  findMappings(userId: string, origin: string, eventType: string): Promise<IntegrationMapping[]>
}

// ─── Implementação Supabase (produção) ────────────────────────────────────────

export class SupabaseIntegrationRepository implements IIntegrationRepository {
  constructor(private readonly client: SupabaseClient = supabase) {}

  /**
   * Busca mapeamentos habilitados do usuário filtrados por origem e tipo de evento,
   * ordenados por prioridade (priority ASC).
   */
  async findMappings(userId: string, origin: string, eventType: string): Promise<IntegrationMapping[]> {
    const { data, error } = await this.client
      .from('integration_mappings')
      .select('*')
      .eq('user_id', userId)
      .eq('origin', origin)
      .eq('event_type', eventType)
      .eq('enabled', true)
      .order('priority', { ascending: true })

    if (error) throw error

    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      origin: row.origin,
      eventType: row.event_type,
      accountId: row.account_id,
      categoryId: row.category_id,
      priority: row.priority,
      enabled: row.enabled,
      createdAt: row.created_at
    }))
  }

  /**
   * Insere um novo log de evento com status inicial.
   */
  async insertEventLog(log: Omit<MoneybridgeEventLog, 'id' | 'createdAt'>): Promise<MoneybridgeEventLog> {
    const { data, error } = await this.client
      .from('moneybridge_events')
      .insert({
        user_id: log.userId,
        origin: log.origin,
        event_id: log.eventId,
        event_type: log.eventType,
        status: log.status,
        payload: log.payload,
        processed_by: log.processedBy,
        attempt_count: log.attemptCount ?? 1,
        last_attempt_at: log.lastAttemptAt ?? new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      userId: data.user_id,
      origin: data.origin,
      eventId: data.event_id,
      eventType: data.event_type,
      status: data.status,
      payload: data.payload,
      normalizedPayload: data.normalized_payload,
      durationMs: data.duration_ms,
      error: data.error,
      processedBy: data.processed_by,
      attemptCount: data.attempt_count,
      lastAttemptAt: data.last_attempt_at,
      createdAt: data.created_at
    }
  }

  /**
   * Atualiza as informações do log de evento (status, duration, error, normalized_payload, attempts).
   */
  async updateEventLog(id: string, updates: Partial<MoneybridgeEventLog>): Promise<void> {
    const dbUpdates: any = {
      status: updates.status,
      normalized_payload: updates.normalizedPayload,
      duration_ms: updates.durationMs,
      error: updates.error,
      processed_by: updates.processedBy
    }

    if (updates.attemptCount !== undefined) dbUpdates.attempt_count = updates.attemptCount
    if (updates.lastAttemptAt !== undefined) dbUpdates.last_attempt_at = updates.lastAttemptAt

    const { error } = await this.client
      .from('moneybridge_events')
      .update(dbUpdates)
      .eq('id', id)

    if (error) throw error
  }

  /**
   * Verifica idempotência: se o evento já foi processado com sucesso.
   */
  async isEventProcessed(origin: string, eventId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('moneybridge_events')
      .select('id')
      .eq('origin', origin)
      .eq('event_id', eventId)
      .eq('status', 'processed')
      .limit(1)

    if (error) throw error

    return (data || []).length > 0
  }
}

// ─── Singletons exportados ────────────────────────────────────────────────────

/** Instância Supabase (produção) — usada pelo bootstrap */
export const supabaseIntegrationRepository = new SupabaseIntegrationRepository()

/**
 * @deprecated Use `supabaseIntegrationRepository` directly or inject via DI.
 * Mantido para compatibilidade com código legado durante a transição.
 */
export const integrationRepository = supabaseIntegrationRepository

// Alias para o tipo legado — evita quebrar imports externos
export type { IIntegrationRepository as IEventStore }

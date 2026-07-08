import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { generateApiKey, hashApiKey } from '@/lib/crypto'
import type { IntegrationOrigin } from '@/platform/integrations/origins'
import { connectorRegistry } from '@/platform/integrations/connectors/registry'
import {
  PipelineStages,
  ConnectorSummaryDTO,
  IntegrationStatusDTO,
  ApiKeyDTO,
  MappingDTO,
  ActivityItemDTO,
  EventLogDTO,
  EventLogDetailDTO,
  HealthStatusDTO,
  HealthComponentDTO,
  PipelineStepDTO,
} from '@/platform/integrations/contracts'
import { ActivityFormatter } from '@/platform/integrations/activity-formatter'
import type {
  CreateApiKeyRequestDTO,
  CreateMappingRequestDTO,
} from '@/platform/integrations/contracts'

// ─── Tipos de paginação ───────────────────────────────────────────────────────

export interface PaginationOptions {
  page?: number
  pageSize?: number
}

export interface PaginatedResult<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  hasNext: boolean
  hasPrev: boolean
}

export interface EventLogFilters extends PaginationOptions {
  status?: 'processing' | 'processed' | 'failed'
  origin?: IntegrationOrigin
}

// ─── Factory de cliente autenticado ─────────────────────────────────────────

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL     || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

function makeAuthClient(accessToken: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

// ─── IntegrationService ───────────────────────────────────────────────────────

/**
 * Serviço central de integrações.
 * Toda leitura e escrita de integrações passa por aqui.
 * Retorna exclusivamente DTOs — nenhuma entidade interna é exposta.
 *
 * Extrair serviços especializados quando este arquivo atingir ~700 linhas.
 */
export class IntegrationService {
  private db: SupabaseClient

  constructor(db: SupabaseClient) {
    this.db = db
  }

  // ─── Conectores ─────────────────────────────────────────────────────────────

  async listConnectors(userId: string): Promise<ConnectorSummaryDTO[]> {
    const registrations = connectorRegistry.getAll().filter((reg) => reg.enabled)

    return Promise.all(
      registrations.map(async (reg) => {
        const status = await this.getStatus(userId, reg.origin)
        return {
          origin:       reg.origin,
          name:         reg.name,
          icon:         reg.icon,
          status:       status.status,
          version:      reg.version,
          capabilities: [
            reg.supportsReplay && 'replay',
            reg.supportsMappings && 'mappings',
            reg.supportsApiKey && 'api_keys',
          ].filter((c): c is 'replay' | 'mappings' | 'api_keys' => !!c),
          lastEventAt:   status.lastEventAt,
          eventsCount:   status.eventsCount,
          failuresCount: status.failuresCount,
          totalRevenue:  status.totalRevenue,
        } satisfies ConnectorSummaryDTO
      })
    )
  }

  async getStatus(userId: string, origin: IntegrationOrigin): Promise<IntegrationStatusDTO> {
    const { data: events } = await this.db
      .from('moneybridge_events')
      .select('id, status, payload, created_at')
      .eq('user_id', userId)
      .eq('origin', origin)
      .order('created_at', { ascending: false })
      .limit(1000)

    const all       = events ?? []
    const lastEvent = all[0]
    const failed    = all.filter((e) => e.status === 'failed').length
    const processed = all.filter((e) => e.status === 'processed')

    const totalRevenue = processed.reduce((sum, e) => {
      const p = e.payload as Record<string, unknown>
      return sum + (typeof p?.valorLiquido === 'number' ? p.valorLiquido : 0)
    }, 0)

    const integrationStatus: IntegrationStatusDTO['status'] =
      all.length === 0 ? 'not_configured'
      : failed > 0     ? 'degraded'
      :                  'connected'

    return {
      origin,
      status:        integrationStatus,
      lastEventAt:   lastEvent?.created_at ?? null,
      lastEventId:   lastEvent?.id ?? null,
      eventsCount:   all.length,
      failuresCount: failed,
      totalRevenue,
    }
  }

  // ─── API Keys ────────────────────────────────────────────────────────────────

  async listApiKeys(userId: string, origin?: IntegrationOrigin): Promise<ApiKeyDTO[]> {
    let query = this.db
      .from('integration_keys')
      .select('id, name, origin, prefix, description, created_at, last_used_at, last_ip, revoked_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (origin) query = query.eq('origin', origin)

    const { data } = await query
    return (data ?? []).map((row) => ({
      id:          row.id,
      name:        row.name,
      origin:      row.origin as IntegrationOrigin,
      prefix:      row.prefix,
      description: row.description ?? null,
      createdAt:   row.created_at,
      lastUsedAt:  row.last_used_at ?? null,
      lastIp:      row.last_ip ?? null,
      isRevoked:   !!row.revoked_at,
    } satisfies ApiKeyDTO))
  }

  async createApiKey(
    userId: string,
    input: CreateApiKeyRequestDTO
  ): Promise<{ dto: ApiKeyDTO; plainKey: string }> {
    const plainKey = generateApiKey()
    const prefix   = plainKey.substring(0, 14) + '...'
    const keyHash  = hashApiKey(plainKey)

    const { data, error } = await this.db
      .from('integration_keys')
      .insert({
        user_id:     userId,
        name:        input.name,
        origin:      input.origin,
        prefix,
        key_hash:    keyHash,
        description: input.description ?? null,
        permissions: ['*'],
      })
      .select('id, name, origin, prefix, description, created_at, last_used_at, last_ip, revoked_at')
      .single()

    if (error || !data) throw new Error(`Falha ao criar chave: ${error?.message}`)

    const dto: ApiKeyDTO = {
      id:          data.id,
      name:        data.name,
      origin:      data.origin as IntegrationOrigin,
      prefix:      data.prefix,
      description: data.description ?? null,
      createdAt:   data.created_at,
      lastUsedAt:  null,
      lastIp:      null,
      isRevoked:   false,
    }

    return { dto, plainKey }
  }

  async revokeApiKey(userId: string, keyId: string): Promise<void> {
    await this.db
      .from('integration_keys')
      .update({ revoked_at: new Date().toISOString(), revoked_by: userId })
      .eq('id', keyId)
      .eq('user_id', userId)
  }

  // ─── Mapeamentos ─────────────────────────────────────────────────────────────

  async listMappings(userId: string, origin?: IntegrationOrigin): Promise<MappingDTO[]> {
    let query = this.db
      .from('integration_mappings')
      .select(`id, origin, event_type, priority, enabled, conditions, created_at,
               account:accounts(id, name), category:categories(id, name)`)
      .eq('user_id', userId)
      .order('priority', { ascending: true })

    if (origin) query = query.eq('origin', origin)

    const { data } = await query

    return (data ?? []).map((row) => {
      const r        = row as Record<string, unknown>
      const account  = r.account  as { id: string; name: string } | null
      const category = r.category as { id: string; name: string } | null
      return {
        id:           r.id as string,
        origin:       r.origin as IntegrationOrigin,
        eventType:    r.event_type as string,
        accountId:    account?.id   ?? '',
        accountName:  account?.name ?? '',
        categoryId:   category?.id   ?? '',
        categoryName: category?.name ?? '',
        priority:     r.priority as number,
        enabled:      r.enabled as boolean,
        conditions:   (r.conditions as []) ?? [],
        createdAt:    r.created_at as string,
      } satisfies MappingDTO
    })
  }

  async saveMapping(userId: string, input: CreateMappingRequestDTO): Promise<MappingDTO> {
    const { data, error } = await this.db
      .from('integration_mappings')
      .upsert({
        user_id:     userId,
        origin:      input.origin,
        event_type:  input.eventType,
        account_id:  input.accountId,
        category_id: input.categoryId,
        priority:    input.priority,
        enabled:     input.enabled,
        conditions:  input.conditions ?? [],
      })
      .select(`id, origin, event_type, priority, enabled, conditions, created_at,
               account:accounts(id, name), category:categories(id, name)`)
      .single()

    if (error || !data) throw new Error(`Falha ao salvar mapeamento: ${error?.message}`)

    const r        = data as Record<string, unknown>
    const account  = r.account  as { id: string; name: string } | null
    const category = r.category as { id: string; name: string } | null

    return {
      id:           r.id as string,
      origin:       r.origin as IntegrationOrigin,
      eventType:    r.event_type as string,
      accountId:    account?.id   ?? '',
      accountName:  account?.name ?? '',
      categoryId:   category?.id   ?? '',
      categoryName: category?.name ?? '',
      priority:     r.priority as number,
      enabled:      r.enabled as boolean,
      conditions:   (r.conditions as []) ?? [],
      createdAt:    r.created_at as string,
    }
  }

  // ─── Logs de Eventos ─────────────────────────────────────────────────────────

  async listEventLogs(
    userId: string,
    filters: EventLogFilters = {}
  ): Promise<PaginatedResult<EventLogDTO>> {
    const page     = filters.page     ?? 1
    const pageSize = filters.pageSize ?? 20
    const from     = (page - 1) * pageSize
    const to       = from + pageSize - 1

    let query = this.db
      .from('moneybridge_events')
      .select(
        'id, event_id, origin, event_type, status, payload, duration_ms, attempt_count, last_attempt_at, created_at',
        { count: 'exact' }
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (filters.status) query = query.eq('status', filters.status)
    if (filters.origin) query = query.eq('origin', filters.origin)

    const { data, count } = await query
    const total = count ?? 0

    const items: EventLogDTO[] = (data ?? []).map((row) => {
      const p = row.payload as Record<string, unknown>
      return {
        id:            row.id,
        eventId:       row.event_id,
        origin:        row.origin as IntegrationOrigin,
        eventType:     row.event_type ?? 'unknown',
        status:        row.status as EventLogDTO['status'],
        amount:        typeof p?.valorLiquido === 'number' ? p.valorLiquido : null,
        durationMs:    row.duration_ms ?? null,
        attemptCount:  row.attempt_count ?? 1,
        lastAttemptAt: row.last_attempt_at ?? null,
        createdAt:     row.created_at,
      }
    })

    return { items, page, pageSize, total, hasNext: to < total - 1, hasPrev: page > 1 }
  }

  async getEventLogDetail(userId: string, eventId: string): Promise<EventLogDetailDTO | null> {
    const { data } = await this.db
      .from('moneybridge_events')
      .select('*')
      .eq('user_id', userId)
      .eq('id', eventId)
      .single()

    if (!data) return null

    const isFailed = data.status === 'failed'
    const steps: PipelineStepDTO[] = [
      { id: 'webhook_ingress',      order: 1, stage: PipelineStages.WEBHOOK,    status: 'success',               startedAt: data.created_at, finishedAt: null, durationMs: null, message: null },
      { id: 'connector_handle',     order: 2, stage: PipelineStages.CONNECTOR,  status: isFailed ? 'failed'   : 'success', startedAt: null, finishedAt: null, durationMs: null, message: null },
      { id: 'payload_normalization',order: 3, stage: PipelineStages.NORMALIZER, status: isFailed ? 'skipped'  : 'success', startedAt: null, finishedAt: null, durationMs: null, message: null },
      { id: 'event_publishing',     order: 4, stage: PipelineStages.PUBLISHER,  status: isFailed ? 'skipped'  : 'success', startedAt: null, finishedAt: null, durationMs: null, message: null },
      { id: 'command_handling',     order: 5, stage: PipelineStages.HANDLER,    status: isFailed ? 'skipped'  : 'success', startedAt: null, finishedAt: null, durationMs: null, message: null },
      { id: 'movement_creation',    order: 6, stage: PipelineStages.MOVEMENT,   status: data.status === 'processed' ? 'success' : 'skipped', startedAt: null, finishedAt: null, durationMs: data.duration_ms ?? null, message: null },
    ]

    const p = data.payload as Record<string, unknown>

    return {
      id:            data.id,
      eventId:       data.event_id,
      origin:        data.origin as IntegrationOrigin,
      eventType:     data.event_type ?? 'unknown',
      status:        data.status as EventLogDTO['status'],
      amount:        typeof p?.valorLiquido === 'number' ? p.valorLiquido : null,
      durationMs:    data.duration_ms ?? null,
      attemptCount:  data.attempt_count ?? 1,
      lastAttemptAt: data.last_attempt_at ?? null,
      createdAt:     data.created_at,
      movementId:    data.movement_id ?? null,
      error:         data.error ?? null,
      payloads: {
        raw:        data.payload,
        normalized: data.normalized_payload ?? null,
      },
      steps,
      diagnostics: {
        connectorVersion: 1,
        schemaVersion:    1,
        replayed:         (data.attempt_count ?? 1) > 1,
        replayCount:      Math.max(0, (data.attempt_count ?? 1) - 1),
        totalDurationMs:  data.duration_ms ?? null,
      },
    }
  }

  // ─── Atividade ───────────────────────────────────────────────────────────────

  async getActivity(userId: string, limit = 10): Promise<ActivityItemDTO[]> {
    const { data } = await this.db
      .from('moneybridge_events')
      .select('id, origin, status, payload, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    return (data ?? []).map((row) => {
      return ActivityFormatter.format({
        id: row.id,
        origin: row.origin,
        status: row.status,
        payload: row.payload,
        created_at: row.created_at,
      })
    })
  }

  // ─── Health ──────────────────────────────────────────────────────────────────

  async getHealth(userId: string): Promise<HealthStatusDTO> {
    const checkedAt = new Date().toISOString()
    let dbStatus: HealthComponentDTO['status'] = 'ok'
    let lastEventAt: string | null = null
    let lastEventDurationMs: number | null = null

    try {
      const { data } = await this.db
        .from('moneybridge_events')
        .select('created_at, duration_ms')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      lastEventAt         = data?.created_at ?? null
      lastEventDurationMs = data?.duration_ms ?? null
    } catch {
      dbStatus = 'degraded'
    }

    const registrations = connectorRegistry.getAll()
    const connectorStatus: HealthComponentDTO['status'] =
      registrations.length > 0 ? 'ok' : 'degraded'

    const components: HealthComponentDTO[] = [
      { id: 'webhook',    label: 'Webhook',    status: 'ok',           critical: true,  version: null, latencyMs: null, message: null },
      { id: 'connector',  label: 'Connector',  status: connectorStatus, critical: true, version: '1',  latencyMs: null, message: registrations.length === 0 ? 'Nenhum conector registrado' : null },
      { id: 'normalizer', label: 'Normalizer', status: 'ok',           critical: true,  version: null, latencyMs: null, message: null },
      { id: 'publisher',  label: 'Publisher',  status: 'ok',           critical: true,  version: null, latencyMs: null, message: null },
      { id: 'database',   label: 'Banco',      status: dbStatus,       critical: true,  version: null, latencyMs: null, message: dbStatus === 'degraded' ? 'Falha ao consultar banco' : null },
    ]

    return { components, checkedAt, lastEventAt, lastEventDurationMs }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Cria uma instância do IntegrationService com o JWT do usuário.
 * Use nas Route Handlers de `/api/v1/...`.
 */
export function createIntegrationService(accessToken: string): IntegrationService {
  return new IntegrationService(makeAuthClient(accessToken))
}

'use server'

import { MemoryIntegrationRepository } from '@/repositories/integration.repository.memory'
import { MoneyBridgeOrchestrator } from '@/platform/integrations/orchestrator'
import { handlerRegistry } from '@/platform/integrations/handlers/registry'
import { LucroSimplesNormalizer, RawLucroSimplesSale } from '@/platform/integrations/connectors/lucro-simples.normalizer'
import { PlatformPublisher, InvalidPlatformEvent } from '@/platform/publisher'
import { PlatformEvent, NormalizedSale } from '@/platform/types'
import { NormalizationContext } from '@/platform/integrations/connectors/registry'
import { EventType } from '@/platform/integrations/event-types'
import { IntegrationMapping, SupabaseIntegrationRepository } from '@/repositories/integration.repository'
import { MemoryEventBus } from '@/platform/event-bus'
import { setMovementRepository, MemoryMovementRepository, SupabaseMovementRepository } from '@/repositories/movement.repository'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export interface SimulationStep {
  name: string
  status: 'success' | 'failed' | 'skipped'
  details: string
  data?: unknown
}

export interface SimulationResult {
  steps: SimulationStep[]
  eventLog?: unknown
  success: boolean
  error?: string
}

export interface SimulateOptions {
  userId: string
  eventId: string
  rawSale: RawLucroSimplesSale
  mode: 'memory' | 'supabase'
  mockMapping?: IntegrationMapping | null
  accessToken?: string
  scenario?: string
}

/**
 * Server Action — executa o pipeline completo do MoneyBridge.
 *
 * Modo 'memory': usa MemoryEventBus + MemoryIntegrationRepository + MemoryMovementRepository.
 * Modo 'supabase': usa MemoryEventBus + SupabaseIntegrationRepository + SupabaseMovementRepository (banco real, autenticado com JWT).
 *
 * Retorna o resultado detalhado de cada etapa para o Playground mostrar visualmente.
 */
export async function simulatePipeline(options: SimulateOptions): Promise<SimulationResult> {
  const steps: SimulationStep[] = []
  const { userId, eventId, rawSale, mode, mockMapping, accessToken, scenario } = options
  const isMemory = mode === 'memory'

  // Criar cliente Supabase autenticado para o servidor caso tenhamos o token
  let authClient = supabase
  if (!isMemory && accessToken) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    })
  }

  // 1. Configurar o repositório financeiro correto (Bypass do core do FinanceOS)
  if (isMemory) {
    setMovementRepository(new MemoryMovementRepository())
  } else {
    setMovementRepository(new SupabaseMovementRepository(authClient))
  }

  try {
    const eventOrigin = scenario === 'no_handler' ? 'plataforma_desconhecida' : 'lucro_simples'
    const eventType = (scenario === 'no_mapping' ? 'sale.refunded' : 'sale.closed') as EventType
    const eventIdReal = scenario === 'idempotency' ? 'test_idempotency_fixed_id' : eventId

    // ─── Etapa 1: Normalizer ────────────────────────────────────────────────
    let normalized: NormalizedSale
    try {
      const context: NormalizationContext = {
        userId,
        eventId: eventIdReal,
        correlationId: `trace_${Date.now()}`,
        eventType,
        connectorVersion: 1,
        replay: false
      }
      const eventResult = LucroSimplesNormalizer.normalize(rawSale, context)
      normalized = eventResult.payload as NormalizedSale
      steps.push({
        name: 'Normalizer',
        status: 'success',
        details: `Payload traduzido → NormalizedSale (BRL ${normalized.amount.toFixed(2)})`,
        data: normalized
      })
    } catch (err) {
      steps.push({
        name: 'Normalizer',
        status: 'failed',
        details: err instanceof Error ? err.message : String(err)
      })
      return { steps, success: false, error: 'Falha na normalização do payload' }
    }

    // ─── Etapa 2: Publisher (validação de schema) ────────────────────────────

    // Caso de Handler Inexistente ou Mapeamento Inexistente com tipo customizado:
    // Se for no_mapping, registramos um dummy handler para podermos passar o passo do Handler Registry
    // e falhar apenas no passo do Mapping (Orchestrator).
    if (scenario === 'no_mapping') {
      try {
        handlerRegistry.register('lucro_simples', 'sale.refunded', 1, {
          handle: async () => ({})
        })
      } catch {
        // Ignora se já estiver registrado
      }
    }

    const event: PlatformEvent<NormalizedSale> = {
      id: eventIdReal,
      type: eventType as any,
      version: 1,
      occurredAt: normalized.occurredAt,
      payload: normalized,
      metadata: {
        origin: eventOrigin as any,
        userId,
        requestId: `trace_${Date.now()}`,
        correlationId: `trace_${Date.now()}`,
        connectorVersion: 1,
        replay: false
      }
    }

    try {
      PlatformPublisher.validate(event)
      steps.push({
        name: 'Publisher',
        status: 'success',
        details: 'Schema validado: id, version, userId, correlationId, occurredAt, payload ✓',
        data: { id: event.id, type: event.type, origin: event.metadata.origin }
      })
    } catch (err) {
      const isSchema = err instanceof InvalidPlatformEvent
      steps.push({
        name: 'Publisher',
        status: 'failed',
        details: err instanceof Error ? err.message : String(err)
      })
      return {
        steps,
        success: false,
        error: isSchema ? 'Evento rejeitado: schema inválido' : 'Erro no Publisher'
      }
    }

    // Configura o repositório de integração do pipeline
    let integrationRepo
    if (isMemory) {
      // Se for no_mapping em modo memória, passamos mappings vazios
      const effectiveMockMappings = scenario === 'no_mapping'
        ? []
        : mockMapping
          ? [mockMapping]
          : [{
              id: 'mock-mapping-etapa1',
              userId,
              origin: 'lucro_simples',
              eventType: 'sale.closed',
              accountId: 'mock-account-00000000-0000-0000-0000-000000000001',
              categoryId: 'mock-category-00000000-0000-0000-0000-000000000002',
              priority: 0,
              enabled: true,
              createdAt: new Date().toISOString()
            }]
      integrationRepo = new MemoryIntegrationRepository(effectiveMockMappings)
    } else {
      integrationRepo = new SupabaseIntegrationRepository(authClient)
    }

    // Idempotency Check prévio (para mostrar de forma explícita na UI do Playground)
    const isAlreadyProcessed = await integrationRepo.isEventProcessed(event.metadata.origin, event.id)
    if (isAlreadyProcessed) {
      steps.push({
        name: 'EventBus',
        status: 'success',
        details: 'Subscriber registrado.'
      })
      steps.push({
        name: 'Orchestrator',
        status: 'success',
        details: `[Idempotência] Evento de origem "${event.metadata.origin}" com ID "${event.id}" já foi processado anteriormente. Nenhuma movimentação foi duplicada.`,
        data: { eventId: event.id, origin: event.metadata.origin }
      })
      steps.push({
        name: 'Registry',
        status: 'skipped',
        details: 'Execução pulada por idempotência'
      })
      return { steps, success: true }
    }

    // ─── Etapa 3: EventBus ───────────────────────────────────────────────────
    const memoryBus = new MemoryEventBus()
    const orchestrator = new MoneyBridgeOrchestrator(integrationRepo)

    let busDelivered = false
    memoryBus.subscribe('*', async (e: PlatformEvent<unknown>) => {
      busDelivered = true
      await orchestrator.process(e)
    })

    steps.push({
      name: 'EventBus',
      status: 'success',
      details: 'Subscriber registrado. Evento será entregue ao MoneyBridgeOrchestrator.'
    })

    // ─── Etapa 4: Publicar e aguardar processamento ──────────────────────────
    try {
      await memoryBus.publishAsync(event)
    } catch (err) {
      steps.push({
        name: 'Orchestrator',
        status: 'failed',
        details: err instanceof Error ? err.message : String(err)
      })
      return { steps, success: false, error: 'Erro ao publicar evento no bus' }
    }

    if (!busDelivered) {
      steps.push({
        name: 'Orchestrator',
        status: 'failed',
        details: 'Evento publicado mas nenhum subscriber recebeu.'
      })
      return { steps, success: false, error: 'EventBus sem subscribers' }
    }

    // ─── Etapa 5: Inspecionar resultado do Orchestrator ─────────────────────
    let eventLogStatus: 'processed' | 'failed' | 'processing' | undefined
    let durationMs = 0
    let errorMsg = ''
    let processedBy = ''
    let dbLogData: any = null

    if (isMemory) {
      const logs = (integrationRepo as MemoryIntegrationRepository).getEventLogs()
      const eventLog = logs.find(l => l.eventId === event.id)
      if (eventLog) {
        eventLogStatus = eventLog.status
        durationMs = eventLog.durationMs ?? 0
        errorMsg = eventLog.error ?? ''
        processedBy = eventLog.processedBy ?? ''
        dbLogData = eventLog
      }
    } else {
      // Modo Supabase: busca o registro inserido pelo Orchestrator na tabela real
      const { data } = await authClient
          .from('moneybridge_events')
          .select('*')
          .eq('origin', event.metadata.origin)
          .eq('event_id', event.id)
          .maybeSingle()

      if (data) {
        eventLogStatus = data.status
        durationMs = data.duration_ms ?? 0
        errorMsg = data.error ?? ''
        processedBy = data.processed_by ?? ''
        dbLogData = data
      }
    }

    if (!dbLogData) {
      steps.push({
        name: 'Orchestrator',
        status: 'failed',
        details: 'Log de evento não encontrado no repositório.'
      })
      return { steps, success: false, error: 'Orchestrator não registrou o evento' }
    }

    if (eventLogStatus === 'processed') {
      steps.push({
        name: 'Orchestrator',
        status: 'success',
        details: `Evento processado por: ${processedBy || 'handler'}. Duração: ${durationMs}ms`,
        data: dbLogData
      })

      // ─── Etapa 6: Registry ─────────────────────────────────────────────────
      const handler = handlerRegistry.get(event.metadata.origin, event.type, event.version)
      steps.push({
        name: 'Registry',
        status: handler ? 'success' : 'failed',
        details: handler
          ? `Handler resolvido: ${handler.constructor.name} para (${event.metadata.origin}, ${event.type}, v${event.version})`
          : `Nenhum handler registrado para (${event.metadata.origin}, ${event.type}, v${event.version})`
      })

      return { steps, success: true, eventLog: dbLogData }
    } else {
      steps.push({
        name: 'Orchestrator',
        status: 'failed',
        details: errorMsg || 'Falha desconhecida no Orchestrator'
      })
      return {
        steps,
        success: false,
        error: errorMsg || 'Pipeline falhou no Orchestrator',
        eventLog: dbLogData
      }
    }
  } finally {
    // Reverter sempre para a implementação Supabase em produção (Clean up)
    setMovementRepository(new SupabaseMovementRepository())
  }
}

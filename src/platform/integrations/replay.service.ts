import { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { connectorRegistry } from './connectors/registry'
import { SupabaseIntegrationRepository } from '@/repositories/integration.repository'

export class IntegrationReplayService {
  /**
   * Reprocessa um evento falho passando-o novamente pela porta de entrada oficial
   * do seu conector de origem, garantindo consistência total de pipeline.
   *
   * @param eventId ID do evento a ser reprocessado
   * @param client Cliente Supabase opcional para contexto de RLS
   */
  static async replay(eventId: string, client: SupabaseClient = supabase): Promise<void> {
    // 1. Buscar o log de auditoria original do evento no banco
    const { data: eventLog, error: queryErr } = await client
      .from('moneybridge_events')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle()

    if (queryErr) {
      throw new Error(`IntegrationReplayService: erro ao buscar log de evento no banco — "${queryErr.message}"`)
    }

    if (!eventLog) {
      throw new Error(`IntegrationReplayService: evento com ID "${eventId}" não localizado no sistema de auditoria.`)
    }

    // Instanciar repositório de integração local com o cliente injetado
    const integrationRepo = new SupabaseIntegrationRepository(client)

    // 2. Incrementar a tentativa e atualizar data no banco de dados (Auditoria)
    const newAttemptCount = (eventLog.attempt_count ?? 1) + 1
    const lastAttemptAt = new Date().toISOString()

    await integrationRepo.updateEventLog(eventLog.id, {
      attemptCount: newAttemptCount,
      lastAttemptAt,
      // Resetamos o erro anterior para indicar nova tentativa em andamento
      error: null
    })

    // 3. Obter o conector correspondente à origem via ConnectorRegistry (Desacoplado)
    const registration = connectorRegistry.get(eventLog.origin)
    if (!registration) {
      const errorMsg = `Nenhum conector registrado para a plataforma de origem "${eventLog.origin}"`
      await integrationRepo.updateEventLog(eventLog.id, {
        status: 'failed',
        error: errorMsg
      })
      throw new Error(`IntegrationReplayService: ${errorMsg}`)
    }

    // 4. Delegar o reprocessamento ao conector correspondente de forma genérica
    try {
      await registration.connector.handleStoredEvent({
        userId: eventLog.user_id,
        eventId: eventLog.event_id,
        eventType: eventLog.event_type,
        payload: eventLog.payload
      })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      // Se falhar de novo, o pipeline ou o orchestrator já atualizam o log como failed.
      // Caso ocorra uma falha antes do pipeline iniciar, atualizamos aqui para garantir robustez.
      await integrationRepo.updateEventLog(eventLog.id, {
        status: 'failed',
        error: errorMsg
      })
      throw err
    }
  }
}

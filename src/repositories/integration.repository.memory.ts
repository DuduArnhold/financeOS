import { IIntegrationRepository, IntegrationMapping, MoneybridgeEventLog } from './integration.repository'

/**
 * Implementação em memória do IIntegrationRepository.
 *
 * Usada na Etapa 1 (validação de infraestrutura sem banco) e em testes unitários.
 * O MoneyBridgeOrchestrator não sabe qual implementação está usando.
 */
export class MemoryIntegrationRepository implements IIntegrationRepository {
  private processedEventKeys = new Set<string>()
  private lockedEventKeys = new Set<string>()
  private eventLogs = new Map<string, MoneybridgeEventLog>()
  private mockMappings: IntegrationMapping[]

  constructor(mockMappings: IntegrationMapping[] = []) {
    this.mockMappings = mockMappings
  }

  async isEventProcessed(origin: string, eventId: string): Promise<boolean> {
    return this.processedEventKeys.has(`${origin}:${eventId}`)
  }

  async insertEventLog(log: Omit<MoneybridgeEventLog, 'id' | 'createdAt'>): Promise<MoneybridgeEventLog> {
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const record: MoneybridgeEventLog = {
      ...log,
      id,
      createdAt: new Date().toISOString()
    }
    this.eventLogs.set(id, record)
    return record
  }

  async updateEventLog(id: string, updates: Partial<MoneybridgeEventLog>): Promise<void> {
    const existing = this.eventLogs.get(id)
    if (!existing) return

    const updated = { ...existing, ...updates }
    this.eventLogs.set(id, updated)

    // Libera o lock se o processamento finalizou
    if (updates.status === 'processed' || updates.status === 'failed') {
      this.lockedEventKeys.delete(id)
    }

    // Marcar como processado para garantir idempotência nas próximas verificações
    if (updates.status === 'processed') {
      this.processedEventKeys.add(`${existing.origin}:${existing.eventId}`)
    }
  }

  async findMappings(userId: string, origin: string, eventType: string): Promise<IntegrationMapping[]> {
    return this.mockMappings.filter(
      m => m.userId === userId && m.origin === origin && m.eventType === eventType && m.enabled
    )
  }

  async findEventLog(origin: string, eventId: string): Promise<MoneybridgeEventLog | null> {
    for (const log of this.eventLogs.values()) {
      if (log.origin === origin && log.eventId === eventId) {
        return log
      }
    }
    return null
  }

  async findFailedEventsForRetry(options: { maxAttempts: number; limit: number }): Promise<MoneybridgeEventLog[]> {
    const now = new Date()
    const eligible = Array.from(this.eventLogs.values())
      .filter(log => {
        if (log.status !== 'failed') return false
        const attempts = log.attemptCount ?? 1
        if (attempts >= options.maxAttempts) return false
        if (!log.nextRetryAt) return false

        // Simular SKIP LOCKED
        if (this.lockedEventKeys.has(log.id)) return false

        const nextRetryDate = new Date(log.nextRetryAt)
        return nextRetryDate <= now
      })
      .sort((a, b) => new Date(a.nextRetryAt!).getTime() - new Date(b.nextRetryAt!).getTime())
      .slice(0, options.limit)

    for (const log of eligible) {
      this.lockedEventKeys.add(log.id)
    }

    return eligible
  }

  // ─── Inspeção para testes ─────────────────────────────────────────────────

  /** Retorna todos os logs em memória (para inspeção nos testes). */
  getEventLogs(): MoneybridgeEventLog[] {
    return Array.from(this.eventLogs.values())
  }

  /** Retorna os logs por status. */
  getLogsByStatus(status: MoneybridgeEventLog['status']): MoneybridgeEventLog[] {
    return this.getEventLogs().filter(l => l.status === status)
  }

  /** Libera um lock manualmente (útil para testes unitários de concorrência) */
  unlock(id: string): void {
    this.lockedEventKeys.delete(id)
  }

  /** Reseta o estado interno (útil entre cenários de teste). */
  reset(): void {
    this.processedEventKeys.clear()
    this.lockedEventKeys.clear()
    this.eventLogs.clear()
  }
}

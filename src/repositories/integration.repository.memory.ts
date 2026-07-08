import { IIntegrationRepository, IntegrationMapping, MoneybridgeEventLog } from './integration.repository'

/**
 * Implementação em memória do IIntegrationRepository.
 *
 * Usada na Etapa 1 (validação de infraestrutura sem banco) e em testes unitários.
 * O MoneyBridgeOrchestrator não sabe qual implementação está usando.
 */
export class MemoryIntegrationRepository implements IIntegrationRepository {
  private processedEventKeys = new Set<string>()
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

  // ─── Inspeção para testes ─────────────────────────────────────────────────

  /** Retorna todos os logs em memória (para inspeção nos testes). */
  getEventLogs(): MoneybridgeEventLog[] {
    return Array.from(this.eventLogs.values())
  }

  /** Retorna os logs por status. */
  getLogsByStatus(status: MoneybridgeEventLog['status']): MoneybridgeEventLog[] {
    return this.getEventLogs().filter(l => l.status === status)
  }

  /** Reseta o estado interno (útil entre cenários de teste). */
  reset(): void {
    this.processedEventKeys.clear()
    this.eventLogs.clear()
  }
}

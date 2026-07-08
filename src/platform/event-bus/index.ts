import { PlatformEvent } from '../types'

export type EventCallback = (event: PlatformEvent<unknown>) => void | Promise<void>

export interface IEventBus {
  publish(event: PlatformEvent<unknown>): void
  publishAsync(event: PlatformEvent<unknown>): Promise<void>
  subscribe(pattern: string, callback: EventCallback): () => void
}

/**
 * Implementação em memória do Barramento de Eventos.
 * Exportada como classe para permitir instâncias isoladas nos testes (Etapa 1).
 */
export class MemoryEventBus implements IEventBus {
  private listeners = new Map<string, Set<EventCallback>>()

  /**
   * Publica de forma síncrona (fire-and-forget).
   * Erros em subscribers individuais são logados mas não propagam.
   */
  publish(event: PlatformEvent<unknown>): void {
    this.notifyListeners(event.type, event)
    this.notifyListeners('*', event)
  }

  /**
   * Publica e aguarda a resolução de todos os subscribers (await).
   * Usado na Server Action para garantir que o Orchestrator terminou antes de retornar.
   */
  async publishAsync(event: PlatformEvent<unknown>): Promise<void> {
    await this.notifyListenersAsync(event.type, event)
    await this.notifyListenersAsync('*', event)
  }

  subscribe(pattern: string, callback: EventCallback): () => void {
    if (!this.listeners.has(pattern)) {
      this.listeners.set(pattern, new Set())
    }
    this.listeners.get(pattern)!.add(callback)

    return () => {
      const set = this.listeners.get(pattern)
      if (set) {
        set.delete(callback)
        if (set.size === 0) this.listeners.delete(pattern)
      }
    }
  }

  private notifyListeners(pattern: string, event: PlatformEvent<unknown>): void {
    const listeners = this.listeners.get(pattern)
    if (!listeners) return
    listeners.forEach(cb => {
      try { cb(event) } catch (err) {
        console.error(`MemoryEventBus: error in subscriber for "${pattern}"`, err)
      }
    })
  }

  private async notifyListenersAsync(pattern: string, event: PlatformEvent<unknown>): Promise<void> {
    const listeners = this.listeners.get(pattern)
    if (!listeners) return
    for (const cb of listeners) {
      try { await cb(event) } catch (err) {
        console.error(`MemoryEventBus: error in async subscriber for "${pattern}"`, err)
      }
    }
  }
}

// Singleton global usado pelo bootstrap de produção
export const eventBus: IEventBus = new MemoryEventBus()

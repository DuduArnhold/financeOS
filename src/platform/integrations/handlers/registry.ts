import { PlatformEvent } from '../../types'
import { IntegrationMapping } from '@/repositories/integration.repository'
import { EventType } from '../event-types'

export interface IntegrationHandler<T = unknown, R = unknown> {
  handle(event: PlatformEvent<T>, mapping: IntegrationMapping): Promise<R>;
}

class HandlerRegistry {
  private handlers = new Map<string, IntegrationHandler>()

  private buildKey(origin: string, type: EventType, version: number): string {
    return `${origin.toLowerCase()}:${type.toLowerCase()}:${version}`
  }

  register(origin: string, type: EventType, version: number, handler: IntegrationHandler): void {
    const key = this.buildKey(origin, type, version)
    if (this.handlers.has(key)) {
      console.warn(`HandlerRegistry: overriding handler for key "${key}"`)
    }
    this.handlers.set(key, handler)
  }

  get(origin: string, type: EventType, version: number): IntegrationHandler | undefined {
    const key = this.buildKey(origin, type, version)
    return this.handlers.get(key)
  }
}

export const handlerRegistry = new HandlerRegistry()

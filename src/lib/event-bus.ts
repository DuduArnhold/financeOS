// Platform Event Bus
// Type-safe event pub/sub broker to allow loose coupling between different JA Platform modules.

import { logger } from './logger'

export interface BaseEventPayload {
  eventId: string
  version: number
  userId: string
}

export type PlatformEventMap = {
  'USER_SIGNUP':        BaseEventPayload & { email: string; nome: string }
  'USER_LOGIN':         BaseEventPayload & { timestamp: string }
  'MOVEMENT_CREATED':   BaseEventPayload & { id: string; tipo: 'receita' | 'despesa'; valor: number }
  'MOVEMENT_DELETED':   BaseEventPayload & { id: string }
  'BILL_PAID':          BaseEventPayload & { id: string; valor: number }
  'BILL_UNPAID':        BaseEventPayload & { id: string }
  'GOAL_DEPOSIT':       BaseEventPayload & { metaId: string; valor: number }
}

export type PlatformEventName = keyof PlatformEventMap

type SubscriptionCallback<T extends PlatformEventName> = (payload: PlatformEventMap[T]) => void

class EventBus {
  private subscribers: Map<string, Set<(payload: never) => void>> = new Map()

  subscribe<T extends PlatformEventName>(event: T, callback: SubscriptionCallback<T>): () => void {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set())
    }
    
    this.subscribers.get(event)!.add(callback as unknown as (payload: never) => void)
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(event)
      if (callbacks) {
        callbacks.delete(callback as unknown as (payload: never) => void)
        if (callbacks.size === 0) {
          this.subscribers.delete(event)
        }
      }
    }
  }

  publish<T extends PlatformEventName>(event: T, payload: PlatformEventMap[T]): void {
    logger.debug(`EventBus: publishing "${event}"`, {
      eventId: payload.eventId,
      version: payload.version,
      userId: payload.userId
    })
    
    const callbacks = this.subscribers.get(event)
    if (!callbacks) return

    callbacks.forEach(callback => {
      try {
        const cb = callback as unknown as SubscriptionCallback<T>
        cb(payload)
      } catch (err) {
        logger.error(`EventBus: error executing subscriber for "${event}":`, {
          userId: payload.userId,
          module: 'EventBus',
          error: err
        })
      }
    })
  }
}

export const eventBus = new EventBus()
export default eventBus

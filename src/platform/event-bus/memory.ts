// Re-exporta MemoryEventBus do index para que imports de '@/platform/event-bus/memory'
// funcionem sem duplicar a implementação.
export { MemoryEventBus } from './index'

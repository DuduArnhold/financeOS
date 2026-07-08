import { handlerRegistry } from './integrations/handlers/registry'
import { SaleClosedHandler } from './integrations/handlers/sales/sale-closed.handler'
import { SaleCancelledHandler } from './integrations/handlers/sales/sale-cancelled.handler'
import { SaleRefundedHandler } from './integrations/handlers/sales/sale-refunded.handler'
import { PurchaseCreatedHandler } from './integrations/handlers/purchases/purchase-created.handler'
import { PurchasePaidHandler } from './integrations/handlers/purchases/purchase-paid.handler'
import { EventTypes } from './integrations/event-types'
import { commandBus } from './command-bus'
import { CreateMovementCommandHandler } from './finance/command-handlers/create-movement.handler'
import { eventBus } from './event-bus'
import { MoneyBridgeOrchestrator, setMoneyBridgeOrchestrator } from './integrations/orchestrator'
import { supabaseIntegrationRepository } from '@/repositories/integration.repository'
import { logger } from '@/lib/logger'
import { connectorRegistry } from './integrations/connectors/registry'
import { lucroSimplesConnector } from './integrations/connectors/lucro-simples.connector'
import { IntegrationOrigins } from './integrations/origins'

let initialized = false

/**
 * Registra os Handlers de eventos no Registry (fail-fast: lança se qualquer handler falhar).
 * Etapa 6 — Bootstrap: se um handler não registrar, a aplicação não deve subir.
 */
function registerHandlers() {
  handlerRegistry.register('lucro_simples', EventTypes.SALE_CLOSED, 1, new SaleClosedHandler())
  handlerRegistry.register('lucro_simples', EventTypes.SALE_CANCELLED, 1, new SaleCancelledHandler())
  handlerRegistry.register('lucro_simples', EventTypes.SALE_REFUNDED, 1, new SaleRefundedHandler())
  handlerRegistry.register('lucro_simples', EventTypes.PURCHASE_CREATED, 1, new PurchaseCreatedHandler())
  handlerRegistry.register('lucro_simples', EventTypes.PURCHASE_PAID, 1, new PurchasePaidHandler())
  logger.info('PlatformBootstrap: event handlers registered')
}

/**
 * Registra os Handlers de comandos no CommandBus (fail-fast).
 */
function registerCommands() {
  commandBus.register('CreateMovementCommand', new CreateMovementCommandHandler())
  logger.info('PlatformBootstrap: command handlers registered')
}

/**
 * Registra os conectores externos suportados pelo ecossistema de integração.
 */
function registerConnectors() {
  connectorRegistry.register({
    origin:            IntegrationOrigins.LUCRO_SIMPLES,
    connector:         lucroSimplesConnector,
    capabilities:      lucroSimplesConnector.capabilities,
    version:           1,
    name:              'Lucro Simples',
    icon:              'plug',
    supportsReplay:    true,
    supportsMappings:  true,
    supportsApiKey:    true,
    enabled:           true,
  })
  logger.info('PlatformBootstrap: integration connectors registered')
}

/**
 * Cria o singleton de produção do MoneyBridgeOrchestrator com SupabaseIntegrationRepository
 * e conecta ao barramento global de eventos.
 */
function subscribeEvents() {
  const orchestrator = new MoneyBridgeOrchestrator(supabaseIntegrationRepository)
  setMoneyBridgeOrchestrator(orchestrator)

  eventBus.subscribe('*', async (event) => {
    logger.info('PlatformBootstrap: event received on global bus', { type: event.type })
    await orchestrator.process(event)
  })
  logger.info('PlatformBootstrap: MoneyBridgeOrchestrator subscribed to eventBus')
}

/**
 * Inicialização síncrona protegida contra execuções duplicadas de HMR/Fast Refresh.
 * Fail-fast: qualquer erro aqui impede a aplicação de subir.
 */
export function bootstrapPlatform() {
  if (initialized) return
  initialized = true

  logger.info('PlatformBootstrap: starting platform initialization...')

  try {
    registerHandlers()
    registerCommands()
    registerConnectors()
    subscribeEvents()

    logger.info('PlatformBootstrap: platform successfully initialized!')
  } catch (err) {
    logger.error('PlatformBootstrap: critical initialization failure', { error: err })
    throw err
  }
}

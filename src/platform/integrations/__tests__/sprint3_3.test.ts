import { test, describe, before } from 'node:test'
import assert from 'node:assert'
import { bootstrapPlatform } from '../../bootstrap'
import { MoneyBridgeOrchestrator } from '../orchestrator'
import { MemoryIntegrationRepository } from '@/repositories/integration.repository.memory'
import { MemoryMovementRepository, setMovementRepository } from '@/repositories/movement.repository'
import { MemoryContaRepository, setContaRepository } from '@/repositories/conta.repository'
import { EventTypes } from '../event-types'
import { PlatformEvent } from '../../types'

describe('Sprint 3.3 - Novos Eventos e Sincronização', () => {
  let orchestrator: MoneyBridgeOrchestrator
  let integrationRepo: MemoryIntegrationRepository
  let movementRepo: MemoryMovementRepository
  let contaRepo: MemoryContaRepository

  const mockMappings = [
    {
      id: 'map_1',
      userId: 'user_123',
      origin: 'lucro_simples',
      eventType: EventTypes.SALE_CLOSED,
      accountId: 'acc_wallet',
      categoryId: 'cat_revenue',
      priority: 1,
      enabled: true,
      conditions: [],
      createdAt: new Date().toISOString()
    },
    {
      id: 'map_2',
      userId: 'user_123',
      origin: 'lucro_simples',
      eventType: EventTypes.SALE_CANCELLED,
      accountId: 'acc_wallet',
      categoryId: 'cat_revenue',
      priority: 1,
      enabled: true,
      conditions: [],
      createdAt: new Date().toISOString()
    },
    {
      id: 'map_3',
      userId: 'user_123',
      origin: 'lucro_simples',
      eventType: EventTypes.SALE_REFUNDED,
      accountId: 'acc_wallet',
      categoryId: 'cat_expense',
      priority: 1,
      enabled: true,
      conditions: [],
      createdAt: new Date().toISOString()
    },
    {
      id: 'map_4',
      userId: 'user_123',
      origin: 'lucro_simples',
      eventType: EventTypes.PURCHASE_CREATED,
      accountId: 'acc_wallet',
      categoryId: 'cat_expense',
      priority: 1,
      enabled: true,
      conditions: [],
      createdAt: new Date().toISOString()
    },
    {
      id: 'map_5',
      userId: 'user_123',
      origin: 'lucro_simples',
      eventType: EventTypes.PURCHASE_PAID,
      accountId: 'acc_wallet',
      categoryId: 'cat_expense',
      priority: 1,
      enabled: true,
      conditions: [],
      createdAt: new Date().toISOString()
    }
  ]

  before(() => {
    // Inicializar os handlers do barramento
    bootstrapPlatform()

    // Configurar repositórios em memória para isolar do Supabase real
    integrationRepo = new MemoryIntegrationRepository(mockMappings)
    movementRepo = new MemoryMovementRepository()
    contaRepo = new MemoryContaRepository()

    setMovementRepository(movementRepo)
    setContaRepository(contaRepo)

    orchestrator = new MoneyBridgeOrchestrator(integrationRepo)
  })

  test('Deve processar venda fechada (sale.closed) e criar movimentação de receita', async () => {
    const event: PlatformEvent<any> = {
      id: 'evt_sale_101',
      version: 1,
      schemaVersion: 1,
      type: EventTypes.SALE_CLOSED,
      origin: 'lucro_simples',
      occurredAt: new Date().toISOString(),
      payload: {
        occurredAt: new Date().toISOString(),
        amount: 250.00,
        currency: 'BRL',
        description: 'Venda de Teste Lucro Simples',
        tags: ['test'],
        vendaId: 'sale_101'
      },
      metadata: {
        tenantId: 'user_123',
        traceId: 'trace_101'
      }
    }

    await orchestrator.process(event)

    const movements = await movementRepo.getAll('user_123')
    assert.strictEqual(movements.length, 1)
    assert.strictEqual(movements[0].tipo, 'receita')
    assert.strictEqual(movements[0].valor, 250.00)
    assert.strictEqual(movements[0].origemRef, 'sale_101')
  })

  test('Deve processar cancelamento (sale.cancelled) e marcar como removido (soft delete)', async () => {
    const cancelEvent: PlatformEvent<any> = {
      id: 'evt_cancel_102',
      version: 1,
      schemaVersion: 1,
      type: EventTypes.SALE_CANCELLED,
      origin: 'lucro_simples',
      occurredAt: new Date().toISOString(),
      payload: {
        occurredAt: new Date().toISOString(),
        amount: 250.00,
        currency: 'BRL',
        description: 'Venda Cancelada',
        tags: ['test'],
        vendaId: 'sale_101' // ID da venda anterior
      },
      metadata: {
        tenantId: 'user_123',
        traceId: 'trace_102'
      }
    }

    await orchestrator.process(cancelEvent)

    const movements = await movementRepo.getAll('user_123')
    assert.strictEqual(movements.length, 0) // getAll filtra os soft-deleted
  })

  test('Deve processar reembolso (sale.refunded) criando uma despesa vinculada', async () => {
    const refundEvent: PlatformEvent<any> = {
      id: 'evt_refund_103',
      version: 1,
      schemaVersion: 1,
      type: EventTypes.SALE_REFUNDED,
      origin: 'lucro_simples',
      occurredAt: new Date().toISOString(),
      payload: {
        occurredAt: new Date().toISOString(),
        amount: 100.00,
        currency: 'BRL',
        description: 'Reembolso Parcial',
        tags: ['test'],
        vendaId: 'sale_101'
      },
      metadata: {
        tenantId: 'user_123',
        traceId: 'trace_103'
      }
    }

    await orchestrator.process(refundEvent)

    const allMovs = (movementRepo as any).movements
    const refundMov = allMovs.find((m: any) => m.tipo === 'despesa')
    assert.ok(refundMov)
    assert.strictEqual(refundMov.valor, 100.00)
    assert.strictEqual(refundMov.origemRef, 'sale_101')
  })

  test('Deve criar uma compra pendente (purchase.created) e depois efetuar a baixa (purchase.paid)', async () => {
    // 1. Criar a compra
    const createEvent: PlatformEvent<any> = {
      id: 'evt_pur_create_201',
      version: 1,
      schemaVersion: 1,
      type: EventTypes.PURCHASE_CREATED,
      origin: 'lucro_simples',
      occurredAt: new Date().toISOString(),
      payload: {
        occurredAt: new Date().toISOString(),
        amount: 450.00,
        currency: 'BRL',
        description: 'Fornecedor de Papelaria',
        tags: ['test'],
        compraId: 'purchase_201'
      },
      metadata: {
        tenantId: 'user_123',
        traceId: 'trace_201'
      }
    }

    await orchestrator.process(createEvent)

    const contas = await contaRepo.getAll('user_123')
    assert.strictEqual(contas.length, 1)
    assert.strictEqual(contas[0].paga, false)
    assert.strictEqual(contas[0].valor, 450.00)
    assert.ok(contas[0].nome.includes('[Ref: purchase_201]'))

    // 2. Dar baixa na compra
    const payEvent: PlatformEvent<any> = {
      id: 'evt_pur_pay_202',
      version: 1,
      schemaVersion: 1,
      type: EventTypes.PURCHASE_PAID,
      origin: 'lucro_simples',
      occurredAt: new Date().toISOString(),
      payload: {
        occurredAt: new Date().toISOString(),
        amount: 450.00,
        currency: 'BRL',
        description: 'Fornecedor de Papelaria',
        tags: ['test'],
        compraId: 'purchase_201'
      },
      metadata: {
        tenantId: 'user_123',
        traceId: 'trace_202'
      }
    }

    await orchestrator.process(payEvent)

    const contasPosPagamento = await contaRepo.getAll('user_123')
    assert.strictEqual(contasPosPagamento[0].paga, true)
  })

  test('Idempotência: Processar o mesmo evento duas vezes deve ignorar o segundo', async () => {
    const event: PlatformEvent<any> = {
      id: 'evt_idempotent_999',
      version: 1,
      schemaVersion: 1,
      type: EventTypes.SALE_CLOSED,
      origin: 'lucro_simples',
      occurredAt: new Date().toISOString(),
      payload: {
        occurredAt: new Date().toISOString(),
        amount: 15.00,
        currency: 'BRL',
        description: 'Venda Única',
        tags: ['test']
      },
      metadata: {
        tenantId: 'user_123',
        traceId: 'trace_999'
      }
    }

    // Primeira execução
    await orchestrator.process(event)

    const allMovsBefore = (movementRepo as any).movements.length

    // Segunda execução (duplicada)
    await orchestrator.process(event)

    const allMovsAfter = (movementRepo as any).movements.length
    assert.strictEqual(allMovsAfter, allMovsBefore) // Deduplicado no orchestrator
  })
})

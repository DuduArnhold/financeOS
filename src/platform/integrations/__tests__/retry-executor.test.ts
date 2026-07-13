import { test, describe, before, beforeEach } from 'node:test'
import assert from 'node:assert'
import { bootstrapPlatform } from '../../bootstrap'
import { MoneyBridgeOrchestrator, setMoneyBridgeOrchestrator } from '../orchestrator'
import { RetryExecutor } from '../retry-executor'
import { MemoryIntegrationRepository } from '@/repositories/integration.repository.memory'
import { MemoryMovementRepository, setMovementRepository } from '@/repositories/movement.repository'
import { MemoryContaRepository, setContaRepository } from '@/repositories/conta.repository'
import { EventTypes } from '../event-types'
import { PlatformEvent } from '../../types'
import { connectorRegistry } from '../connectors/registry'
import { LucroSimplesConnector } from '../connectors/lucro-simples.connector'

describe('RetryExecutor - Resiliência e Concorrência', () => {
  let orchestrator: MoneyBridgeOrchestrator
  let integrationRepo: MemoryIntegrationRepository
  let movementRepo: MemoryMovementRepository
  let contaRepo: MemoryContaRepository
  let retryExecutor: RetryExecutor

  const mockMappings = [
    {
      id: 'map_sale_retry',
      userId: 'user_retry_123',
      origin: 'lucro_simples',
      eventType: EventTypes.SALE_CLOSED,
      accountId: 'acc_wallet',
      categoryId: 'cat_revenue',
      priority: 1,
      enabled: true,
      conditions: [],
      createdAt: new Date().toISOString()
    }
  ]

  before(() => {
    bootstrapPlatform()
  })

  beforeEach(() => {
    // Configurar repositórios limpos antes de cada teste
    integrationRepo = new MemoryIntegrationRepository(mockMappings)
    movementRepo = new MemoryMovementRepository()
    contaRepo = new MemoryContaRepository()

    setMovementRepository(movementRepo)
    setContaRepository(contaRepo)

    orchestrator = new MoneyBridgeOrchestrator(integrationRepo)
    setMoneyBridgeOrchestrator(orchestrator)

    // Re-registrar o conector no barramento central usando o orchestrator de testes
    connectorRegistry.register({
      origin: 'lucro_simples',
      connector: new LucroSimplesConnector(orchestrator),
      capabilities: [
        { eventType: 'sale.closed',      version: 1, enabled: true, replayable: true, idempotent: true },
        { eventType: 'sale.cancelled',   version: 1, enabled: true, replayable: true, idempotent: true },
        { eventType: 'sale.refunded',    version: 1, enabled: true, replayable: true, idempotent: true },
        { eventType: 'purchase.created', version: 1, enabled: true, replayable: true, idempotent: true },
        { eventType: 'purchase.paid',    version: 1, enabled: true, replayable: true, idempotent: true }
      ],
      version: 1,
      name: 'Lucro Simples (Teste)',
      icon: 'plug',
      supportsReplay: true,
      supportsMappings: true,
      supportsApiKey: true,
      enabled: true
    })

    // RetryExecutor configurado com maxAttempts = 3
    retryExecutor = new RetryExecutor(integrationRepo, 3)
  })

  test('Deve reprocessar evento falho sem causar erro de Unique Constraint no banco', async () => {
    const rawPayload = {
      vendaId: 'sale_retry_101',
      valorLiquido: 150.00,
      dataFechamento: '2026-07-13',
      descricao: 'Venda de Teste com Falha Inicial'
    }

    // 1. Criar o log de evento falho inicial manualmente no repositório (para simular uma falha persistida)
    const initialLog = await integrationRepo.insertEventLog({
      userId: 'user_retry_123',
      origin: 'lucro_simples',
      eventId: 'evt_retry_101',
      eventType: EventTypes.SALE_CLOSED,
      status: 'failed',
      payload: rawPayload,
      attemptCount: 1,
      lastAttemptAt: new Date(Date.now() - 10000).toISOString(),
      error: 'Conexão com gateway falhou'
    })

    // 2. Tentar processar o mesmo evento pelo Orchestrator diretamente (como se fosse um replay ou retry síncrono)
    const event: PlatformEvent<any> = {
      id: 'evt_retry_101',
      type: EventTypes.SALE_CLOSED,
      version: 1,
      occurredAt: new Date().toISOString(),
      payload: {
        occurredAt: new Date().toISOString(),
        amount: 150.00,
        currency: 'BRL',
        description: 'Venda de Teste com Falha Inicial',
        tags: ['test'],
        vendaId: 'sale_retry_101'
      },
      metadata: {
        origin: 'lucro_simples',
        userId: 'user_retry_123',
        requestId: 'req_retry_1',
        correlationId: 'corr_retry_1',
        connectorVersion: 1,
        replay: false
      }
    }

    // A chamada abaixo falharia por Unique Key se o Orchestrator não usasse findEventLog.
    // Agora ela deve atualizar o log existente para processed e criar a movimentação de receita.
    await orchestrator.process(event)

    const logs = integrationRepo.getEventLogs()
    assert.strictEqual(logs.length, 1, 'Não deve criar múltiplos registros de logs de evento para o mesmo eventId')
    assert.strictEqual(logs[0].status, 'processed', 'O status do log existente deve ser atualizado para processed')
    assert.strictEqual(logs[0].attemptCount, 2, 'O attemptCount deve ter sido incrementado de 1 para 2')
    assert.ok(logs[0].processingStartedAt, 'processingStartedAt deve ser preenchido')
    assert.ok(logs[0].firstAttemptAt, 'firstAttemptAt deve ser preenchido')

    const movements = await movementRepo.getAll('user_retry_123')
    assert.strictEqual(movements.length, 1)
    assert.strictEqual(movements[0].valor, 150.00)
    assert.strictEqual(movements[0].origemRef, 'sale_retry_101')
  })

  test('Deve processar apenas eventos falhos cujos tempos de retry (nextRetryAt) estejam no passado', async () => {
    const rawPayload = {
      vendaId: 'sale_retry_202',
      valorLiquido: 50.00,
      dataFechamento: '2026-07-13',
      descricao: 'Venda elegível'
    }

    // Evento A: elegível para retry (nextRetryAt está no passado)
    await integrationRepo.insertEventLog({
      userId: 'user_retry_123',
      origin: 'lucro_simples',
      eventId: 'evt_retry_elig_A',
      eventType: EventTypes.SALE_CLOSED,
      status: 'failed',
      payload: rawPayload,
      attemptCount: 1,
      lastAttemptAt: new Date(Date.now() - 60000).toISOString(),
      nextRetryAt: new Date(Date.now() - 1000).toISOString(), // no passado
      error: 'Erro temporário'
    })

    // Evento B: não elegível para retry (nextRetryAt está no futuro)
    await integrationRepo.insertEventLog({
      userId: 'user_retry_123',
      origin: 'lucro_simples',
      eventId: 'evt_retry_elig_B',
      eventType: EventTypes.SALE_CLOSED,
      status: 'failed',
      payload: rawPayload,
      attemptCount: 1,
      lastAttemptAt: new Date(Date.now() - 5000).toISOString(),
      nextRetryAt: new Date(Date.now() + 60000).toISOString(), // no futuro
      error: 'Erro temporário'
    })

    // Executar a varredura do RetryExecutor
    const stats = await retryExecutor.scan({ limit: 10 })

    assert.strictEqual(stats.processed, 1, 'Deve processar exatamente 1 evento')
    assert.strictEqual(stats.failed, 0, 'Nenhum erro de processamento esperado')

    const logA = await integrationRepo.findEventLog('lucro_simples', 'evt_retry_elig_A')
    const logB = await integrationRepo.findEventLog('lucro_simples', 'evt_retry_elig_B')

    assert.strictEqual(logA?.status, 'processed', 'O evento A elegível deve ter sido processado')
    assert.strictEqual(logB?.status, 'failed', 'O evento B no futuro deve ter sido ignorado e mantido como failed')
  })

  test('Deve desconsiderar eventos que atingiram o limite máximo de tentativas (maxAttempts)', async () => {
    const rawPayload = {
      vendaId: 'sale_retry_303',
      valorLiquido: 99.00,
      dataFechamento: '2026-07-13',
      descricao: 'Venda limite máximo'
    }

    // Evento com tentativa 3 de 3 (maxAttempts = 3)
    await integrationRepo.insertEventLog({
      userId: 'user_retry_123',
      origin: 'lucro_simples',
      eventId: 'evt_retry_max_out',
      eventType: EventTypes.SALE_CLOSED,
      status: 'failed',
      payload: rawPayload,
      attemptCount: 3,
      lastAttemptAt: new Date(Date.now() - 60000).toISOString(),
      nextRetryAt: new Date(Date.now() - 1000).toISOString(),
      error: 'Erro catastrófico'
    })

    const stats = await retryExecutor.scan({ limit: 10 })

    assert.strictEqual(stats.processed, 0, 'Nenhum evento deve ser processado')
    assert.strictEqual(stats.failed, 0)

    const log = await integrationRepo.findEventLog('lucro_simples', 'evt_retry_max_out')
    assert.strictEqual(log?.status, 'failed')
    assert.strictEqual(log?.attemptCount, 3, 'O contador de tentativas não deve ter sido incrementado')
  })

  test('Concorrência: Múltiplos Scans não podem processar o mesmo evento falho simultaneamente (SKIP LOCKED)', async () => {
    const rawPayload = {
      vendaId: 'sale_retry_404',
      valorLiquido: 10.00,
      dataFechamento: '2026-07-13',
      descricao: 'Venda concorrência'
    }

    await integrationRepo.insertEventLog({
      userId: 'user_retry_123',
      origin: 'lucro_simples',
      eventId: 'evt_retry_concurr',
      eventType: EventTypes.SALE_CLOSED,
      status: 'failed',
      payload: rawPayload,
      attemptCount: 1,
      lastAttemptAt: new Date(Date.now() - 60000).toISOString(),
      nextRetryAt: new Date(Date.now() - 1000).toISOString()
    })

    // 1. Primeiro scan busca e adquire o lock na linha (simulado no MemoryRepository via lockedEventKeys)
    const scan1Promise = retryExecutor.scan({ limit: 1 })

    // 2. Um segundo scan disparado instantaneamente em paralelo não deve encontrar nada
    // porque a linha está trancada por scan1
    const stats2 = await retryExecutor.scan({ limit: 1 })
    assert.strictEqual(stats2.processed, 0, 'O segundo scanner deve pular registros trancados (skip locked)')

    // Esperar primeiro scan terminar
    const stats1 = await scan1Promise
    assert.strictEqual(stats1.processed, 1, 'O primeiro scanner deve processar com sucesso')

    const log = await integrationRepo.findEventLog('lucro_simples', 'evt_retry_concurr')
    assert.strictEqual(log?.status, 'processed')
  })

  test('Resiliência após reinicialização (restart do servidor): scans subsequentes recuperam a execução de onde pararam', async () => {
    const rawPayload = {
      vendaId: 'sale_retry_505',
      valorLiquido: 80.00,
      dataFechamento: '2026-07-13',
      descricao: 'Venda reboot'
    }

    // 1. Simular log de evento falho
    const eventLog = await integrationRepo.insertEventLog({
      userId: 'user_retry_123',
      origin: 'lucro_simples',
      eventId: 'evt_retry_reboot',
      eventType: EventTypes.SALE_CLOSED,
      status: 'failed',
      payload: rawPayload,
      attemptCount: 1,
      lastAttemptAt: new Date(Date.now() - 60000).toISOString(),
      nextRetryAt: new Date(Date.now() - 1000).toISOString()
    })

    // 2. Simular que o servidor reinicia e o lock em memória é apagado (reset de locks)
    // O lock persistiria se fosse banco de dados conectado, mas num reboot os locks são liberados.
    // Em memória, apenas chamamos unlock() ou criamos um novo Executor/Repositório mantendo os dados
    integrationRepo.unlock(eventLog.id)

    // 3. Uma nova varredura do RetryExecutor deve continuar processando o evento normalmente
    const nextRetryExecutor = new RetryExecutor(integrationRepo, 3)
    const stats = await nextRetryExecutor.scan({ limit: 1 })

    assert.strictEqual(stats.processed, 1)
    
    const log = await integrationRepo.findEventLog('lucro_simples', 'evt_retry_reboot')
    assert.strictEqual(log?.status, 'processed')
  })
})

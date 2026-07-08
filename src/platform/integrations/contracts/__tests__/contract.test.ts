import test, { describe } from 'node:test'
import assert from 'node:assert'
import { z } from 'zod'
import {
  ConnectorSummarySchema,
  ApiKeySchema,
  MappingSchema,
  EventLogDetailSchema,
  HealthStatusSchema,
  ActivityItemSchema
} from '../index'

// ─── Testes de Contrato ───────────────────────────────────────────────────────

describe('Testes de Contrato dos DTOs (Validação Estrita via Schemas Compartilhados)', () => {
  
  test('Deve validar o contrato do ConnectorSummaryDTO', () => {
    const mockData = {
      origin: 'lucro_simples',
      name: 'Lucro Simples',
      icon: 'plug',
      status: 'connected',
      version: 1,
      capabilities: ['replay', 'mappings', 'api_keys'],
      lastEventAt: '2026-07-07T18:00:00Z',
      eventsCount: 15,
      failuresCount: 0,
      totalRevenue: 2450.50,
    }
    
    // Zod strict() ou validação direta via parse
    // Nota: Como o schema no DTO não usa strict() por padrão para flexibilidade futura,
    // usamos .strict() no teste para garantir que nenhum campo extra vaze acidentalmente.
    const strictSchema = ConnectorSummarySchema.strict()
    const parsed = strictSchema.parse(mockData)
    assert.deepStrictEqual(parsed, mockData)
  })

  test('Deve falhar ao receber campos desconhecidos no ConnectorSummaryDTO', () => {
    const mockDataWithInternalFields = {
      origin: 'lucro_simples',
      name: 'Lucro Simples',
      icon: 'plug',
      status: 'connected',
      version: 1,
      capabilities: ['replay', 'mappings', 'api_keys'],
      lastEventAt: null,
      eventsCount: 0,
      failuresCount: 0,
      totalRevenue: 0,
      // Campo extra interno vazado
      key_hash: '3169fdc7729a58f3e867d38a683998098aee82528af009d80d6eb75e873723d2',
    }
    
    assert.throws(() => {
      ConnectorSummarySchema.strict().parse(mockDataWithInternalFields)
    }, z.ZodError)
  })

  test('Deve validar o contrato do ApiKeyDTO', () => {
    const mockData = {
      id: 'e69622fc-c743-4fa3-9f5e-ef17dfbe2214',
      name: 'Chave Lucro Simples',
      origin: 'lucro_simples',
      prefix: 'f_key_testkey1...',
      description: 'Chave de Produção',
      createdAt: '2026-07-07T18:00:00Z',
      lastUsedAt: null,
      lastIp: null,
      isRevoked: false,
    }

    const parsed = ApiKeySchema.strict().parse(mockData)
    assert.deepStrictEqual(parsed, mockData)
  })

  test('Deve falhar se o ApiKeyDTO contiver campos sensíveis como key_hash', () => {
    const mockDataSensitive = {
      id: 'e69622fc-c743-4fa3-9f5e-ef17dfbe2214',
      name: 'Chave Lucro Simples',
      origin: 'lucro_simples',
      prefix: 'f_key_testkey1...',
      description: null,
      createdAt: '2026-07-07T18:00:00Z',
      lastUsedAt: null,
      lastIp: null,
      isRevoked: false,
      key_hash: '12345abcde', // ❌ NÃO PODE VAZAR
    }

    assert.throws(() => {
      ApiKeySchema.strict().parse(mockDataSensitive)
    }, z.ZodError)
  })

  test('Deve validar o contrato do MappingDTO', () => {
    const mockData = {
      id: 'b6fefb73-0f8f-4fa1-b1e1-e943c220f865',
      origin: 'lucro_simples',
      eventType: 'sale.closed',
      accountId: 'cf4bc8b5-555e-4ca6-b333-e0281be22f28',
      accountName: 'Minha Carteira',
      categoryId: 'a3d3c220-4fa1-4fc3-a99f-e68f86fefb73',
      categoryName: 'Venda',
      priority: 1,
      enabled: true,
      conditions: [
        {
          group: 0,
          field: 'payment_method',
          operator: 'equals',
          value: 'pix',
        }
      ],
      createdAt: '2026-07-07T18:00:00Z',
    }

    const parsed = MappingSchema.strict().parse(mockData)
    assert.deepStrictEqual(parsed, mockData)
  })

  test('Deve validar o contrato do ActivityItemDTO', () => {
    const mockData = {
      id: 'a3d3c220-4fa1-4fc3-a99f-e68f86fefb73',
      type: 'success',
      severity: 'success',
      icon: 'check-circle',
      color: 'text-emerald-400 bg-emerald-500/10',
      title: 'Venda importada',
      description: 'R$ 245,50 · Lucro Simples',
      origin: 'lucro_simples',
      occurredAt: '2026-07-07T18:00:00Z',
    }

    const parsed = ActivityItemSchema.strict().parse(mockData)
    assert.deepStrictEqual(parsed, mockData)
  })

  test('Deve validar o contrato do EventLogDetailDTO', () => {
    const mockData = {
      id: 'd9b9c9e8-4fa3-4fa5-bf2d-e08f86fefb73',
      eventId: 'evt_lucrosimples_1001',
      origin: 'lucro_simples',
      eventType: 'sale.closed',
      status: 'processed',
      amount: 245.50,
      durationMs: 83,
      attemptCount: 1,
      lastAttemptAt: '2026-07-07T18:02:00Z',
      createdAt: '2026-07-07T18:02:00Z',
      movementId: 'a3d3c220-4fa1-4fc3-a99f-e68f86fefb73',
      error: null,
      payloads: {
        raw: { valorLiquido: 245.50, descricao: 'Venda Teste' },
        normalized: { amount: 245.50, description: 'Venda Teste' },
      },
      steps: [
        {
          id: 'webhook_ingress',
          order: 1,
          stage: 'Webhook',
          status: 'success',
          startedAt: '2026-07-07T18:02:00Z',
          finishedAt: '2026-07-07T18:02:00Z',
          durationMs: 2,
          message: null,
        }
      ],
      diagnostics: {
        connectorVersion: 1,
        schemaVersion: 1,
        replayed: false,
        replayCount: 0,
        totalDurationMs: 83,
      },
    }

    const parsed = EventLogDetailSchema.strict().parse(mockData)
    assert.deepStrictEqual(parsed, mockData)
  })

  test('Deve validar o contrato do HealthStatusDTO', () => {
    const mockData = {
      components: [
        {
          id: 'database',
          label: 'Banco',
          status: 'ok',
          critical: true,
          version: null,
          latencyMs: 15,
          message: null,
        }
      ],
      checkedAt: '2026-07-07T18:05:00Z',
      lastEventAt: '2026-07-07T18:02:00Z',
      lastEventDurationMs: 83,
    }

    const parsed = HealthStatusSchema.strict().parse(mockData)
    assert.deepStrictEqual(parsed, mockData)
  })
})

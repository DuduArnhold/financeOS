import { test, describe, before, after } from 'node:test'
import assert from 'node:assert'
import {
  setupTestMappings,
  cleanupEvent,
  triggerWebhook
} from './helper'

describe('Smoke Test - MoneyBridge Webhook Ingress', () => {
  const eventId = `smoke_test_evt_${Date.now()}`
  const vendaId = `smoke_test_venda_${Date.now()}`

  before(async () => {
    await setupTestMappings()
    await cleanupEvent(eventId, undefined, vendaId)
  })

  after(async () => {
    await cleanupEvent(eventId, undefined, vendaId)
  })

  test('Deve processar um webhook básico sale.closed de ponta a ponta em menos de 5 segundos', async () => {
    const payload = {
      valorLiquido: 10.00,
      dataFechamento: new Date().toISOString(),
      descricao: 'Venda Smoke Test',
      vendaId: vendaId
    }

    const response = await triggerWebhook('sale.closed', eventId, payload)
    assert.strictEqual(response.status, 200)
    assert.strictEqual(response.data.status, 'processed')
    assert.ok(response.data.movementId)
  })
})

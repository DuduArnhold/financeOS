import { test, describe, before, after } from 'node:test'
import assert from 'node:assert'
import {
  supabase,
  TEST_USER_ID,
  setupTestMappings,
  cleanupEvent,
  triggerWebhook
} from './helper'

describe('Homologação Operacional - sale.closed', () => {
  const eventId = `test_closed_evt_${Date.now()}`
  const vendaId = `test_closed_venda_${Date.now()}`
  const amount = 350.75

  before(async () => {
    await setupTestMappings()
    // Limpeza preventiva
    await cleanupEvent(eventId, undefined, vendaId)
  })

  after(async () => {
    await cleanupEvent(eventId, undefined, vendaId)
  })

  test('Deve receber webhook de venda concluída, persistir logs, cadastrar receita no FinanceOS e ignorar duplicados', async () => {
    const payload = {
      valorLiquido: amount,
      dataFechamento: new Date().toISOString(),
      descricao: 'Venda de teste homologação',
      vendaId: vendaId
    }

    // 1. Enviar o primeiro Webhook via HTTP
    console.log(`[Test] Enviando webhook HTTP para sale.closed com eventId=${eventId}`)
    const response = await triggerWebhook('sale.closed', eventId, payload)

    // Validar status HTTP e resposta
    assert.strictEqual(response.status, 200)
    assert.strictEqual(response.data.status, 'processed')
    assert.strictEqual(response.data.eventId, eventId)
    assert.ok(response.data.movementId)

    // 2. Validar no banco de dados (moneybridge_events)
    const { data: eventLog } = await supabase
      .from('moneybridge_events')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .eq('event_id', eventId)
      .single()

    assert.ok(eventLog)
    assert.strictEqual(eventLog.status, 'processed')
    assert.strictEqual(eventLog.origin, 'lucro_simples')
    assert.strictEqual(eventLog.event_type, 'sale.closed')

    // 3. Validar no banco de dados (finance_movements)
    const { data: movement } = await supabase
      .from('finance_movements')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .eq('id', response.data.movementId)
      .single()

    assert.ok(movement)
    assert.strictEqual(Number(movement.valor), amount)
    assert.strictEqual(movement.tipo, 'receita')
    assert.strictEqual(movement.origem_ref, vendaId)

    // 4. Testar idempotência (enviar o mesmo webhook novamente)
    console.log(`[Test] Reenviando webhook HTTP com mesmo eventId=${eventId} (idempotência)`)
    const dupResponse = await triggerWebhook('sale.closed', eventId, payload)

    assert.strictEqual(dupResponse.status, 200)
    assert.strictEqual(dupResponse.data.status, 'duplicate')
    assert.strictEqual(dupResponse.data.processed, false)
  })
})

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert'
import {
  supabase,
  TEST_USER_ID,
  setupTestMappings,
  cleanupEvent,
  triggerWebhook
} from './helper'

describe('Homologação Operacional - sale.refunded', () => {
  const eventId = `test_refund_evt_${Date.now()}`
  const vendaId = `test_refund_venda_${Date.now()}`
  const amount = 89.90

  before(async () => {
    await setupTestMappings()
    // Limpeza preventiva
    await cleanupEvent(eventId, undefined, vendaId)
  })

  after(async () => {
    await cleanupEvent(eventId, undefined, vendaId)
  })

  test('Deve processar reembolso de venda criando uma movimentação de despesa correspondente (estorno)', async () => {
    const payload = {
      valorLiquido: amount,
      dataFechamento: new Date().toISOString(),
      descricao: 'Venda reembolsada',
      vendaId: vendaId
    }

    // 1. Enviar sale.refunded webhook via HTTP
    console.log(`[Test] Enviando webhook HTTP para sale.refunded com eventId=${eventId}`)
    const response = await triggerWebhook('sale.refunded', eventId, payload)
    assert.strictEqual(response.status, 200)
    assert.strictEqual(response.data.status, 'processed')
    const movementId = response.data.movementId
    assert.ok(movementId)

    // 2. Verificar se a movimentação de despesa foi criada no banco
    const { data: movement } = await supabase
      .from('finance_movements')
      .select('*')
      .eq('id', movementId)
      .single()

    assert.ok(movement)
    assert.strictEqual(Number(movement.valor), amount)
    assert.strictEqual(movement.tipo, 'despesa')
    assert.strictEqual(movement.origem_ref, vendaId)
    assert.ok(movement.descricao.includes('Estorno:'))
  })
})

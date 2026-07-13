import { test, describe, before, after } from 'node:test'
import assert from 'node:assert'
import {
  supabase,
  TEST_USER_ID,
  setupTestMappings,
  cleanupEvent,
  triggerWebhook
} from './helper'

describe('Homologação Operacional - sale.cancelled', () => {
  const closedEventId = `test_canc_closed_evt_${Date.now()}`
  const cancelledEventId = `test_canc_evt_${Date.now()}`
  const vendaId = `test_canc_venda_${Date.now()}`
  const amount = 199.90

  before(async () => {
    await setupTestMappings()
    // Limpeza preventiva
    await cleanupEvent(closedEventId, undefined, vendaId)
    await cleanupEvent(cancelledEventId, undefined, vendaId)
  })

  after(async () => {
    await cleanupEvent(closedEventId, undefined, vendaId)
    await cleanupEvent(cancelledEventId, undefined, vendaId)
  })

  test('Deve cancelar uma venda existente aplicando soft delete na movimentação de receita correspondente', async () => {
    const salePayload = {
      valorLiquido: amount,
      dataFechamento: new Date().toISOString(),
      descricao: 'Venda original para cancelamento',
      vendaId: vendaId
    }

    // 1. Criar a venda original via webhook sale.closed
    console.log(`[Test] Criando venda original para cancelamento com eventId=${closedEventId}`)
    const closedResponse = await triggerWebhook('sale.closed', closedEventId, salePayload)
    assert.strictEqual(closedResponse.status, 200)
    assert.strictEqual(closedResponse.data.status, 'processed')
    const movementId = closedResponse.data.movementId
    assert.ok(movementId)

    // Validar que a movimentação foi criada e está ativa (deleted_at is null)
    const { data: initialMovement } = await supabase
      .from('finance_movements')
      .select('deleted_at')
      .eq('id', movementId)
      .single()
    assert.strictEqual(initialMovement?.deleted_at, null)

    // 2. Disparar o cancelamento via webhook sale.cancelled
    console.log(`[Test] Disparando cancelamento para vendaId=${vendaId} com eventId=${cancelledEventId}`)
    const cancelPayload = {
      valorLiquido: amount,
      dataFechamento: new Date().toISOString(),
      descricao: 'Cancelamento de venda homologação',
      vendaId: vendaId
    }

    const cancelResponse = await triggerWebhook('sale.cancelled', cancelledEventId, cancelPayload)
    assert.strictEqual(cancelResponse.status, 200)
    assert.strictEqual(cancelResponse.data.status, 'processed')

    // 3. Validar no banco de dados se a movimentação foi soft-deletada (deleted_at is not null)
    const { data: finalMovement } = await supabase
      .from('finance_movements')
      .select('deleted_at')
      .eq('id', movementId)
      .single()

    assert.ok(finalMovement)
    assert.ok(finalMovement.deleted_at !== null, 'Movimentação deveria estar soft-deletada')
  })
})

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert'
import {
  supabase,
  TEST_USER_ID,
  setupTestMappings,
  cleanupEvent,
  triggerWebhook
} from './helper'

describe('Homologação Operacional - purchase.created e purchase.paid', () => {
  const createdEventId = `test_pur_create_evt_${Date.now()}`
  const paidEventId = `test_pur_pay_evt_${Date.now()}`
  const compraId = `test_pur_compra_${Date.now()}`
  const amount = 450.00

  before(async () => {
    await setupTestMappings()
    // Limpeza preventiva
    await cleanupEvent(createdEventId, compraId)
    await cleanupEvent(paidEventId, compraId)
  })

  after(async () => {
    await cleanupEvent(createdEventId, compraId)
    await cleanupEvent(paidEventId, compraId)
  })

  test('Deve criar uma conta a pagar para a compra e em seguida efetuar o pagamento da conta via webhook', async () => {
    const payload = {
      valorLiquido: amount,
      dataFechamento: new Date().toISOString(),
      descricao: 'Compra de teste homologação',
      vendaId: compraId // VendaId é mapeado como compraId no payload bruto
    }

    // 1. Enviar purchase.created webhook via HTTP
    console.log(`[Test] Enviando webhook HTTP para purchase.created com eventId=${createdEventId}`)
    const createResponse = await triggerWebhook('purchase.created', createdEventId, payload)
    assert.strictEqual(createResponse.status, 200)
    assert.strictEqual(createResponse.data.status, 'processed')

    // Verificar se a conta a pagar foi criada pendente (paga = false) no banco
    const { data: initialBill } = await supabase
      .from('finance_contas')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .like('nome', `%[Ref: ${compraId}]%`)
      .is('deleted_at', null)
      .maybeSingle()

    assert.ok(initialBill)
    assert.strictEqual(Number(initialBill.valor), amount)
    assert.strictEqual(initialBill.paga, false)

    // 2. Enviar purchase.paid webhook via HTTP
    console.log(`[Test] Enviando webhook HTTP para purchase.paid com eventId=${paidEventId}`)
    const payResponse = await triggerWebhook('purchase.paid', paidEventId, payload)
    assert.strictEqual(payResponse.status, 200)
    assert.strictEqual(payResponse.data.status, 'processed')

    // Verificar se a conta foi dada baixa (paga = true) no banco
    const { data: finalBill } = await supabase
      .from('finance_contas')
      .select('*')
      .eq('id', initialBill.id)
      .maybeSingle()

    assert.ok(finalBill)
    assert.strictEqual(finalBill.paga, true)

    // Verificar se a movimentação de despesa foi criada vinculada
    const { data: movements } = await supabase
      .from('finance_movements')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .eq('conta_id', initialBill.id)

    assert.ok(movements && movements.length > 0)
    const movement = movements[0]
    assert.strictEqual(Number(movement.valor), amount)
    assert.strictEqual(movement.tipo, 'despesa')
  })
})

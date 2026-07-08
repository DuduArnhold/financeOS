import { test, describe } from 'node:test'
import assert from 'node:assert'
import { RateLimiter } from '../rate-limiter'
import { StructuredLogger } from '../structured-logger'

describe('Sprint 3.2C.1 - Platform Hardening', () => {
  test('RateLimiter deve bloquear após atingir o limite na janela deslizante', () => {
    const key = 'test_api_key_hash'
    RateLimiter.reset(key)

    // Simula 3 requisições permitidas (com limite = 3)
    const res1 = RateLimiter.check(key, 3)
    const res2 = RateLimiter.check(key, 3)
    const res3 = RateLimiter.check(key, 3)
    
    // A quarta deve falhar (limite excedido)
    const res4 = RateLimiter.check(key, 3)

    assert.strictEqual(res1, true)
    assert.strictEqual(res2, true)
    assert.strictEqual(res3, true)
    assert.strictEqual(res4, false)
  })

  test('StructuredLogger deve logar estruturado sem quebrar', () => {
    assert.doesNotThrow(() => {
      StructuredLogger.log({
        requestId: 'req_123',
        correlationId: 'corr_456',
        origin: 'lucro_simples',
        status: 'success',
        message: 'Teste de sanidade do log estruturado'
      })
    })
  })
})

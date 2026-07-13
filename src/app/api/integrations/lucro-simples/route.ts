import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { bootstrapPlatform } from '@/platform/bootstrap'
import { connectorRegistry, WebhookRequest } from '@/platform/integrations/connectors/registry'
import { supabaseIntegrationRepository } from '@/repositories/integration.repository'
import { supabase } from '@/lib/supabase'
import { hashApiKey, sanitizeIp } from '@/lib/crypto'
import { RateLimiter } from '@/platform/integrations/rate-limiter'
import { StructuredLogger } from '@/platform/integrations/structured-logger'
import { createClient } from '@supabase/supabase-js'
import { setMovementRepository, SupabaseMovementRepository } from '@/repositories/movement.repository'
import { setContaRepository, SupabaseContaRepository } from '@/repositories/conta.repository'

/**
 * WEBHOOK: POST /api/integrations/lucro-simples
 *
 * Recebe vendas fechadas em tempo real do sistema Lucro Simples e as integra no FinanceOS.
 */
export async function POST(request: Request) {
  const startTime = Date.now()
  const requestId = randomUUID()
  const correlationId = request.headers.get('x-correlation-id') || request.headers.get('X-Correlation-ID') || randomUUID()

  // 1. Garantir que a plataforma esteja inicializada (Guard contra ambiente serverless do Next.js)
  try {
    bootstrapPlatform()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    StructuredLogger.log({
      requestId,
      correlationId,
      origin: 'lucro_simples',
      status: 'failed',
      message: `Plataforma bootstrap falhou: ${msg}`,
    })
    return NextResponse.json({
      error: 'InternalServerError',
      message: 'Falha ao inicializar os barramentos de integração da plataforma.'
    }, { status: 500 })
  }

  // 2. Validar Feature Flag do Conector
  const registration = connectorRegistry.get('lucro_simples')
  if (!registration || !registration.enabled) {
    StructuredLogger.log({
      requestId,
      correlationId,
      origin: 'lucro_simples',
      status: 'failed',
      message: 'Rejeitado: Conector desativado por Feature Flag.',
    })
    return NextResponse.json({
      error: 'Forbidden',
      message: 'O conector Lucro Simples está temporariamente desativado.'
    }, { status: 403 })
  }

  try {
    // 3. Resolver Autenticação (Chave de API vs Fallback de userId)
    let userId: string | null = null
    let apiKeyRecordId: string | null = null

    // Ler chave do cabeçalho Authorization ou X-API-Key
    const authHeader = request.headers.get('authorization')
    let apiKey = ''
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      apiKey = authHeader.substring(7).trim()
    } else {
      apiKey = request.headers.get('x-api-key') || request.headers.get('X-API-Key') || ''
    }

    if (apiKey) {
      // Calcular o HMAC-SHA256 da chave recebida
      const keyHash = hashApiKey(apiKey)

      // Rate Limiting deslizante
      if (!RateLimiter.check(keyHash)) {
        StructuredLogger.log({
          requestId,
          correlationId,
          origin: 'lucro_simples',
          status: 'rate_limited',
          message: 'Webhook bloqueado por excesso de requisições (Rate Limit).',
        })
        return NextResponse.json({
          error: 'RateLimited',
          message: 'Limite de requisições excedido. Tente novamente em 1 minuto.'
        }, { status: 429 })
      }

      // Buscar a chave ativa na tabela integration_keys
      const { data: keyData, error: keyErr } = await supabase
        .from('integration_keys')
        .select('id, user_id, origin')
        .eq('key_hash', keyHash)
        .is('revoked_at', null)
        .maybeSingle()

      if (keyErr) {
        console.error('[Webhook API] Erro ao consultar chave de API:', keyErr)
        return NextResponse.json({
          error: 'InternalServerError',
          message: 'Erro interno ao validar credenciais da integração.'
        }, { status: 500 })
      }

      if (!keyData) {
        return NextResponse.json({
          error: 'Unauthorized',
          message: 'Chave de API inválida ou revogada.'
        }, { status: 401 })
      }

      userId = keyData.user_id
      apiKeyRecordId = keyData.id
    } else {
      // Fallback temporário via query string (DEPRECADO)
      const { searchParams } = new URL(request.url)
      userId = searchParams.get('userId')
      
      if (userId) {
        console.warn(`[Webhook API] AVISO: Autenticação via "?userId=${userId}" na URL é deprecada. Utilize chaves de API.`)
      }
    }

    if (!userId) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'Credenciais ausentes. Forneça a chave de API no cabeçalho Authorization.'
      }, { status: 401 })
    }

    // 4. Se for fallback temporário por userId, valida se o profile existe
    if (!apiKey) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle()

      if (!profile) {
        return NextResponse.json({
          error: 'UserNotFound',
          message: 'Nenhum usuário correspondente ao userId fornecido foi encontrado no sistema.'
        }, { status: 404 })
      }
    }

    // 5. Obter o cabeçalho X-Event-ID para idempotência
    const eventId = request.headers.get('x-event-id') || request.headers.get('X-Event-ID')
    if (!eventId) {
      return NextResponse.json({
        error: 'InvalidRequest',
        message: 'O cabeçalho "X-Event-ID" é obrigatório para garantir a idempotência da transação.'
      }, { status: 400 })
    }

    // 6. Verificação rápida de duplicidade (idempotência)
    const isDuplicate = await supabaseIntegrationRepository.isEventProcessed('lucro_simples', eventId)
    if (isDuplicate) {
      StructuredLogger.log({
        requestId,
        correlationId,
        eventId,
        userId,
        origin: 'lucro_simples',
        status: 'success',
        message: 'Webhook duplicado rejeitado por idempotência.',
      })
      return NextResponse.json({
        status: 'duplicate',
        processed: false,
        eventId
      }, { status: 200 })
    }

    // Ingress Log
    StructuredLogger.log({
      requestId,
      correlationId,
      eventId,
      userId,
      origin: 'lucro_simples',
      status: 'ingress',
      message: 'Ingresso do Webhook recebido.',
    })

    // 7. Ler o payload
    let rawSale
    try {
      rawSale = await request.json()
    } catch {
      return NextResponse.json({
        error: 'InvalidPayload',
        message: 'Corpo da requisição inválido. Certifique-se de enviar um JSON válido.'
      }, { status: 400 })
    }

    // Mapear os cabeçalhos HTTP para um Record<string, string> agnóstico
    const headersObj: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      headersObj[key] = value
    })

    const ip = sanitizeIp(request.headers, 'unknown-ip')

    const webhookRequest: WebhookRequest = {
      userId,
      eventId,
      payload: rawSale,
      context: {
        headers: headersObj,
        ip,
        requestId,
        correlationId
      }
    }

    const customJwt = request.headers.get('x-supabase-jwt')
    if (customJwt) {
      const authClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        {
          global: {
            headers: {
              Authorization: `Bearer ${customJwt}`
            }
          }
        }
      )
      setMovementRepository(new SupabaseMovementRepository(authClient))
      setContaRepository(new SupabaseContaRepository(authClient))
    }

    try {
      // 8. Disparar o processamento síncrono no conector de produção obtido do registry
      await registration.connector.handleWebhook(webhookRequest)

      // 9. Atualizar metadados de último uso da chave de API em background
      if (apiKeyRecordId) {
        supabase
          .from('integration_keys')
          .update({
            last_used_at: new Date().toISOString(),
            last_ip: ip
          })
          .eq('id', apiKeyRecordId)
          .then(({ error }) => {
            if (error) console.error('[Webhook API] Erro ao atualizar auditoria da chave:', error.message)
          })
      }

      // 10. Buscar a movimentação criada no banco para retornar o ID correspondente
      const { data: movement } = await supabase
        .from('finance_movements')
        .select('id')
        .eq('user_id', userId)
        .eq('origem', 'lucro_simples')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const durationMs = Date.now() - startTime

      // Success Log
      StructuredLogger.log({
        requestId,
        correlationId,
        eventId,
        userId,
        origin: 'lucro_simples',
        durationMs,
        status: 'success',
        message: `Webhook processado com sucesso. Transação: ${movement?.id || 'unknown'}`,
        details: { ip }
      })

      return NextResponse.json({
        status: 'processed',
        eventId,
        movementId: movement?.id || 'unknown',
        durationMs
      }, { status: 200 })
    } finally {
      if (customJwt) {
        setMovementRepository(new SupabaseMovementRepository())
        setContaRepository(new SupabaseContaRepository())
      }
    }

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    const durationMs = Date.now() - startTime

    // Failed Log
    StructuredLogger.log({
      requestId,
      correlationId,
      origin: 'lucro_simples',
      durationMs,
      status: 'failed',
      message: `Falha no processamento: ${errorMsg}`,
    })

    if (errorMsg.includes('InvalidPlatformEvent') || errorMsg.includes('Normalizer')) {
      return NextResponse.json({
        error: 'InvalidPayload',
        message: errorMsg
      }, { status: 400 })
    }

    if (errorMsg.includes('Nenhum mapeamento de integração ativo')) {
      return NextResponse.json({
        error: 'MappingNotFound',
        message: errorMsg
      }, { status: 400 })
    }

    if (errorMsg.includes('Handler não localizado')) {
      return NextResponse.json({
        error: 'HandlerNotFound',
        message: errorMsg
      }, { status: 400 })
    }

    return NextResponse.json({
      error: 'InternalServerError',
      message: 'Erro interno ao processar a integração do Lucro Simples.'
    }, { status: 500 })
  }
}

/**
 * GET /api/integrations/lucro-simples
 *
 * PING: Endpoint de conectividade para validar chaves, mapeamentos e autenticação do usuário.
 */
export async function GET(request: Request) {
  try {
    let userId: string | null = null
    const authHeader = request.headers.get('authorization')
    let apiKey = ''
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      apiKey = authHeader.substring(7).trim()
    } else {
      apiKey = request.headers.get('x-api-key') || request.headers.get('X-API-Key') || ''
    }

    if (apiKey) {
      const keyHash = hashApiKey(apiKey)
      const { data: keyData, error: keyErr } = await supabase
        .from('integration_keys')
        .select('id, user_id')
        .eq('key_hash', keyHash)
        .is('revoked_at', null)
        .maybeSingle()

      if (keyErr) {
        return NextResponse.json({ error: 'DatabaseError', message: 'Erro ao consultar chave de API.' }, { status: 500 })
      }
      if (!keyData) {
        return NextResponse.json({ error: 'Unauthorized', message: 'Chave de API inválida ou revogada.' }, { status: 401 })
      }
      userId = keyData.user_id
    } else {
      const { searchParams } = new URL(request.url)
      userId = searchParams.get('userId')
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Credenciais ausentes. Informe a chave de API no header ou o userId.' }, { status: 401 })
    }

    // Validar se o perfil existe
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('nome')
      .eq('id', userId)
      .maybeSingle()

    if (profileErr) {
      return NextResponse.json({ error: 'DatabaseError', message: 'Erro ao consultar perfil.' }, { status: 500 })
    }
    if (!profile) {
      return NextResponse.json({ error: 'UserNotFound', message: 'Usuário não localizado no sistema.' }, { status: 404 })
    }

    // Verificar mapeamentos de integração ativos
    const { data: mappings, error: mappingsErr } = await supabase
      .from('integration_mappings')
      .select('id')
      .eq('user_id', userId)
      .eq('origin', 'lucro_simples')
      .eq('enabled', true)

    if (mappingsErr) {
      return NextResponse.json({ error: 'DatabaseError', message: 'Erro ao consultar mapeamentos.' }, { status: 500 })
    }

    return NextResponse.json({
      status: 'ok',
      integration: 'lucro_simples',
      userId,
      userName: profile.nome,
      authenticatedBy: apiKey ? 'api_key' : 'url_fallback',
      version: 1,
      activeMappings: mappings?.length || 0
    }, { status: 200 })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'InternalServerError', message: `Erro ao testar conectividade: ${msg}` }, { status: 500 })
  }
}


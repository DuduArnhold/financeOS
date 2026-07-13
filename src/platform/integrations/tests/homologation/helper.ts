import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8')
    content.split('\n').forEach(line => {
      const parts = line.split('=')
      if (parts.length >= 2) {
        const key = parts[0].trim()
        const val = parts.slice(1).join('=').trim()
        process.env[key] = val
      }
    })
  }
}

loadEnvLocal()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const TEST_USER_ID = 'c2abded0-23f4-43ea-a577-10b113b1bc31'
export const TEST_ACCOUNT_ID = 'eb533b18-5266-4974-814b-467786428fb1'
export const TEST_RECEITA_CAT_ID = 'a4b3b949-f4e2-4eff-acc4-bc49aced8d76' // Venda (receita)
export const TEST_DESPESA_CAT_ID = '03e5a724-0648-47af-a7f3-10a9db13bca6' // Outros (despesa)

/**
 * Garante que os mapeamentos de integração necessários existam no banco para a homologação.
 */
export async function setupTestMappings() {
  const mappings = [
    {
      user_id: TEST_USER_ID,
      origin: 'lucro_simples',
      event_type: 'sale.closed',
      account_id: TEST_ACCOUNT_ID,
      category_id: TEST_RECEITA_CAT_ID,
      priority: 0,
      enabled: true
    },
    {
      user_id: TEST_USER_ID,
      origin: 'lucro_simples',
      event_type: 'sale.cancelled',
      account_id: TEST_ACCOUNT_ID,
      category_id: TEST_RECEITA_CAT_ID,
      priority: 0,
      enabled: true
    },
    {
      user_id: TEST_USER_ID,
      origin: 'lucro_simples',
      event_type: 'sale.refunded',
      account_id: TEST_ACCOUNT_ID,
      category_id: TEST_DESPESA_CAT_ID,
      priority: 0,
      enabled: true
    },
    {
      user_id: TEST_USER_ID,
      origin: 'lucro_simples',
      event_type: 'purchase.created',
      account_id: TEST_ACCOUNT_ID,
      category_id: TEST_DESPESA_CAT_ID,
      priority: 0,
      enabled: true
    },
    {
      user_id: TEST_USER_ID,
      origin: 'lucro_simples',
      event_type: 'purchase.paid',
      account_id: TEST_ACCOUNT_ID,
      category_id: TEST_DESPESA_CAT_ID,
      priority: 0,
      enabled: true
    }
  ]

  for (const m of mappings) {
    const { data: existing } = await supabase
      .from('integration_mappings')
      .select('id')
      .eq('user_id', m.user_id)
      .eq('origin', m.origin)
      .eq('event_type', m.event_type)
      .maybeSingle()

    if (!existing) {
      const { error } = await supabase
        .from('integration_mappings')
        .insert(m)
      if (error) {
        throw new Error(`setupTestMappings: falha ao inserir mapeamento para ${m.event_type}: ${error.message}`)
      }
    }
  }
}

/**
 * Remove qualquer dado gerado durante o teste para manter o banco limpo.
 */
export async function cleanupEvent(eventId: string, compraId?: string, vendaId?: string) {
  // 1. Limpar logs do MoneyBridge
  await supabase
    .from('moneybridge_events')
    .delete()
    .eq('user_id', TEST_USER_ID)
    .eq('event_id', eventId)

  // 2. Limpar movimentações criadas
  const refs = [eventId]
  if (compraId) refs.push(compraId)
  if (vendaId) refs.push(vendaId)

  await supabase
    .from('finance_movements')
    .delete()
    .eq('user_id', TEST_USER_ID)
    .in('origem_ref', refs)

  // 3. Limpar contas
  if (compraId) {
    await supabase
      .from('finance_contas')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .like('nome', `%[Ref: ${compraId}]%`)
  }
}

/**
 * Dispara uma requisição HTTP real contra o endpoint do webhook local.
 */
export async function triggerWebhook(eventType: string, eventId: string, payload: any) {
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'
  const url = `${baseUrl}/api/integrations/lucro-simples?userId=${TEST_USER_ID}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Event-ID': eventId,
      'X-Event-Type': eventType,
      'X-Correlation-ID': `test_corr_${Date.now()}`
    },
    body: JSON.stringify(payload)
  })

  return {
    status: response.status,
    data: await response.json()
  }
}

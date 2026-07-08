'use server'

import { createClient } from '@supabase/supabase-js'
import { IntegrationService } from '@/services/integration.service'
import type { IntegrationOrigin } from '@/platform/integrations/origins'
import { IntegrationReplayService } from '@/platform/integrations/replay.service'
import { setMovementRepository, SupabaseMovementRepository } from '@/repositories/movement.repository'

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL     || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/**
 * Helper para obter a instância do IntegrationService associada ao JWT do usuário ativo.
 */
function getIntegrationService(accessToken: string): IntegrationService {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
  return new IntegrationService(client)
}

// ─── Actions de API Keys ─────────────────────────────────────────────────────

interface CreateKeyOptions {
  userId: string // mantido para compatibilidade de assinatura se necessário, mas IntegrationService usa a claim do JWT
  name: string
  origin: IntegrationOrigin
  description?: string
  accessToken: string
}

/**
 * Cria uma nova API Key e retorna a chave em texto plano exatamente uma vez para o usuário copiar.
 */
export async function createApiKeyAction(options: CreateKeyOptions) {
  const service = getIntegrationService(options.accessToken)
  const result = await service.createApiKey(options.userId, {
    name: options.name,
    origin: options.origin,
    description: options.description,
  })

  return {
    plainKey: result.plainKey,
    record: result.dto
  }
}

interface RevokeKeyOptions {
  id: string
  userId: string
  accessToken: string
}

/**
 * Revoga uma chave de API.
 */
export async function revokeApiKeyAction(options: RevokeKeyOptions) {
  const service = getIntegrationService(options.accessToken)
  await service.revokeApiKey(options.userId, options.id)
  return { success: true }
}

// ─── Actions de Mapeamentos ──────────────────────────────────────────────────

interface SaveMappingOptions {
  userId: string
  origin: IntegrationOrigin
  eventType: string
  accountId: string
  categoryId: string
  priority: number
  enabled: boolean
  accessToken: string
}

/**
 * Cria ou edita uma regra de mapeamento de integração.
 */
export async function saveMappingAction(options: SaveMappingOptions) {
  const service = getIntegrationService(options.accessToken)
  await service.saveMapping(options.userId, {
    origin: options.origin,
    eventType: options.eventType,
    accountId: options.accountId,
    categoryId: options.categoryId,
    priority: options.priority,
    enabled: options.enabled,
    conditions: [],
  })

  return { success: true }
}

// ─── Actions de Reprocessamento (Replay) ──────────────────────────────────────

interface ReprocessEventOptions {
  eventId: string
  accessToken: string
}

/**
 * Reprocessa um evento falho de forma síncrona.
 */
export async function reprocessEventAction(options: ReprocessEventOptions) {
  const { eventId, accessToken } = options
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })

  setMovementRepository(new SupabaseMovementRepository(authClient))

  try {
    await IntegrationReplayService.replay(eventId, authClient)
    return { success: true }
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Erro ao reprocessar evento.')
  } finally {
    setMovementRepository(new SupabaseMovementRepository())
  }
}

// ─── Actions de Consulta (Auxiliares de Mapeamento) ───────────────────────────

import { accountService } from '@/services/account.service'
import { categoryService } from '@/services/category.service'

export async function fetchAccountsAction(userId: string) {
  const res = await accountService.getActiveAccounts(userId)
  if (!res.success) throw new Error(res.error)
  return res.data
}

export async function fetchCategoriesAction(userId: string, tipo: 'receita' | 'despesa') {
  const res = await categoryService.getCategoriesByType(userId, tipo)
  if (!res.success) throw new Error(res.error)
  return res.data
}

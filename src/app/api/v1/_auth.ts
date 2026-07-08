import { createClient } from '@supabase/supabase-js'
import { createIntegrationService, IntegrationService } from '@/services/integration.service'

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL     || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/**
 * Extrai o JWT do cabeçalho Authorization e retorna o userId autenticado.
 * Retorna null se o token estiver ausente ou inválido.
 */
export async function getAuthenticatedUser(
  req: Request
): Promise<{ userId: string; token: string; service: IntegrationService } | null> {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user } } = await client.auth.getUser()
  if (!user) return null

  return { userId: user.id, token, service: createIntegrationService(token) }
}

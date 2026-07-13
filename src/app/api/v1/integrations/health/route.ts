import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '../../_auth'
import { ok, fail } from '@/lib/api-response'
import { bootstrapPlatform } from '@/platform/bootstrap'

/**
 * GET /api/v1/integrations/health
 * Retorna as métricas de diagnóstico e status de saúde do pipeline de integrações.
 */
export async function GET(req: Request) {
  try {
    // Garantir que a plataforma esteja inicializada para preencher o connectorRegistry
    bootstrapPlatform()

    const auth = await getAuthenticatedUser(req)
    if (!auth) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Autenticação necessária'), { status: 401 })
    }

    const health = await auth.service.getHealth(auth.userId)
    return NextResponse.json(ok(health))
  } catch (err) {
    console.error('[GET /api/v1/integrations/health]', err)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Erro ao obter diagnóstico de saúde'), { status: 500 })
  }
}

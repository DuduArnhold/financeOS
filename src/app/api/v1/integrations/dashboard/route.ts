import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '../../_auth'
import { ok, fail } from '@/lib/api-response'

/**
 * GET /api/v1/integrations/dashboard
 * Retorna os dados consolidados do painel de controle de integrações.
 * Reduz requests simultâneas no carregamento inicial da página.
 */
export async function GET(req: Request) {
  try {
    const auth = await getAuthenticatedUser(req)
    if (!auth) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Autenticação necessária'), { status: 401 })
    }

    const [connectors, activity] = await Promise.all([
      auth.service.listConnectors(auth.userId),
      auth.service.getActivity(auth.userId, 6),
    ])

    return NextResponse.json(ok({ connectors, activity }))
  } catch (err) {
    console.error('[GET /api/v1/integrations/dashboard]', err)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Erro ao carregar dashboard de integrações'), { status: 500 })
  }
}

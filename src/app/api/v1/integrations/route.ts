import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '../_auth'
import { ok, fail } from '@/lib/api-response'

/**
 * GET /api/v1/integrations
 * Lista todos os conectores registrados com métricas por origin.
 */
export async function GET(req: Request) {
  try {
    const auth = await getAuthenticatedUser(req)
    if (!auth) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Autenticação necessária'), { status: 401 })
    }

    const connectors = await auth.service.listConnectors(auth.userId)
    return NextResponse.json(ok(connectors))
  } catch (err) {
    console.error('[GET /api/v1/integrations]', err)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Erro ao listar integrações'), { status: 500 })
  }
}

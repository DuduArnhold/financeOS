import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/app/api/v1/_auth'
import { ok, fail } from '@/lib/api-response'
import { isValidIntegrationOrigin } from '@/platform/integrations/origins'
import type { IntegrationOrigin } from '@/platform/integrations/origins'

type Params = { params: Promise<{ origin: string }> }

/**
 * GET /api/v1/integrations/[origin]/mappings
 * Lista mapeamentos de uma integração específica.
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const { origin } = await params

    if (!isValidIntegrationOrigin(origin)) {
      return NextResponse.json(fail('INVALID_ORIGIN', `Origem inválida: ${origin}`), { status: 400 })
    }

    const auth = await getAuthenticatedUser(req)
    if (!auth) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Autenticação necessária'), { status: 401 })
    }

    const mappings = await auth.service.listMappings(auth.userId, origin as IntegrationOrigin)
    return NextResponse.json(ok(mappings))
  } catch (err) {
    console.error('[GET /api/v1/integrations/[origin]/mappings]', err)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Erro ao listar mapeamentos'), { status: 500 })
  }
}

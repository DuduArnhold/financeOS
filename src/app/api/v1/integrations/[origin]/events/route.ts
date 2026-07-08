import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/app/api/v1/_auth'
import { ok, fail } from '@/lib/api-response'
import { isValidIntegrationOrigin } from '@/platform/integrations/origins'
import type { IntegrationOrigin } from '@/platform/integrations/origins'

type Params = { params: Promise<{ origin: string }> }

/**
 * GET /api/v1/integrations/[origin]/events
 * Histórico de eventos com filtros e paginação.
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

    const url      = new URL(req.url)
    const status   = url.searchParams.get('status') as 'processing' | 'processed' | 'failed' | null
    const page     = parseInt(url.searchParams.get('page')     ?? '1',  10)
    const pageSize = parseInt(url.searchParams.get('pageSize') ?? '20', 10)

    const result = await auth.service.listEventLogs(auth.userId, {
      origin: origin as IntegrationOrigin,
      status: status ?? undefined,
      page,
      pageSize
    })

    return NextResponse.json(ok(result.items, {
      page:     result.page,
      pageSize: result.pageSize,
      total:    result.total,
      hasNext:  result.hasNext,
      hasPrev:  result.hasPrev,
    }))
  } catch (err) {
    console.error('[GET /api/v1/integrations/[origin]/events]', err)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Erro ao listar eventos'), { status: 500 })
  }
}

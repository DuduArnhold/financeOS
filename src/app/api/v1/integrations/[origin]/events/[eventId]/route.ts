import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/app/api/v1/_auth'
import { ok, fail } from '@/lib/api-response'
import { isValidIntegrationOrigin } from '@/platform/integrations/origins'

type Params = { params: Promise<{ origin: string; eventId: string }> }

/**
 * GET /api/v1/integrations/[origin]/events/[eventId]
 * Detalhes completos de um evento.
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const { origin, eventId } = await params

    if (!isValidIntegrationOrigin(origin)) {
      return NextResponse.json(fail('INVALID_ORIGIN', `Origem inválida: ${origin}`), { status: 400 })
    }

    const auth = await getAuthenticatedUser(req)
    if (!auth) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Autenticação necessária'), { status: 401 })
    }

    const detail = await auth.service.getEventLogDetail(auth.userId, eventId)
    if (!detail) {
      return NextResponse.json(fail('EVENT_NOT_FOUND', 'Evento não encontrado'), { status: 404 })
    }

    return NextResponse.json(ok(detail))
  } catch (err) {
    console.error('[GET /api/v1/integrations/[origin]/events/[eventId]]', err)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Erro ao obter detalhes do evento'), { status: 500 })
  }
}

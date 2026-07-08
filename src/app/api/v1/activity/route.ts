import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '../_auth'
import { ok, fail } from '@/lib/api-response'

/**
 * GET /api/v1/activity
 * Feed de atividade recente — global.
 */
export async function GET(req: Request) {
  try {
    const auth = await getAuthenticatedUser(req)
    if (!auth) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Autenticação necessária'), { status: 401 })
    }

    const url   = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '10', 10), 50)

    const activity = await auth.service.getActivity(auth.userId, limit)
    return NextResponse.json(ok(activity, { total: activity.length }))
  } catch (err) {
    console.error('[GET /api/v1/activity]', err)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Erro ao obter atividade'), { status: 500 })
  }
}

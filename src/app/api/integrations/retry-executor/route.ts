import { NextResponse } from 'next/server'
import { RetryExecutor } from '@/platform/integrations/retry-executor'
import { supabaseIntegrationRepository } from '@/repositories/integration.repository'

/**
 * Endpoint de gatilho do RetryExecutor.
 * Pode ser acionado via GET ou POST (geralmente por um Supabase Cron / pg_net).
 *
 * Exige cabeçalho x-cron-secret para autorização se CRON_SECRET estiver configurado no .env.
 */
export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}

async function handle(request: Request) {
  const secretHeader = request.headers.get('x-cron-secret')
  const envSecret = process.env.CRON_SECRET

  if (envSecret && secretHeader !== envSecret) {
    return NextResponse.json({
      error: 'Unauthorized',
      message: 'Credenciais de acionamento do cron inválidas.'
    }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    // O repositório injetado é o de produção (SupabaseIntegrationRepository)
    const executor = new RetryExecutor(supabaseIntegrationRepository)
    const result = await executor.scan({ limit })

    return NextResponse.json({
      status: 'success',
      processed: result.processed,
      failed: result.failed
    }, { status: 200 })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('[RetryExecutor API]', err)
    return NextResponse.json({
      error: 'InternalServerError',
      message: `Falha na execução do RetryExecutor: ${errorMsg}`
    }, { status: 500 })
  }
}

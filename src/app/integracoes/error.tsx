'use client'

import { useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PageTitle } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { AlertCircle, RotateCcw } from 'lucide-react'

export default function IntegracoesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Integracoes Boundary Error]', error)
  }, [error])

  return (
    <AppShell>
      <PageHeader
        left={<PageTitle eyebrow="Ecosistema" title="Erro na Rota" />}
      />

      <Card className="p-6 text-center border-rose-500/20 bg-rose-950/10">
        <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 mb-4 animate-pulse">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-semibold text-rose-200 mb-2">
          Falha ao carregar o Centro de Integrações
        </h2>
        <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto">
          {error.message || 'Ocorreu um erro inesperado ao sincronizar com os conectores.'}
        </p>

        <Button
          onClick={reset}
          className="mx-auto flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl py-2.5 px-4"
        >
          <RotateCcw className="w-4 h-4" />
          Tentar novamente
        </Button>
      </Card>
    </AppShell>
  )
}

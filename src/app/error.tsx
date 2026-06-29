'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    logger.error('Global Error Boundary caught an exception:', {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
    })
  }, [error])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#090d16] text-slate-100">
      <Card animate className="max-w-md w-full p-6 border-rose-500/20 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-28 h-28 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-2xl shadow-lg">
            <AlertTriangle className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-50">Algo deu errado</h1>
            <p className="text-xs text-slate-400 leading-relaxed max-w-[280px]">
              Ocorreu uma falha inesperada na renderização do aplicativo.
            </p>
          </div>

          <div className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 text-left text-[11px] font-mono text-slate-400 overflow-x-auto max-h-32 no-scrollbar">
            {error.message || 'Erro desconhecido'}
            {error.digest && (
              <div className="mt-1.5 pt-1.5 border-t border-slate-800 text-[10px] text-slate-500">
                Digest: {error.digest}
              </div>
            )}
          </div>

          <div className="flex gap-3 w-full pt-2">
            <Button
              variant="outline"
              onClick={() => {
                if (typeof window !== 'undefined') window.location.href = '/'
              }}
              icon={<Home className="w-4 h-4" />}
              className="flex-1 text-xs"
            >
              Início
            </Button>
            <Button
              variant="primary"
              onClick={reset}
              icon={<RefreshCw className="w-4 h-4" />}
              className="flex-1 text-xs"
            >
              Tentar Novamente
            </Button>
          </div>
        </div>
      </Card>
    </main>
  )
}

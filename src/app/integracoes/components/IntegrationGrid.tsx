'use client'

import React from 'react'
import { IntegrationCard } from './IntegrationCard'
import type { ConnectorSummaryDTO } from '@/platform/integrations/contracts'

interface IntegrationGridProps {
  connectors: ConnectorSummaryDTO[]
  onConfigure?: (origin: string) => void
}

export function IntegrationGrid({ connectors, onConfigure }: IntegrationGridProps) {
  if (connectors.length === 0) {
    return (
      <div className="text-center p-8 rounded-2xl border border-dashed border-slate-800 bg-slate-900/10">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Nenhum conector externo registrado no sistema.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
      {connectors.map((connector) => (
        <IntegrationCard
          key={connector.origin}
          connector={connector}
          onConfigure={onConfigure}
        />
      ))}
    </div>
  )
}

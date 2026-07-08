'use client'

import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PageTitle } from '@/components/layout/PageHeader'
import { SkeletonCard, SkeletonTable } from '@/components/feedback/Skeletons'
import { Card } from '@/components/ui/Card'

export default function IntegracoesLoading() {
  return (
    <AppShell>
      <PageHeader
        left={<PageTitle eyebrow="Ecosistema" title="Integrações" />}
      />

      {/* Cards de Status Shimmer */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <SkeletonCard className="h-28" />
        <SkeletonCard className="h-28" />
      </div>

      {/* Feed de Atividade Shimmer */}
      <Card className="p-5 mb-6">
        <div className="h-4 w-40 rounded-full skeleton-shimmer mb-4" />
        <div className="space-y-3">
          <div className="h-10 w-full rounded-xl skeleton-shimmer" />
          <div className="h-10 w-full rounded-xl skeleton-shimmer" />
          <div className="h-10 w-full rounded-xl skeleton-shimmer" />
        </div>
      </Card>

      {/* API Keys / Mapeamento Shimmer */}
      <SkeletonCard className="h-32 mb-6" />
      <SkeletonCard className="h-44" />
    </AppShell>
  )
}

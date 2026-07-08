import { z } from 'zod'
import { IntegrationOrigins } from '../../origins'

const originValues = Object.values(IntegrationOrigins) as [string, ...string[]]

export const ActivityItemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['success', 'error', 'warning', 'info']), // mantido para compatibilidade semântica
  severity: z.enum(['success', 'error', 'warning', 'info']),
  icon: z.string(),   // ex: "check-circle", "x-circle", "alert-triangle", "info"
  color: z.string(),  // ex: "text-emerald-400 bg-emerald-500/10" (classe CSS completa ou token)
  title: z.string(),
  description: z.string().nullable(),
  origin: z.enum(originValues).nullable(),
  occurredAt: z.string(),
})

export type ActivityItemDTO = z.infer<typeof ActivityItemSchema>

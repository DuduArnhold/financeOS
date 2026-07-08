import { z } from 'zod'

export const HealthComponentSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(['ok', 'degraded', 'down']),
  critical: z.boolean(),
  version: z.string().nullable(),
  latencyMs: z.number().nullable(),
  message: z.string().nullable(),
})

export type HealthComponentDTO = z.infer<typeof HealthComponentSchema>

export const HealthStatusSchema = z.object({
  components: z.array(HealthComponentSchema),
  checkedAt: z.string(),
  lastEventAt: z.string().nullable(),
  lastEventDurationMs: z.number().nullable(),
})

export type HealthStatusDTO = z.infer<typeof HealthStatusSchema>

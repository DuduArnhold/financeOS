import { z } from 'zod'
import { IntegrationOrigins } from '../../origins'

const originValues = Object.values(IntegrationOrigins) as [string, ...string[]]

export const PipelineStages = {
  WEBHOOK: 'Webhook',
  CONNECTOR: 'Connector',
  NORMALIZER: 'Normalizer',
  PUBLISHER: 'Publisher',
  HANDLER: 'Handler',
  MOVEMENT: 'Movement',
} as const

export type PipelineStage = typeof PipelineStages[keyof typeof PipelineStages]

export const PipelineStepSchema = z.object({
  id: z.string(),
  order: z.number().int().min(1),
  stage: z.enum(Object.values(PipelineStages) as [string, ...string[]]),
  status: z.enum(['success', 'failed', 'skipped']),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  durationMs: z.number().nullable(),
  message: z.string().nullable(),
})

export type PipelineStepDTO = z.infer<typeof PipelineStepSchema>

export const EventLogSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string(),
  origin: z.enum(originValues),
  eventType: z.string(),
  status: z.enum(['processing', 'processed', 'failed']),
  amount: z.number().nullable(),
  durationMs: z.number().nullable(),
  attemptCount: z.number().int(),
  lastAttemptAt: z.string().nullable(),
  createdAt: z.string(),
})

export type EventLogDTO = z.infer<typeof EventLogSchema>

export const EventLogDetailSchema = EventLogSchema.extend({
  movementId: z.string().nullable(),
  error: z.string().nullable(),
  payloads: z.object({
    raw: z.unknown(),
    normalized: z.unknown(),
  }),
  steps: z.array(PipelineStepSchema),
  diagnostics: z.object({
    connectorVersion: z.number(),
    schemaVersion: z.number(),
    replayed: z.boolean(),
    replayCount: z.number(),
    totalDurationMs: z.number().nullable(),
  }),
})

export type EventLogDetailDTO = z.infer<typeof EventLogDetailSchema>

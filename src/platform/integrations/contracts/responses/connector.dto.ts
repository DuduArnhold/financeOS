import { z } from 'zod'
import { IntegrationOrigins } from '../../origins'

const originValues = Object.values(IntegrationOrigins) as [string, ...string[]]

export const ConnectorSummarySchema = z.object({
  origin: z.enum(originValues),
  name: z.string(),
  icon: z.string(),
  status: z.enum(['connected', 'degraded', 'not_configured']),
  version: z.number(),
  capabilities: z.array(z.enum(['replay', 'mappings', 'api_keys'])),
  lastEventAt: z.string().nullable(),
  eventsCount: z.number(),
  failuresCount: z.number(),
  totalRevenue: z.number(),
})

export type ConnectorSummaryDTO = z.infer<typeof ConnectorSummarySchema>

export const IntegrationStatusSchema = z.object({
  origin: z.enum(originValues),
  status: z.enum(['connected', 'degraded', 'not_configured']),
  lastEventAt: z.string().nullable(),
  lastEventId: z.string().nullable(),
  eventsCount: z.number(),
  failuresCount: z.number(),
  totalRevenue: z.number(),
})

export type IntegrationStatusDTO = z.infer<typeof IntegrationStatusSchema>

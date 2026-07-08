import { z } from 'zod'
import { IntegrationOrigins } from '../../origins'

const originValues = Object.values(IntegrationOrigins) as [string, ...string[]]

export const MappingConditionSchema = z.object({
  group: z.number().int().min(0),
  field: z.string(),
  operator: z.enum(['equals', 'not_equals', 'contains', 'gt', 'lt']),
  value: z.string(),
})

export type MappingConditionDTO = z.infer<typeof MappingConditionSchema>

export const MappingSchema = z.object({
  id: z.string().uuid(),
  origin: z.enum(originValues),
  eventType: z.string(),
  accountId: z.string().uuid(),
  accountName: z.string(),
  categoryId: z.string().uuid(),
  categoryName: z.string(),
  priority: z.number().int().min(1),
  enabled: z.boolean(),
  conditions: z.array(MappingConditionSchema),
  createdAt: z.string(),
})

export type MappingDTO = z.infer<typeof MappingSchema>

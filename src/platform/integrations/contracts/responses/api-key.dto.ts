import { z } from 'zod'
import { IntegrationOrigins } from '../../origins'

const originValues = Object.values(IntegrationOrigins) as [string, ...string[]]

export const ApiKeySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  origin: z.enum(originValues),
  prefix: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
  lastIp: z.string().nullable(),
  isRevoked: z.boolean(),
})

export type ApiKeyDTO = z.infer<typeof ApiKeySchema>

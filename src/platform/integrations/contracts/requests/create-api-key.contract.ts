import { z } from 'zod'
import { IntegrationOrigins } from '../../origins'

const originValues = Object.values(IntegrationOrigins) as [string, ...string[]]

export const CreateApiKeySchema = z.object({
  name:        z.string().min(1, 'Nome obrigatório').max(100, 'Nome muito longo'),
  origin:      z.enum(originValues, { error: 'Origem de integração inválida' }),
  description: z.string().max(255, 'Descrição muito longa').optional(),
})

export type CreateApiKeyRequestDTO = z.infer<typeof CreateApiKeySchema>

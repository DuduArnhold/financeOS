import { z } from 'zod'
import { IntegrationOrigins } from '../../origins'

const originValues = Object.values(IntegrationOrigins) as [string, ...string[]]

const MappingConditionSchema = z.object({
  group:    z.number().int().min(0),
  field:    z.string().min(1, 'Campo obrigatório'),
  operator: z.enum(['equals', 'not_equals', 'contains', 'gt', 'lt']),
  value:    z.string().min(1, 'Valor obrigatório'),
})

export const CreateMappingSchema = z.object({
  origin:     z.enum(originValues, { error: 'Origem de integração inválida' }),
  eventType:  z.string().min(1, 'Tipo de evento obrigatório'),
  accountId:  z.string().uuid('ID de conta inválido'),
  categoryId: z.string().uuid('ID de categoria inválido'),
  priority:   z.number().int().min(1, 'Prioridade mínima é 1'),
  enabled:    z.boolean(),
  conditions: z.array(MappingConditionSchema).optional().default([]),
})

export type CreateMappingRequestDTO = z.infer<typeof CreateMappingSchema>

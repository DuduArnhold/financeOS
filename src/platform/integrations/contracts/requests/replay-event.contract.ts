import { z } from 'zod'

export const ReplayEventSchema = z.object({
  eventId: z.string().min(1, 'Event ID obrigatório'),
})

export type ReplayEventRequestDTO = z.infer<typeof ReplayEventSchema>

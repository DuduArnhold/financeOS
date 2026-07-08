import { z } from 'zod'
import { ConnectorSummarySchema } from './connector.dto'
import { ActivityItemSchema } from './activity.dto'

export const DashboardSchema = z.object({
  connectors: z.array(ConnectorSummarySchema),
  activity: z.array(ActivityItemSchema),
})

export type DashboardDTO = z.infer<typeof DashboardSchema>

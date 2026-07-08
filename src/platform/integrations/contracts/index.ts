// ─── Response Schemas & DTOs ──────────────────────────────────────────────────
export { ConnectorSummarySchema, IntegrationStatusSchema } from './responses/connector.dto'
export type { ConnectorSummaryDTO, IntegrationStatusDTO } from './responses/connector.dto'

export { DashboardSchema } from './responses/dashboard.dto'
export type { DashboardDTO } from './responses/dashboard.dto'

export { ApiKeySchema }                                  from './responses/api-key.dto'
export type { ApiKeyDTO }                                  from './responses/api-key.dto'

export { MappingSchema, MappingConditionSchema }            from './responses/mapping.dto'
export type { MappingDTO, MappingConditionDTO }            from './responses/mapping.dto'

export { ActivityItemSchema }                            from './responses/activity.dto'
export type { ActivityItemDTO }                            from './responses/activity.dto'

export { PipelineStages, PipelineStepSchema, EventLogSchema, EventLogDetailSchema } from './responses/event.dto'
export type { PipelineStage, PipelineStepDTO, EventLogDTO, EventLogDetailDTO } from './responses/event.dto'

export { HealthComponentSchema, HealthStatusSchema }        from './responses/health.dto'
export type { HealthStatusDTO, HealthComponentDTO }        from './responses/health.dto'

// ─── Request Contracts (interface + Zod schema) ───────────────────────────────
export { CreateApiKeySchema }    from './requests/create-api-key.contract'
export type { CreateApiKeyRequestDTO } from './requests/create-api-key.contract'

export { CreateMappingSchema }   from './requests/create-mapping.contract'
export type { CreateMappingRequestDTO } from './requests/create-mapping.contract'

export { ReplayEventSchema }     from './requests/replay-event.contract'
export type { ReplayEventRequestDTO } from './requests/replay-event.contract'

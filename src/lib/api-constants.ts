/**
 * Constantes de versionamento da API REST.
 * Altere API_VERSION aqui para migrar toda a plataforma para v2.
 */
export const API_VERSION = 'v1' as const
export const API_BASE    = `/api/${API_VERSION}` as const

/**
 * Códigos de Erro Padronizados para toda a API do FinanceOS.
 * Evita strings soltas e erros de digitação.
 */
export const ApiErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  DUPLICATE_EVENT: 'DUPLICATE_EVENT',
  MAPPING_NOT_FOUND: 'MAPPING_NOT_FOUND',
  INVALID_ORIGIN: 'INVALID_ORIGIN',
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ApiErrorCodeType = typeof ApiErrorCode[keyof typeof ApiErrorCode]

/**
 * Objeto de rotas tipado — nunca concatenar strings de URL no código cliente.
 * Use: API_ROUTES.integrations.events('lucro_simples')
 */
export const API_ROUTES = {
  integrations: {
    list:      ()                           => `${API_BASE}/integrations`,
    dashboard: ()                           => `${API_BASE}/integrations/dashboard`,
    health:    ()                           => `${API_BASE}/integrations/health`,
    connector: (origin: string)             => `${API_BASE}/integrations/${origin}`,
    status:    (origin: string)             => `${API_BASE}/integrations/${origin}/status`,
    events:    (origin: string)             => `${API_BASE}/integrations/${origin}/events`,
    event:     (origin: string, id: string) => `${API_BASE}/integrations/${origin}/events/${id}`,
    mappings:  (origin: string)             => `${API_BASE}/integrations/${origin}/mappings`,
    apiKeys:   (origin: string)             => `${API_BASE}/integrations/${origin}/api-keys`,
  },
  activity: {
    list: () => `${API_BASE}/activity`,     // feed global — não pertence às integrações
  },
} as const

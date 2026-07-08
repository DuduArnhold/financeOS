import { supabase } from '@/lib/supabase'
import { API_ROUTES } from '@/lib/api-constants'
import type { ApiResponse } from '@/lib/api-response'
import type {
  ConnectorSummaryDTO,
  IntegrationStatusDTO,
  ApiKeyDTO,
  MappingDTO,
  ActivityItemDTO,
  EventLogDTO,
  EventLogDetailDTO,
  DashboardDTO,
  HealthStatusDTO,
} from '@/platform/integrations/contracts'

class IntegrationClient {
  private async getHeaders(): Promise<HeadersInit> {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token ?? ''
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    }
  }

  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const headers = await this.getHeaders()
    const res = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    })

    const body = (await res.json()) as ApiResponse<T>
    if (!body.success) {
      throw new Error(body.error.message)
    }
    return body.data
  }

  async listConnectors(): Promise<ConnectorSummaryDTO[]> {
    return this.request<ConnectorSummaryDTO[]>(API_ROUTES.integrations.list())
  }

  async getDashboard(): Promise<DashboardDTO> {
    return this.request<DashboardDTO>(API_ROUTES.integrations.dashboard())
  }

  async getHealth(): Promise<HealthStatusDTO> {
    return this.request<HealthStatusDTO>(API_ROUTES.integrations.health())
  }

  async getStatus(origin: string): Promise<IntegrationStatusDTO> {
    return this.request<IntegrationStatusDTO>(API_ROUTES.integrations.status(origin))
  }

  async listEventLogs(origin: string, status?: string, page = 1, pageSize = 20) {
    let url = API_ROUTES.integrations.events(origin) + `?page=${page}&pageSize=${pageSize}`
    if (status) {
      url += `&status=${status}`
    }
    return this.request<{
      items: EventLogDTO[]
      page: number
      pageSize: number
      total: number
      hasNext: boolean
      hasPrev: boolean
    }>(url)
  }

  async getEventLogDetail(origin: string, eventId: string): Promise<EventLogDetailDTO> {
    return this.request<EventLogDetailDTO>(API_ROUTES.integrations.event(origin, eventId))
  }

  async listMappings(origin: string): Promise<MappingDTO[]> {
    return this.request<MappingDTO[]>(API_ROUTES.integrations.mappings(origin))
  }

  async listApiKeys(origin: string): Promise<ApiKeyDTO[]> {
    return this.request<ApiKeyDTO[]>(API_ROUTES.integrations.apiKeys(origin))
  }

  async listActivity(limit = 10): Promise<ActivityItemDTO[]> {
    return this.request<ActivityItemDTO[]>(API_ROUTES.activity.list() + `?limit=${limit}`)
  }
}

export const integrationClient = new IntegrationClient()
export default integrationClient

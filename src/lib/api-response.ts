import { randomUUID } from 'crypto'
import { API_VERSION, ApiErrorCodeType } from './api-constants'

// ─── Meta ─────────────────────────────────────────────────────────────────────

export interface ApiMeta {
  requestId: string
  timestamp: string
  version: string
  durationMs?: number
  page?: number
  pageSize?: number
  total?: number
  hasNext?: boolean
  hasPrev?: boolean
}

// ─── Discriminated Union ──────────────────────────────────────────────────────

export type ApiResponse<T> =
  | { success: true;  data: T;                                                            meta: ApiMeta }
  | { success: false; error: { code: ApiErrorCodeType; message: string; details?: unknown }; meta: ApiMeta }

// ─── Factories ────────────────────────────────────────────────────────────────

function buildMeta(extra?: Partial<ApiMeta>): ApiMeta {
  return {
    requestId: randomUUID(),
    timestamp: new Date().toISOString(),
    version:   API_VERSION,
    ...extra,
  }
}

/** Resposta de sucesso com envelope padrão. */
export function ok<T>(data: T, meta?: Partial<ApiMeta>): ApiResponse<T> {
  return { success: true, data, meta: buildMeta(meta) }
}

/** Resposta de erro com envelope padrão restringindo a ApiErrorCodeType. */
export function fail<T = never>(
  code: ApiErrorCodeType,
  message: string,
  options?: { meta?: Partial<ApiMeta>; details?: unknown }
): ApiResponse<T> {
  const details = process.env.NODE_ENV !== 'production' ? options?.details : undefined
  return {
    success: false,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
    meta: buildMeta(options?.meta),
  }
}

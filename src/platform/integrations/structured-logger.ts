export interface IntegrationsLog {
  requestId: string
  correlationId: string
  eventId?: string
  connector?: string
  userId?: string
  origin: string
  durationMs?: number
  status: 'ingress' | 'success' | 'failed' | 'rate_limited' | 'revoked'
  message: string
  details?: unknown
  timestamp?: string
}

export class StructuredLogger {
  /**
   * Log estruturado em JSON para produção, com fallback legível para desenvolvimento.
   */
  static log(data: IntegrationsLog) {
    const timestamp = new Date().toISOString()
    const logObject = {
      timestamp,
      ...data,
    }

    if (process.env.NODE_ENV === 'development') {
      const color =
        data.status === 'success' ? '\x1b[32m' // Verde
        : data.status === 'failed' ? '\x1b[31m' // Vermelho
        : data.status === 'rate_limited' ? '\x1b[33m' // Amarelo
        : '\x1b[36m' // Ciano
      const reset = '\x1b[0m'
      console.log(
        `[${timestamp}] ${color}${data.status.toUpperCase()}${reset} [${data.origin}] req=${data.requestId} corr=${data.correlationId} - ${data.message}`,
        data.details ? data.details : ''
      )
    } else {
      console.log(JSON.stringify(logObject))
    }
  }

  static info(requestId: string, correlationId: string, origin: string, message: string, details?: unknown) {
    this.log({ requestId, correlationId, origin, status: 'ingress', message, details })
  }

  static success(requestId: string, correlationId: string, origin: string, message: string, details?: unknown) {
    this.log({ requestId, correlationId, origin, status: 'success', message, details })
  }

  static failed(requestId: string, correlationId: string, origin: string, message: string, details?: unknown) {
    this.log({ requestId, correlationId, origin, status: 'failed', message, details })
  }
}

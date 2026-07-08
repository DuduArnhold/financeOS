// Platform Observability Logger
// Centraliza logs do sistema. Pronto para integrar Sentry/OpenTelemetry no futuro.

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface LogMetadata {
  userId?: string
  module?: string
  correlationId?: string
  [key: string]: unknown
}

const IS_DEV = process.env.NODE_ENV === 'development'

const styles: Record<LogLevel, string> = {
  info:  'color: #6366f1; font-weight: bold;',
  warn:  'color: #f59e0b; font-weight: bold;',
  error: 'color: #f43f5e; font-weight: bold;',
  debug: 'color: #94a3b8; font-weight: bold;',
}

function log(level: LogLevel, message: string, context?: LogMetadata) {
  const timestamp = new Date().toISOString()
  const logPrefix = `[${timestamp}] [${level.toUpperCase()}]`
  
  // Format metadata context fields if present
  let metaString = ''
  if (context) {
    const { userId, module: mod, correlationId } = context
    const parts: string[] = []
    if (userId) parts.push(`user:${userId}`)
    if (mod)    parts.push(`module:${mod}`)
    if (correlationId) parts.push(`correlation:${correlationId}`)
    if (parts.length > 0) {
      metaString = ` [${parts.join(' | ')}]`
    }
  }

  if (IS_DEV) {
    if (context !== undefined) {
      console.log(`%c${logPrefix}${metaString} ${message}`, styles[level], context)
    } else {
      console.log(`%c${logPrefix} ${message}`, styles[level])
    }
  } else {
    // Modo Produção: Atualmente repassa para console padrão.
    // Futuro: Sentry.captureMessage / Send logs to Axiom/OpenTelemetry
    const formattedMessage = `${logPrefix}${metaString} ${message}`
    if (level === 'error') {
      console.error(formattedMessage, context || '')
    } else if (level === 'warn') {
      console.warn(formattedMessage, context || '')
    } else {
      console.log(formattedMessage, context || '')
    }
  }
}

export const logger = {
  info:  (message: string, context?: LogMetadata) => log('info',  message, context),
  warn:  (message: string, context?: LogMetadata) => log('warn',  message, context),
  error: (message: string, context?: LogMetadata) => log('error', message, context),
  debug: (message: string, context?: LogMetadata) => log('debug', message, context),
}

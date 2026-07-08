import { createHmac, randomBytes } from 'crypto'

// Segredo do servidor usado para computar os hashes HMAC.
// Em produção, deve estar definido nas variáveis de ambiente.
const SERVER_SECRET = process.env.SERVER_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-dev-secret-moneybridge-key-12345'

/**
 * Gera uma nova API Key única e criptograficamente segura.
 * Prefixo padrão de visualização: f_key_
 */
export function generateApiKey(): string {
  // 24 bytes aleatórios geram 48 caracteres hexadecimais
  const randomHex = randomBytes(24).toString('hex')
  return `f_key_${randomHex}`
}

/**
 * Gera o hash HMAC-SHA256 de uma chave de API para armazenamento seguro.
 * Este hash impede o vazamento de chaves em caso de dump do banco de dados.
 */
export function hashApiKey(apiKey: string): string {
  if (!apiKey) {
    throw new Error('hashApiKey: a chave de API não pode ser nula ou vazia.')
  }
  return createHmac('sha256', SERVER_SECRET).update(apiKey).digest('hex')
}

/**
 * Higieniza e extrai o primeiro endereço IP real de um cabeçalho HTTP.
 * Faz o fallback ordenado por proxies comuns e o IP da requisição.
 */
export function sanitizeIp(headers: Headers, fallbackIp?: string): string {
  const xForwardedFor = headers.get('x-forwarded-for')
  
  if (xForwardedFor) {
    // x-forwarded-for pode conter múltiplos IPs separados por vírgula.
    // O primeiro IP da lista é o IP real do cliente.
    const parts = xForwardedFor.split(',')
    const firstIp = parts[0]?.trim()
    if (firstIp) return firstIp
  }

  const xRealIp = headers.get('x-real-ip')
  if (xRealIp) return xRealIp.trim()

  return fallbackIp || 'unknown-ip'
}

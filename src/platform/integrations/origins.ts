/**
 * Enum congelado de plataformas emissoras suportadas pelo ecossistema do MoneyBridge.
 * Garante tipagem estrita e evita erros de digitação em rotas ou replays.
 */
export const IntegrationOrigins = {
  LUCRO_SIMPLES: 'lucro_simples',
  MERCADO_LIVRE: 'mercado_livre',
  SHOPEE: 'shopee',
  IFOOD: 'ifood'
} as const

export type IntegrationOrigin = typeof IntegrationOrigins[keyof typeof IntegrationOrigins]

/**
 * Valida se uma string arbitrária é uma origem de integração cadastrada.
 */
export function isValidIntegrationOrigin(origin: string): origin is IntegrationOrigin {
  return Object.values(IntegrationOrigins).includes(origin as IntegrationOrigin)
}

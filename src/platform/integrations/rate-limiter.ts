// TODO: A implementação atual usa memória local (Map).
// Substituir por Redis em produção quando houver múltiplas instâncias do servidor em execução
// para evitar evasão do limite entre instâncias atrás de balanceadores de carga.

export class RateLimiter {
  private static cache = new Map<string, number[]>()
  private static WINDOW_MS = 60 * 1000 // Janela de 1 minuto
  private static DEFAULT_LIMIT = 60    // 60 requisições por minuto

  /**
   * Verifica se a chave excedeu a taxa limite de requisições.
   * Retorna true se a requisição deve ser permitida, false se excedeu o limite.
   */
  static check(key: string, limit = this.DEFAULT_LIMIT): boolean {
    const now = Date.now()
    const timestamps = this.cache.get(key) ?? []

    // Limpa registros anteriores à janela deslizante móvel
    const windowStart = now - this.WINDOW_MS
    const activeTimestamps = timestamps.filter((t) => t > windowStart)

    if (activeTimestamps.length >= limit) {
      this.cache.set(key, activeTimestamps) // Atualiza com os registros limpos
      return false
    }

    // Adiciona o timestamp atual
    activeTimestamps.push(now)
    this.cache.set(key, activeTimestamps)
    return true
  }

  /**
   * Reseta os limites de uma chave (útil para testes unitários/contrato).
   */
  static reset(key: string) {
    this.cache.delete(key)
  }
}

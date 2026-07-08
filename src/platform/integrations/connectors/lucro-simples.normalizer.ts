import { NormalizedSale } from '../../types'

export interface RawLucroSimplesSale {
  valorLiquido: number
  dataFechamento: string
  descricao: string
  vendaId?: string
}

export class LucroSimplesNormalizer {
  /**
   * Converte o payload proprietário do Lucro Simples no contrato NormalizedSale da plataforma.
   *
   * Responsabilidade: validação ESTRUTURAL apenas.
   * O Normalizer responde: "Esse payload faz sentido como dado?"
   * Não decide: "Esse evento de negócio deve ser processado?"
   *
   * Exemplos de regras de negócio que NÃO pertencem aqui:
   * - Ignorar vendas canceladas (decisão do Handler)
   * - Bloquear valor <= 0 (pode ser um estorno válido no futuro)
   * - Enriquecer com dados de cliente (responsabilidade do Connector)
   */
  static normalize(raw: RawLucroSimplesSale): NormalizedSale {
    // Validações estruturais: o campo existe e tem o tipo correto?
    if (raw.valorLiquido === undefined || raw.valorLiquido === null || typeof raw.valorLiquido !== 'number' || isNaN(raw.valorLiquido)) {
      throw new Error('LucroSimplesNormalizer: valorLiquido ausente ou não é um número')
    }
    if (!raw.dataFechamento) {
      throw new Error('LucroSimplesNormalizer: dataFechamento ausente')
    }

    // Formatar dataFechamento (YYYY-MM-DD) → ISO 8601
    let occurredAtIso: string
    try {
      const date = new Date(raw.dataFechamento)
      if (isNaN(date.getTime())) {
        throw new Error('Data inválida')
      }
      occurredAtIso = date.toISOString()
    } catch {
      // Fallback para o dia atual se o parsing falhar
      occurredAtIso = new Date().toISOString()
    }

    return {
      occurredAt: occurredAtIso,
      amount: raw.valorLiquido,   // Pode ser negativo — decisão de negócio é do Handler
      currency: 'BRL',
      description: raw.descricao || 'Fechamento de Caixa Lucro Simples',
      tags: ['lucro_simples']
    }
  }
}

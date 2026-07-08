import type { IntegrationOrigin } from './origins'
import type { ActivityItemDTO } from './contracts'

export class ActivityFormatter {
  /**
   * Transforma o registro bruto do webhook/evento em um feed em linguagem natural.
   */
  static format(event: {
    id: string
    origin: string
    status: string
    payload: unknown
    created_at: string
  }): ActivityItemDTO {
    const p      = event.payload as Record<string, unknown>
    const amount = typeof p?.valorLiquido === 'number' ? p.valorLiquido : null
    const amountStr = amount !== null
      ? `R$ ${amount.toFixed(2).replace('.', ',')}`
      : null

    const severity: ActivityItemDTO['severity'] =
      event.status === 'processed' ? 'success'
      : event.status === 'failed'  ? 'error'
      :                              'warning'

    const icon =
      severity === 'success' ? 'check-circle'
      : severity === 'error' ? 'x-circle'
      : 'alert-circle'

    const color =
      severity === 'success' ? 'text-emerald-400 bg-emerald-500/10'
      : severity === 'error' ? 'text-rose-400 bg-rose-500/10'
      : 'text-amber-400 bg-amber-500/10'

    // Formata o título legível por humanos
    const title =
      event.status === 'processed' ? 'Venda importada'
      : event.status === 'failed'  ? 'Evento rejeitado'
      :                              'Processando evento'

    // Formata a descrição limpa (ex: "R$ 245,50 · Lucro Simples")
    const originLabel = event.origin === 'lucro_simples' ? 'Lucro Simples' : event.origin
    const description = [amountStr, originLabel].filter(Boolean).join(' · ') || null

    return {
      id:          event.id,
      type:        severity,
      severity,
      icon,
      color,
      title,
      description,
      origin:      event.origin as IntegrationOrigin,
      occurredAt:  event.created_at,
    }
  }
}

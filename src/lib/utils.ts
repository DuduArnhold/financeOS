/**
   * Calcula o intervalo de datas do ciclo de faturamento atual com base no dia de fechamento do usuário.
   */
export function getBillingCycleRange(closingDay: number): { startDate: Date; endDate: Date } {
  const now = new Date()
  let startYear = now.getFullYear()
  let startMonth = now.getMonth() // 0-indexed (Janeiro = 0)

  // Se o dia atual for menor que o dia de fechamento, o ciclo começou no mês anterior
  if (now.getDate() < closingDay) {
    startMonth -= 1
    if (startMonth < 0) {
      startMonth = 11
      startYear -= 1
    }
  }

  // Define a data de início do ciclo
  const lastDayOfStartMonth = new Date(startYear, startMonth + 1, 0).getDate()
  const actualStartDay = Math.min(closingDay, lastDayOfStartMonth)
  const startDate = new Date(startYear, startMonth, actualStartDay, 0, 0, 0, 0)

  // O ciclo termina no dia anterior ao início do próximo ciclo
  let endYear = startYear
  let endMonth = startMonth + 1
  if (endMonth > 11) {
    endMonth = 0
    endYear += 1
  }
  
  const lastDayOfEndMonth = new Date(endYear, endMonth + 1, 0).getDate()
  const actualEndDay = Math.min(closingDay, lastDayOfEndMonth)
  
  // Data de início do próximo ciclo
  const nextCycleStartDate = new Date(endYear, endMonth, actualEndDay, 0, 0, 0, 0)
  
  // Data final do ciclo atual (um milissegundo antes de começar o próximo)
  const endDate = new Date(nextCycleStartDate.getTime() - 1)

  return { startDate, endDate }
}

/**
 * Formata um valor numérico para exibição de moeda.
 */
export function formatCurrency(value: number, symbol: string = 'R$'): string {
  if (value === undefined || value === null || isNaN(value)) {
    value = 0
  }
  return `${symbol} ${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Formata uma string de data do banco para exibição legível (DD/MM).
 */
export function formatDateLabel(dateString: string): string {
  if (!dateString) return ''
  const [, month, day] = dateString.split('-')
  return `${day}/${month}`
}

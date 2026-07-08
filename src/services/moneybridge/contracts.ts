// MoneyBridge Integration Layer Contracts
// Define as assinaturas e DTOs padrão para importação de transações bancárias e conciliação.

export interface BankAccountSnapshot {
  bankId: string         // ex: 'nubank', 'itau'
  accountNumber: string
  balance: number
  currency: string
  updatedAt: string
}

export interface BankTransactionImport {
  externalId: string     // ID único fornecido pela instituição / OFX
  date: string           // YYYY-MM-DD
  amount: number         // positivo para receita, negativo para despesa
  description: string
  categorySuggestion?: string
  memo?: string
}

export interface OFXParserResult {
  account: BankAccountSnapshot
  transactions: BankTransactionImport[]
}

export interface MoneyBridgeConnector {
  connectorId: string
  name: string
  isAvailable: boolean
  
  // Métodos básicos de integração
  syncAccount(credentials: unknown): Promise<BankAccountSnapshot>
  fetchTransactions(startDate: string, endDate: string): Promise<BankTransactionImport[]>
}

export interface CSVParserConfig {
  delimiter: string
  dateColumn: number
  amountColumn: number
  descriptionColumn: number
  dateFormat: string
}

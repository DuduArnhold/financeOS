import { accountRepository, Account } from '@/repositories/account.repository'
import { ServiceResult } from './conta.service'

export const accountService = {
  async getActiveAccounts(userId: string): Promise<ServiceResult<Account[]>> {
    try {
      const data = await accountRepository.getActiveAccounts(userId)
      return { success: true, data }
    } catch (err: any) {
      console.error('Error in getActiveAccounts service:', err)
      return { success: false, error: err.message || 'Erro ao carregar contas financeiras.' }
    }
  }
}

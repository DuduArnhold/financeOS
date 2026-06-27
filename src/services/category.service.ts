import { categoryRepository, Category } from '@/repositories/category.repository'
import { ServiceResult } from './conta.service'

export const categoryService = {
  async getCategoriesByType(userId: string, tipo: 'receita' | 'despesa'): Promise<ServiceResult<Category[]>> {
    try {
      const data = await categoryRepository.getByType(userId, tipo)
      return { success: true, data }
    } catch (err: any) {
      console.error('Error in getCategoriesByType service:', err)
      return { success: false, error: err.message || 'Erro ao carregar categorias.' }
    }
  }
}

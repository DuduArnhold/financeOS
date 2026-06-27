import { supabase } from '@/lib/supabase'

export interface Category {
  id: string
  userId: string | null
  nome: string
  tipo: 'receita' | 'despesa' | 'ambos'
  cor: string | null
  icone: string | null
  ordem: number
  createdAt?: string
}

export const categoryRepository = {
  async getByType(userId: string, tipo: 'receita' | 'despesa'): Promise<Category[]> {
    const { data, error } = await supabase
      .from('finance_categories')
      .select('*')
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .in('tipo', [tipo, 'ambos'])
      .order('ordem', { ascending: true })

    if (error) throw error
    return (data || []).map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      nome: d.nome,
      tipo: d.tipo,
      cor: d.cor,
      icone: d.icone,
      ordem: d.ordem,
      createdAt: d.created_at,
    }))
  }
}

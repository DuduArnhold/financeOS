import { supabase } from '@/lib/supabase'

export interface Account {
  id: string
  userId: string
  nome: string
  saldoInicial: number
  tipo: 'Banco' | 'Carteira' | 'Dinheiro' | 'Investimento' | 'Outro'
  cor: string | null
  ativo: boolean
  createdAt?: string
}

interface DbAccount {
  id: string
  user_id: string
  nome: string
  saldo_inicial: number | string
  tipo: Account['tipo']
  cor: string | null
  ativo: boolean
  created_at: string
}

export const accountRepository = {
  async getActiveAccounts(userId: string): Promise<Account[]> {
    const { data, error } = await supabase
      .from('finance_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('ativo', true)
      .order('nome', { ascending: true })

    if (error) throw error
    const dbData = data as DbAccount[] | null
    return (dbData || []).map((d) => ({
      id: d.id,
      userId: d.user_id,
      nome: d.nome,
      saldoInicial: Number(d.saldo_inicial),
      tipo: d.tipo,
      cor: d.cor,
      ativo: d.ativo,
      createdAt: d.created_at,
    }))
  }
}

import { supabase } from '@/lib/supabase'

export interface Transfer {
  id: string
  userId: string
  sourceAccountId: string
  targetAccountId: string
  valor: number
  data: string
  descricao: string | null
  createdAt?: string
  
  // Joined fields
  sourceAccount?: {
    nome: string
  } | null
  targetAccount?: {
    nome: string
  } | null
}

interface DbTransfer {
  id: string
  user_id: string
  source_account_id: string
  target_account_id: string
  valor: number | string
  data: string
  descricao: string | null
  created_at: string
  source_account?: {
    nome: string
  } | null
  target_account?: {
    nome: string
  } | null
}

const mapToCamel = (data: DbTransfer): Transfer => ({
  id: data.id,
  userId: data.user_id,
  sourceAccountId: data.source_account_id,
  targetAccountId: data.target_account_id,
  valor: Number(data.valor),
  data: data.data,
  descricao: data.descricao,
  createdAt: data.created_at,
  sourceAccount: data.source_account ? {
    nome: data.source_account.nome,
  } : null,
  targetAccount: data.target_account ? {
    nome: data.target_account.nome,
  } : null,
})

export const transferRepository = {
  async getAll(userId: string): Promise<Transfer[]> {
    const { data, error } = await supabase
      .from('finance_transfers')
      .select(`
        *,
        source_account:source_account_id (nome),
        target_account:target_account_id (nome)
      `)
      .eq('user_id', userId)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    const dbData = data as DbTransfer[] | null
    return (dbData || []).map(mapToCamel)
  },

  async getById(id: string, userId: string): Promise<Transfer | null> {
    const { data, error } = await supabase
      .from('finance_transfers')
      .select(`
        *,
        source_account:source_account_id (nome),
        target_account:target_account_id (nome)
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    return data ? mapToCamel(data as DbTransfer) : null
  },

  async insert(
    transfer: Omit<Transfer, 'id' | 'createdAt'>
  ): Promise<Transfer> {
    const { data, error } = await supabase
      .from('finance_transfers')
      .insert({
        user_id: transfer.userId,
        source_account_id: transfer.sourceAccountId,
        target_account_id: transfer.targetAccountId,
        valor: transfer.valor,
        data: transfer.data,
        descricao: transfer.descricao,
      })
      .select(`
        *,
        source_account:source_account_id (nome),
        target_account:target_account_id (nome)
      `)
      .single()

    if (error) throw error
    return mapToCamel(data as DbTransfer)
  },

  async delete(id: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('finance_transfers')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error
  }
}

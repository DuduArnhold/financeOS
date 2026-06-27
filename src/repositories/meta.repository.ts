import { supabase } from '@/lib/supabase'

export interface Meta {
  id: string
  userId: string
  nome: string
  valorMeta: number
  createdAt?: string
}

export interface Deposit {
  id: string
  metaId: string
  valor: number
  data: string
  createdAt?: string
}

export const metaRepository = {
  async getAll(userId: string): Promise<Meta[]> {
    const { data, error } = await supabase
      .from('finance_metas')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return (data || []).map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      nome: d.nome,
      valorMeta: Number(d.valor_meta),
      createdAt: d.created_at,
    }))
  },

  async getById(id: string, userId: string): Promise<Meta | null> {
    const { data, error } = await supabase
      .from('finance_metas')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    if (!data) return null
    return {
      id: data.id,
      userId: data.user_id,
      nome: data.nome,
      valorMeta: Number(data.valor_meta),
      createdAt: data.created_at,
    }
  },

  async insert(meta: Omit<Meta, 'id' | 'createdAt'>): Promise<Meta> {
    const { data, error } = await supabase
      .from('finance_metas')
      .insert({
        user_id: meta.userId,
        nome: meta.nome,
        valor_meta: meta.valorMeta,
      })
      .select()
      .single()

    if (error) throw error
    return {
      id: data.id,
      userId: data.user_id,
      nome: data.nome,
      valorMeta: Number(data.valor_meta),
      createdAt: data.created_at,
    }
  },

  async update(id: string, userId: string, meta: Partial<Omit<Meta, 'id' | 'userId' | 'createdAt'>>): Promise<Meta> {
    const updateData: any = {}
    if (meta.nome !== undefined) updateData.nome = meta.nome
    if (meta.valorMeta !== undefined) updateData.valor_meta = meta.valorMeta

    const { data, error } = await supabase
      .from('finance_metas')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return {
      id: data.id,
      userId: data.user_id,
      nome: data.nome,
      valorMeta: Number(data.valor_meta),
      createdAt: data.created_at,
    }
  },

  async delete(id: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('finance_metas')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error
  },

  // Deposits API
  async getAllDeposits(userId: string): Promise<Deposit[]> {
    // Rely on RLS security to only get the user's deposits, or join with metas
    // To be 100% safe, we can join or select directly (RLS is already configured to check auth.uid() = user_id on metas)
    const { data, error } = await supabase
      .from('finance_goal_deposits')
      .select('*, finance_metas!inner(user_id)')
      .eq('finance_metas.user_id', userId)

    if (error) throw error
    return (data || []).map((d: any) => ({
      id: d.id,
      metaId: d.meta_id,
      valor: Number(d.valor),
      data: d.data,
      createdAt: d.created_at,
    }))
  },

  async insertDeposit(deposit: Omit<Deposit, 'id' | 'createdAt'>): Promise<Deposit> {
    const { data, error } = await supabase
      .from('finance_goal_deposits')
      .insert({
        meta_id: deposit.metaId,
        valor: deposit.valor,
        data: deposit.data,
      })
      .select()
      .single()

    if (error) throw error
    return {
      id: data.id,
      metaId: data.meta_id,
      valor: Number(data.valor),
      data: data.data,
      createdAt: data.created_at,
    }
  }
}

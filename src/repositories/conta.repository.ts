import { supabase } from '@/lib/supabase'

export interface Conta {
  id: string
  userId: string
  nome: string
  valor: number
  vencimento: string
  paga: boolean
  recorrente: boolean
  paidAt?: string | null
  categoriaPreferidaId?: string | null
  createdAt?: string
  updatedAt?: string
  deletedAt?: string | null
}

const mapToCamel = (data: any): Conta => ({
  id: data.id,
  userId: data.user_id,
  nome: data.nome,
  valor: Number(data.valor),
  vencimento: data.vencimento,
  paga: data.paga,
  recorrente: data.recorrente,
  paidAt: data.paid_at,
  categoriaPreferidaId: data.categoria_preferida_id,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
  deletedAt: data.deleted_at,
})

export const contaRepository = {
  async getAll(userId: string): Promise<Conta[]> {
    const { data, error } = await supabase
      .from('finance_contas')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('vencimento', { ascending: true })

    if (error) throw error
    return (data || []).map(mapToCamel)
  },

  async getById(id: string, userId: string): Promise<Conta | null> {
    const { data, error } = await supabase
      .from('finance_contas')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw error
    return data ? mapToCamel(data) : null
  },

  async insert(conta: Omit<Conta, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<Conta> {
    const { data, error } = await supabase
      .from('finance_contas')
      .insert({
        user_id: conta.userId,
        nome: conta.nome,
        valor: conta.valor,
        vencimento: conta.vencimento,
        paga: conta.paga,
        recorrente: conta.recorrente,
        categoria_preferida_id: conta.categoriaPreferidaId,
      })
      .select()
      .single()

    if (error) throw error
    return mapToCamel(data)
  },

  async update(id: string, userId: string, conta: Partial<Omit<Conta, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'deletedAt'>>): Promise<Conta> {
    const updateData: any = {}
    if (conta.nome !== undefined) updateData.nome = conta.nome
    if (conta.valor !== undefined) updateData.valor = conta.valor
    if (conta.vencimento !== undefined) updateData.vencimento = conta.vencimento
    if (conta.paga !== undefined) updateData.paga = conta.paga
    if (conta.recorrente !== undefined) updateData.recorrente = conta.recorrente
    if (conta.categoriaPreferidaId !== undefined) updateData.categoria_preferida_id = conta.categoriaPreferidaId
    if (conta.paidAt !== undefined) updateData.paid_at = conta.paidAt

    const { data, error } = await supabase
      .from('finance_contas')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return mapToCamel(data)
  },

  async softDelete(id: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('finance_contas')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error
  },

  async pay(
    contaId: string,
    userId: string,
    accountId: string,
    categoriaId: string,
    formaPagamento: string,
    data: string,
    observacao: string
  ): Promise<void> {
    const { error } = await supabase.rpc('pay_conta', {
      p_conta_id: contaId,
      p_user_id: userId,
      p_account_id: accountId,
      p_categoria_id: categoriaId,
      p_forma_pagamento: formaPagamento,
      p_data: data,
      p_observacao: observacao,
    })

    if (error) throw error
  },

  async unpay(contaId: string, userId: string, deleteMovement: boolean): Promise<void> {
    const { error } = await supabase.rpc('unpay_conta', {
      p_conta_id: contaId,
      p_user_id: userId,
      p_delete_movement: deleteMovement,
    })

    if (error) throw error
  }
}

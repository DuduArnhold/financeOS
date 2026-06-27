import { supabase } from '@/lib/supabase'

export interface Movement {
  id: string
  userId: string
  tipo: 'receita' | 'despesa'
  valor: number
  categoriaId: string | null
  accountId: string
  formaPagamento: string
  data: string
  descricao: string | null
  contaId?: string | null
  origem: 'manual' | 'conta' | 'lucro_simples' | 'ofx' | 'csv' | 'open_finance' | 'pix' | 'transferencia'
  origemUuid?: string | null
  origemRef?: string | null
  createdAt?: string
  updatedAt?: string
  deletedAt?: string | null

  // Joined fields
  financeCategories?: {
    nome: string
    cor: string
    icone?: string
  } | null
  financeAccounts?: {
    nome: string
  } | null
}

const mapToCamel = (data: any): Movement => ({
  id: data.id,
  userId: data.user_id,
  tipo: data.tipo,
  valor: Number(data.valor),
  categoriaId: data.categoria_id,
  accountId: data.account_id,
  formaPagamento: data.forma_pagamento,
  data: data.data,
  descricao: data.descricao,
  contaId: data.conta_id,
  origem: data.origem,
  origemUuid: data.origem_uuid,
  origemRef: data.origem_ref,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
  deletedAt: data.deleted_at,
  financeCategories: data.finance_categories ? {
    nome: data.finance_categories.nome,
    cor: data.finance_categories.cor,
    icone: data.finance_categories.icone,
  } : null,
  financeAccounts: data.finance_accounts ? {
    nome: data.finance_accounts.nome,
  } : null,
})

export const movementRepository = {
  async getAll(
    userId: string,
    tipo?: 'receita' | 'despesa',
    range?: { startDate: string; endDate: string },
    limit?: number
  ): Promise<Movement[]> {
    let query = supabase
      .from('finance_movements')
      .select(`
        *,
        finance_categories:categoria_id (nome, cor, icone),
        finance_accounts:account_id (nome)
      `)
      .eq('user_id', userId)
      .is('deleted_at', null)

    if (tipo) {
      query = query.eq('tipo', tipo)
    }

    if (range) {
      query = query.gte('data', range.startDate).lte('data', range.endDate)
    }

    query = query.order('data', { ascending: false }).order('created_at', { ascending: false })

    if (limit) {
      query = query.limit(limit)
    }

    const { data, error } = await query
    if (error) throw error
    return (data || []).map(mapToCamel)
  },

  async getById(id: string, userId: string): Promise<Movement | null> {
    const { data, error } = await supabase
      .from('finance_movements')
      .select(`
        *,
        finance_categories:categoria_id (nome, cor, icone),
        finance_accounts:account_id (nome)
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw error
    return data ? mapToCamel(data) : null
  },

  async insert(movement: Omit<Movement, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<Movement> {
    const { data, error } = await supabase
      .from('finance_movements')
      .insert({
        user_id: movement.userId,
        tipo: movement.tipo,
        valor: movement.valor,
        categoria_id: movement.categoriaId,
        account_id: movement.accountId,
        forma_pagamento: movement.formaPagamento,
        data: movement.data,
        descricao: movement.descricao,
        conta_id: movement.contaId,
        origem: movement.origem,
        origem_uuid: movement.origemUuid,
        origem_ref: movement.origemRef,
      })
      .select(`
        *,
        finance_categories:categoria_id (nome, cor, icone),
        finance_accounts:account_id (nome)
      `)
      .single()

    if (error) throw error
    return mapToCamel(data)
  },

  async update(
    id: string,
    userId: string,
    movement: Partial<Omit<Movement, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'deletedAt'>>
  ): Promise<Movement> {
    const updateData: any = {}
    if (movement.tipo !== undefined) updateData.tipo = movement.tipo
    if (movement.valor !== undefined) updateData.valor = movement.valor
    if (movement.categoriaId !== undefined) updateData.categoria_id = movement.categoriaId
    if (movement.accountId !== undefined) updateData.account_id = movement.accountId
    if (movement.formaPagamento !== undefined) updateData.forma_pagamento = movement.formaPagamento
    if (movement.data !== undefined) updateData.data = movement.data
    if (movement.descricao !== undefined) updateData.descricao = movement.descricao
    if (movement.contaId !== undefined) updateData.conta_id = movement.contaId
    if (movement.origem !== undefined) updateData.origem = movement.origem
    if (movement.origemUuid !== undefined) updateData.origem_uuid = movement.origemUuid
    if (movement.origemRef !== undefined) updateData.origem_ref = movement.origemRef

    const { data, error } = await supabase
      .from('finance_movements')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select(`
        *,
        finance_categories:categoria_id (nome, cor, icone),
        finance_accounts:account_id (nome)
      `)
      .single()

    if (error) throw error
    return mapToCamel(data)
  },

  async softDelete(id: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('finance_movements')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error
  }
}

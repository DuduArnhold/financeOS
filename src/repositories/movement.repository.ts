import { supabase } from '@/lib/supabase'
import { SupabaseClient } from '@supabase/supabase-js'

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

interface DbMovement {
  id: string
  user_id: string
  tipo: Movement['tipo']
  valor: number | string
  categoria_id: string | null
  account_id: string
  forma_pagamento: string
  data: string
  descricao: string | null
  conta_id?: string | null
  origem: Movement['origem']
  origem_uuid?: string | null
  origem_ref?: string | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
  finance_categories?: {
    nome: string
    cor: string
    icone?: string
  } | null
  finance_accounts?: {
    nome: string
  } | null
}

const mapToCamel = (data: DbMovement): Movement => ({
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

// ─── Contrato (Interface) do Repositório Financeiro ───────────────────────────

export interface IMovementRepository {
  getAll(userId: string, tipo?: 'receita' | 'despesa', range?: { startDate: string; endDate: string }, limit?: number): Promise<Movement[]>
  getById(id: string, userId: string): Promise<Movement | null>
  getByOrigemRef(userId: string, origin: string, origemRef: string): Promise<Movement | null>
  insert(movement: Omit<Movement, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<Movement>
  update(id: string, userId: string, movement: Partial<Omit<Movement, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'deletedAt'>>): Promise<Movement>
  softDelete(id: string, userId: string): Promise<void>
  deleteByTransfer(transferId: string, userId: string): Promise<void>
}

// ─── Implementação Supabase (produção) ────────────────────────────────────────

export class SupabaseMovementRepository implements IMovementRepository {
  constructor(private readonly client: SupabaseClient = supabase) {}

  async getAll(
    userId: string,
    tipo?: 'receita' | 'despesa',
    range?: { startDate: string; endDate: string },
    limit?: number
  ): Promise<Movement[]> {
    let query = this.client
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
  }

  async getById(id: string, userId: string): Promise<Movement | null> {
    const { data, error } = await this.client
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
  }

  async insert(movement: Omit<Movement, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<Movement> {
    const { data, error } = await this.client
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
    return mapToCamel(data as DbMovement)
  }

  async update(
    id: string,
    userId: string,
    movement: Partial<Omit<Movement, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'deletedAt'>>
  ): Promise<Movement> {
    const updateData: Partial<DbMovement> = {}
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

    const { data, error } = await this.client
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
    return mapToCamel(data as DbMovement)
  }

  async softDelete(id: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from('finance_movements')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error
  }

  async deleteByTransfer(transferId: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from('finance_movements')
      .update({ deleted_at: new Date().toISOString() })
      .eq('origem', 'transferencia')
      .eq('origem_uuid', transferId)
      .eq('user_id', userId)

    if (error) throw error
  }

  // TODO: Temporary implementation. Waiting migration for finance_movements status (ACTIVE/CANCELLED/REFUNDED).
  async getByOrigemRef(userId: string, origin: string, origemRef: string): Promise<Movement | null> {
    const { data, error } = await this.client
      .from('finance_movements')
      .select(`
        *,
        finance_categories:categoria_id (nome, cor, icone),
        finance_accounts:account_id (nome)
      `)
      .eq('user_id', userId)
      .eq('origem', origin)
      .eq('origem_ref', origemRef)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw error
    return data ? mapToCamel(data as DbMovement) : null
  }
}

// ─── Implementação em Memória (para simulação de infraestrutura) ──────────────

export class MemoryMovementRepository implements IMovementRepository {
  private movements: Movement[] = []

  async getAll(userId: string): Promise<Movement[]> {
    return this.movements.filter(m => m.userId === userId && !m.deletedAt)
  }

  async getById(id: string, userId: string): Promise<Movement | null> {
    return this.movements.find(m => m.id === id && m.userId === userId && !m.deletedAt) || null
  }

  async insert(movement: Omit<Movement, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<Movement> {
    const record: Movement = {
      ...movement,
      id: `mov_mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      financeAccounts: { nome: 'Minha Carteira (Simulada)' },
      financeCategories: { nome: 'Venda (Simulada)', cor: '#10b981' }
    }
    this.movements.push(record)
    return record
  }

  async update(id: string, userId: string, movement: Partial<Movement>): Promise<Movement> {
    const idx = this.movements.findIndex(m => m.id === id && m.userId === userId)
    if (idx === -1) throw new Error('Movimentação não encontrada')
    const updated = {
      ...this.movements[idx],
      ...movement,
      updatedAt: new Date().toISOString()
    }
    this.movements[idx] = updated
    return updated
  }

  async softDelete(id: string, userId: string): Promise<void> {
    const idx = this.movements.findIndex(m => m.id === id && m.userId === userId)
    if (idx !== -1) {
      this.movements[idx].deletedAt = new Date().toISOString()
    }
  }

  async deleteByTransfer(transferId: string, userId: string): Promise<void> {
    this.movements = this.movements.filter(
      m => !(m.origem === 'transferencia' && m.origemUuid === transferId && m.userId === userId)
    )
  }

  // TODO: Temporary implementation. Waiting migration for finance_movements status (ACTIVE/CANCELLED/REFUNDED).
  async getByOrigemRef(userId: string, origin: string, origemRef: string): Promise<Movement | null> {
    return this.movements.find(
      m => m.userId === userId && m.origem === origin && m.origemRef === origemRef && !m.deletedAt
    ) || null
  }
}

// ─── Singleton Proxy e Switches de Implementação ─────────────────────────────

let activeRepository: IMovementRepository = new SupabaseMovementRepository()

export function setMovementRepository(repo: IMovementRepository): void {
  activeRepository = repo
}

export const movementRepository: IMovementRepository = {
  getAll: (userId, tipo, range, limit) => activeRepository.getAll(userId, tipo, range, limit),
  getById: (id, userId) => activeRepository.getById(id, userId),
  getByOrigemRef: (userId, origin, origemRef) => activeRepository.getByOrigemRef(userId, origin, origemRef),
  insert: (m) => activeRepository.insert(m),
  update: (id, userId, m) => activeRepository.update(id, userId, m),
  softDelete: (id, userId) => activeRepository.softDelete(id, userId),
  deleteByTransfer: (transferId, userId) => activeRepository.deleteByTransfer(transferId, userId)
}

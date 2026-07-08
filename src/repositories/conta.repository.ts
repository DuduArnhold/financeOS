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

interface DbConta {
  id: string
  user_id: string
  nome: string
  valor: number | string
  vencimento: string
  paga: boolean
  recorrente: boolean
  paid_at?: string | null
  categoria_preferida_id?: string | null
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

const mapToCamel = (data: DbConta): Conta => ({
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

// ─── Contrato (Interface) do Repositório de Contas ────────────────────────────

export interface IContaRepository {
  getAll(userId: string): Promise<Conta[]>
  getById(id: string, userId: string): Promise<Conta | null>
  insert(conta: Omit<Conta, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<Conta>
  update(id: string, userId: string, conta: Partial<Omit<Conta, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'deletedAt'>>): Promise<Conta>
  softDelete(id: string, userId: string): Promise<void>
  pay(
    contaId: string,
    userId: string,
    accountId: string,
    categoriaId: string,
    formaPagamento: string,
    data: string,
    observacao: string
  ): Promise<void>
  unpay(contaId: string, userId: string, deleteMovement: boolean): Promise<void>
  saveReference(contaId: string, userId: string, refId: string): Promise<void>
  getByReference(userId: string, refId: string): Promise<Conta | null>
}

// ─── Implementação Supabase (produção) ────────────────────────────────────────

export class SupabaseContaRepository implements IContaRepository {
  async getAll(userId: string): Promise<Conta[]> {
    const { data, error } = await supabase
      .from('finance_contas')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('vencimento', { ascending: true })

    if (error) throw error
    const dbData = data as DbConta[] | null
    return (dbData || []).map(mapToCamel)
  }

  async getById(id: string, userId: string): Promise<Conta | null> {
    const { data, error } = await supabase
      .from('finance_contas')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw error
    return data ? mapToCamel(data as DbConta) : null
  }

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
    return mapToCamel(data as DbConta)
  }

  async update(id: string, userId: string, conta: Partial<Omit<Conta, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'deletedAt'>>): Promise<Conta> {
    const updateData: Partial<DbConta> = {}
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
    return mapToCamel(data as DbConta)
  }

  async softDelete(id: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('finance_contas')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error
  }

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
  }

  async unpay(contaId: string, userId: string, deleteMovement: boolean): Promise<void> {
    const { error } = await supabase.rpc('unpay_conta', {
      p_conta_id: contaId,
      p_user_id: userId,
      p_delete_movement: deleteMovement,
    })

    if (error) throw error
  }

  // TODO: Temporary implementation. Replacing with Integration References central table in the future.
  async saveReference(contaId: string, userId: string, refId: string): Promise<void> {
    const { data: current } = await supabase
      .from('finance_contas')
      .select('nome')
      .eq('id', contaId)
      .eq('user_id', userId)
      .single()

    const name = current?.nome ? `${current.nome} [Ref: ${refId}]` : `[Ref: ${refId}]`

    const { error } = await supabase
      .from('finance_contas')
      .update({ nome: name })
      .eq('id', contaId)
      .eq('user_id', userId)

    if (error) throw error
  }

  // TODO: Temporary implementation. Replacing with Integration References central table in the future.
  async getByReference(userId: string, refId: string): Promise<Conta | null> {
    const { data, error } = await supabase
      .from('finance_contas')
      .select('*')
      .eq('user_id', userId)
      .like('nome', `%[Ref: ${refId}]%`)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw error
    return data ? mapToCamel(data as DbConta) : null
  }
}

// ─── Implementação em Memória (para simulação de infraestrutura) ──────────────

export class MemoryContaRepository implements IContaRepository {
  private contas: Conta[] = []

  async getAll(userId: string): Promise<Conta[]> {
    return this.contas.filter(c => c.userId === userId && !c.deletedAt)
  }

  async getById(id: string, userId: string): Promise<Conta | null> {
    return this.contas.find(c => c.id === id && c.userId === userId && !c.deletedAt) || null
  }

  async insert(conta: Omit<Conta, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<Conta> {
    const record: Conta = {
      ...conta,
      id: `conta_mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null
    }
    this.contas.push(record)
    return record
  }

  async update(id: string, userId: string, conta: Partial<Conta>): Promise<Conta> {
    const idx = this.contas.findIndex(c => c.id === id && c.userId === userId)
    if (idx === -1) throw new Error('Conta não encontrada')
    const updated = {
      ...this.contas[idx],
      ...conta,
      updatedAt: new Date().toISOString()
    }
    this.contas[idx] = updated
    return updated
  }

  async softDelete(id: string, userId: string): Promise<void> {
    const idx = this.contas.findIndex(c => c.id === id && c.userId === userId)
    if (idx !== -1) {
      this.contas[idx].deletedAt = new Date().toISOString()
    }
  }

  // Simulação de baixa transacional local
  async pay(
    contaId: string,
    userId: string,
    accountId: string,
    categoriaId: string,
    formaPagamento: string,
    data: string,
    observacao: string
  ): Promise<void> {
    const idx = this.contas.findIndex(c => c.id === contaId && c.userId === userId)
    if (idx === -1) throw new Error('Conta não encontrada para pagamento')
    
    this.contas[idx] = {
      ...this.contas[idx],
      paga: true,
      paidAt: new Date().toISOString(),
      categoriaPreferidaId: categoriaId
    }

    // Nota: O teste simula a inserção da despesa na carteira de movimentação manualmente
    // pois o pay_conta real está no banco de dados.
  }

  async unpay(contaId: string, userId: string, deleteMovement: boolean): Promise<void> {
    const idx = this.contas.findIndex(c => c.id === contaId && c.userId === userId)
    if (idx === -1) throw new Error('Conta não encontrada para estornar pagamento')
    
    this.contas[idx] = {
      ...this.contas[idx],
      paga: false,
      paidAt: null
    }
  }

  async saveReference(contaId: string, userId: string, refId: string): Promise<void> {
    const idx = this.contas.findIndex(c => c.id === contaId && c.userId === userId)
    if (idx !== -1) {
      const current = this.contas[idx]
      const name = current.nome ? `${current.nome} [Ref: ${refId}]` : `[Ref: ${refId}]`
      this.contas[idx] = {
        ...current,
        nome: name,
        updatedAt: new Date().toISOString()
      }
    }
  }

  async getByReference(userId: string, refId: string): Promise<Conta | null> {
    return this.contas.find(
      c => c.userId === userId && c.nome?.includes(`[Ref: ${refId}]`) && !c.deletedAt
    ) || null
  }
}

// ─── Singleton Proxy e Switches de Implementação ─────────────────────────────

let activeRepository: IContaRepository = new SupabaseContaRepository()

export function setContaRepository(repo: IContaRepository): void {
  activeRepository = repo
}

export const contaRepository: IContaRepository = {
  getAll: (userId) => activeRepository.getAll(userId),
  getById: (id, userId) => activeRepository.getById(id, userId),
  insert: (c) => activeRepository.insert(c),
  update: (id, userId, c) => activeRepository.update(id, userId, c),
  softDelete: (id, userId) => activeRepository.softDelete(id, userId),
  pay: (contaId, userId, accId, catId, fp, d, obs) => activeRepository.pay(contaId, userId, accId, catId, fp, d, obs),
  unpay: (contaId, userId, del) => activeRepository.unpay(contaId, userId, del),
  saveReference: (contaId, userId, refId) => activeRepository.saveReference(contaId, userId, refId),
  getByReference: (userId, refId) => activeRepository.getByReference(userId, refId)
}

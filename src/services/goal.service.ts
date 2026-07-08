import { metaRepository, Deposit } from '@/repositories/meta.repository'
import { ServiceResult } from './conta.service'

export interface MetaConsolidated {
  id: string
  nome: string
  valorMeta: number
  valorAtual: number
}

export const goalService = {
  async getMetas(userId: string): Promise<ServiceResult<MetaConsolidated[]>> {
    try {
      const metas = await metaRepository.getAll(userId)
      const deposits = await metaRepository.getAllDeposits(userId)

      const depositsMap: { [metaId: string]: number } = {}
      deposits.forEach((dep) => {
        depositsMap[dep.metaId] = (depositsMap[dep.metaId] || 0) + dep.valor
      })

      const consolidated: MetaConsolidated[] = metas.map((meta) => ({
        id: meta.id,
        nome: meta.nome,
        valorMeta: meta.valorMeta,
        valorAtual: depositsMap[meta.id] || 0,
      }))

      return { success: true, data: consolidated }
    } catch (err) {
      console.error('Error in getMetas service:', err)
      const errorMsg = err instanceof Error ? err.message : 'Erro ao carregar metas.'
      return { success: false, error: errorMsg }
    }
  },

  async createMeta(
    userId: string,
    nome: string,
    valorMeta: number,
    valorInicial: number
  ): Promise<ServiceResult<MetaConsolidated>> {
    try {
      if (!nome.trim()) {
        return { success: false, error: 'O nome do objetivo é obrigatório.' }
      }
      if (valorMeta <= 0) {
        return { success: false, error: 'O valor da meta deve ser maior que zero.' }
      }

      const newMeta = await metaRepository.insert({
        userId,
        nome: nome.trim(),
        valorMeta,
      })

      let valorAtual = 0
      if (valorInicial > 0) {
        const deposit = await metaRepository.insertDeposit({
          metaId: newMeta.id,
          valor: valorInicial,
          data: new Date().toISOString().split('T')[0],
        })
        valorAtual = deposit.valor
      }

      return {
        success: true,
        data: {
          id: newMeta.id,
          nome: newMeta.nome,
          valorMeta: newMeta.valorMeta,
          valorAtual,
        },
      }
    } catch (err) {
      console.error('Error in createMeta service:', err)
      const errorMsg = err instanceof Error ? err.message : 'Erro ao criar meta.'
      return { success: false, error: errorMsg }
    }
  },

  async updateMeta(
    id: string,
    userId: string,
    nome: string,
    valorMeta: number
  ): Promise<ServiceResult<MetaConsolidated>> {
    try {
      if (!nome.trim()) {
        return { success: false, error: 'O nome do objetivo é obrigatório.' }
      }
      if (valorMeta <= 0) {
        return { success: false, error: 'O valor da meta deve ser maior que zero.' }
      }

      const updatedMeta = await metaRepository.update(id, userId, {
        nome: nome.trim(),
        valorMeta,
      })

      // We need to calculate the current value since update doesn't change deposits
      const deposits = await metaRepository.getAllDeposits(userId)
      const valorAtual = deposits
        .filter((d) => d.metaId === id)
        .reduce((sum, d) => sum + d.valor, 0)

      return {
        success: true,
        data: {
          id: updatedMeta.id,
          nome: updatedMeta.nome,
          valorMeta: updatedMeta.valorMeta,
          valorAtual,
        },
      }
    } catch (err) {
      console.error('Error in updateMeta service:', err)
      const errorMsg = err instanceof Error ? err.message : 'Erro ao atualizar meta.'
      return { success: false, error: errorMsg }
    }
  },

  async deleteMeta(id: string, userId: string): Promise<ServiceResult<void>> {
    try {
      await metaRepository.delete(id, userId)
      return { success: true }
    } catch (err) {
      console.error('Error in deleteMeta service:', err)
      const errorMsg = err instanceof Error ? err.message : 'Erro ao excluir meta.'
      return { success: false, error: errorMsg }
    }
  },

  async depositToMeta(
    metaId: string,
    userId: string,
    amount: number,
    date: string
  ): Promise<ServiceResult<Deposit>> {
    try {
      if (amount <= 0) {
        return { success: false, error: 'O valor do aporte deve ser maior que zero.' }
      }

      // Verify meta belongs to user
      const meta = await metaRepository.getById(metaId, userId)
      if (!meta) {
        return { success: false, error: 'Meta não encontrada.' }
      }

      const deposit = await metaRepository.insertDeposit({
        metaId,
        valor: amount,
        data: date,
      })

      return { success: true, data: deposit }
    } catch (err) {
      console.error('Error in depositToMeta service:', err)
      const errorMsg = err instanceof Error ? err.message : 'Erro ao realizar aporte.'
      return { success: false, error: errorMsg }
    }
  }
}

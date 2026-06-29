import { supabase } from '@/lib/supabase'

export interface ProfileUpdateInput {
  nome: string
}

export interface SettingsUpdateInput {
  moeda: string
  fechamentoDia: number
  tema: string
}

export const profileRepository = {
  async updateProfile(userId: string, input: ProfileUpdateInput): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({
        nome: input.nome.trim()
      })
      .eq('id', userId)

    if (error) throw error
  },

  async updateSettings(userId: string, input: SettingsUpdateInput): Promise<void> {
    const { error } = await supabase
      .from('settings')
      .update({
        moeda: input.moeda,
        fechamento_dia: input.fechamentoDia,
        tema: input.tema
      })
      .eq('user_id', userId)

    if (error) throw error
  }
}

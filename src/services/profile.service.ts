import { profileRepository, ProfileUpdateInput, SettingsUpdateInput } from '@/repositories/profile.repository'
import { ServiceResult } from './conta.service'
import { logger } from '@/lib/logger'

export const profileService = {
  async updateProfileAndSettings(
    userId: string,
    profileInput: ProfileUpdateInput,
    settingsInput: SettingsUpdateInput
  ): Promise<ServiceResult<void>> {
    try {
      logger.info('profileService: updating profile & settings', { userId })
      
      // Perform updates concurrently
      await Promise.all([
        profileRepository.updateProfile(userId, profileInput),
        profileRepository.updateSettings(userId, settingsInput)
      ])

      logger.info('profileService: successfully updated profile & settings')
      return { success: true }
    } catch (err: any) {
      logger.error('profileService: error updating profile & settings', { error: err })
      return { success: false, error: err.message || 'Erro ao salvar configurações do perfil.' }
    }
  }
}

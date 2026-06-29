// Feature Flags & Config Service
// Centraliza flags de desenvolvimento e configurações da JA Platform.

import { logger } from '@/lib/logger'

export type FeatureFlagName = 
  | 'moneybridge_autosync' 
  | 'lucro_simples_integration' 
  | 'offline_mode' 
  | 'haptic_feedback'

const FLAGS_DEFAULT: Record<FeatureFlagName, boolean> = {
  moneybridge_autosync: false,       // Inicia desabilitado (Sprint 4)
  lucro_simples_integration: false,  // Inicia desabilitado (Sprint 7)
  offline_mode: false,               // Inicia desabilitado (Sprint 5)
  haptic_feedback: true,             // Habilitado por padrão
}

export const configService = {
  isFeatureEnabled(flag: FeatureFlagName): boolean {
    // Carrega override local de desenvolvimento (ex: localStorage) se aplicável
    if (typeof window !== 'undefined') {
      const override = localStorage.getItem(`ff:${flag}`)
      if (override !== null) {
        return override === 'true'
      }
    }
    
    return FLAGS_DEFAULT[flag]
  },

  setFeatureFlag(flag: FeatureFlagName, enabled: boolean): void {
    logger.info(`configService: setting feature flag "${flag}"`, { enabled })
    if (typeof window !== 'undefined') {
      localStorage.setItem(`ff:${flag}`, String(enabled))
    }
  },

  resetFeatureFlags(): void {
    if (typeof window !== 'undefined') {
      Object.keys(FLAGS_DEFAULT).forEach(key => {
        localStorage.removeItem(`ff:${key}`)
      })
    }
  }
}

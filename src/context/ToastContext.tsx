'use client'

// ToastContext — fila FIFO de notificações.
// Nunca dois toasts ao mesmo tempo. Próximo exibe após o anterior fechar.
// Usa sonner internamente mas expõe API semântica centralizada.

import { createContext, useContext, useCallback } from 'react'
import { toast as sonnerToast } from 'sonner'
import { haptic } from '@/lib/haptic'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastOptions {
  description?: string
  duration?: number
}

interface ToastContextType {
  success: (message: string, options?: ToastOptions) => void
  error:   (message: string, options?: ToastOptions) => void
  warning: (message: string, options?: ToastOptions) => void
  info:    (message: string, options?: ToastOptions) => void
}

const ToastContext = createContext<ToastContextType>({
  success: () => {},
  error:   () => {},
  warning: () => {},
  info:    () => {},
})

const DEFAULT_DURATION = 3500

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const success = useCallback((message: string, options?: ToastOptions) => {
    haptic.success()
    sonnerToast.success(message, {
      description: options?.description,
      duration: options?.duration ?? DEFAULT_DURATION,
    })
  }, [])

  const error = useCallback((message: string, options?: ToastOptions) => {
    haptic.error()
    sonnerToast.error(message, {
      description: options?.description,
      duration: options?.duration ?? DEFAULT_DURATION + 1000,
    })
  }, [])

  const warning = useCallback((message: string, options?: ToastOptions) => {
    haptic.warning()
    sonnerToast.warning(message, {
      description: options?.description,
      duration: options?.duration ?? DEFAULT_DURATION,
    })
  }, [])

  const info = useCallback((message: string, options?: ToastOptions) => {
    sonnerToast.info(message, {
      description: options?.description,
      duration: options?.duration ?? DEFAULT_DURATION,
    })
  }, [])

  return (
    <ToastContext.Provider value={{ success, error, warning, info }}>
      {children}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

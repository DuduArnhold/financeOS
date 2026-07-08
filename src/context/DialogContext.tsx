'use client'

// DialogContext — diálogos programáticos.
// Uso: const { confirm, alert } = useDialog()
//      const ok = await confirm({ title: 'Excluir?', ... })

import {
  createContext, useContext, useCallback, useState
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'default'
}

interface AlertOptions {
  title: string
  description?: string
  confirmText?: string
}

interface DialogContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  alert:   (options: AlertOptions)   => Promise<void>
}

// ─── Context ──────────────────────────────────────────────────────────────────

const DialogContext = createContext<DialogContextType>({
  confirm: async () => false,
  alert:   async () => {},
})

// ─── Internal state shape ─────────────────────────────────────────────────────

type DialogState =
  | ({ kind: 'confirm' } & ConfirmOptions & { resolve: (v: boolean) => void })
  | ({ kind: 'alert'   } & AlertOptions   & { resolve: () => void })
  | null

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({ kind: 'confirm', ...options, resolve })
    })
  }, [])

  const alert = useCallback((options: AlertOptions): Promise<void> => {
    return new Promise((resolve) => {
      setDialog({ kind: 'alert', ...options, resolve })
    })
  }, [])

  const close = useCallback(() => setDialog(null), [])

  const variantColor: Record<string, string> = {
    danger:  'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20',
    warning: 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/20',
    default: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20',
  }

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}

      <AnimatePresence>
        {dialog && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => {
                if (dialog.kind === 'alert') { dialog.resolve(); close() }
              }}
            />

            {/* Dialog card */}
            <motion.div
              key="dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="dialog-title"
              className="fixed z-50 inset-0 flex items-center justify-center p-4 pointer-events-none"
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{    opacity: 0, scale: 0.92, y: 12 }}
              transition={{ duration: 0.18, ease: [0.215, 0.61, 0.355, 1] }}
            >
              <div className="glass-card rounded-3xl p-6 w-full max-w-sm pointer-events-auto shadow-2xl border border-slate-700/50">
                <h2 id="dialog-title" className="text-base font-bold text-[var(--color-text-primary)] mb-1">
                  {dialog.title}
                </h2>
                {dialog.description && (
                  <p className="text-sm text-[var(--color-text-secondary)] mb-5 leading-relaxed">
                    {dialog.description}
                  </p>
                )}

                <div className="flex gap-3 mt-5">
                  {dialog.kind === 'confirm' && (
                    <button
                      onClick={() => { close(); dialog.resolve(false) }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all duration-150 active:scale-[0.97] cursor-pointer"
                    >
                      {dialog.cancelText ?? 'Cancelar'}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      close()
                      if (dialog.kind === 'confirm') dialog.resolve(true)
                      else dialog.resolve()
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-150 active:scale-[0.97] shadow-lg cursor-pointer ${
                      variantColor[dialog.kind === 'confirm' ? (dialog.variant ?? 'default') : 'default']
                    }`}
                  >
                    {dialog.confirmText ?? (dialog.kind === 'confirm' ? 'Confirmar' : 'OK')}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </DialogContext.Provider>
  )
}

export const useDialog = () => useContext(DialogContext)

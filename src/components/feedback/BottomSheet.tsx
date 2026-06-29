'use client'

// BottomSheet — dialog mobile-first que no desktop vira modal centralizado.
// Fica em feedback/ porque é um tipo de dialog, não uma interação exclusiva de mobile.

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export function BottomSheet({ open, onClose, title, children, className = '' }: BottomSheetProps) {
  const firstFocusRef = useRef<HTMLButtonElement>(null)

  // Focus close button once on open
  useEffect(() => {
    if (open) {
      firstFocusRef.current?.focus()
    }
  }, [open])

  // ESC key listener
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="sheet-backdrop"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={[
              'fixed z-50 glass-card border-[var(--color-border)]',
              // Mobile: bottom sheet
              'bottom-0 left-0 right-0 rounded-t-3xl',
              // Desktop: modal centered
              'md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:w-full md:max-w-md',
              className,
            ].join(' ')}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Drag handle (mobile visual cue) */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
            </div>

            {/* Header */}
            {title && (
              <div className="flex items-center justify-between px-5 pt-3 pb-0">
                <h2 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h2>
                <button
                  ref={firstFocusRef}
                  onClick={onClose}
                  aria-label="Fechar"
                  className="p-1.5 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-slate-800/40 transition-all duration-120 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Content */}
            <div className="p-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

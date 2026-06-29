'use client'

// EmptyState — estado vazio com ícone, título, descrição e CTA.
// Cada módulo passa seu próprio contexto — nunca "Nenhum registro encontrado".

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.215, 0.61, 0.355, 1] }}
      className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}
    >
      {/* Icon */}
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.3, ease: [0.215, 0.61, 0.355, 1] }}
        className="text-5xl mb-4 select-none"
      >
        {icon}
      </motion.div>

      <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--color-text-secondary)] max-w-[220px] leading-relaxed mb-5">
          {description}
        </p>
      )}

      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </motion.div>
  )
}

'use client'

// Button — componente base com máquina de estados: idle | loading | success | error
// Variantes: primary | outline | ghost | danger | success

import { forwardRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Check, X } from 'lucide-react'

type ButtonState = 'idle' | 'loading' | 'success' | 'error'
type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'success-variant'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  state?: ButtonState
  icon?: React.ReactNode
  children: React.ReactNode
  // Quando true, após atingir 'success' ou 'error' retorna para 'idle'
  autoReset?: boolean
  resetDelay?: number // ms
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:          'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20',
  outline:          'border border-[var(--color-border)] hover:bg-slate-800/60 text-[var(--color-text-primary)]',
  ghost:            'hover:bg-slate-800/40 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
  danger:           'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20',
  'success-variant':'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-xs rounded-xl gap-1.5',
  md: 'h-11 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-6 text-base rounded-xl gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  state = 'idle',
  icon,
  children,
  autoReset = true,
  resetDelay = 2000,
  disabled,
  className = '',
  ...props
}, ref) => {
  const [internalState, setInternalState] = useState<ButtonState>(state)

  useEffect(() => {
    setInternalState(state)
    if (autoReset && (state === 'success' || state === 'error')) {
      const timer = setTimeout(() => setInternalState('idle'), resetDelay)
      return () => clearTimeout(timer)
    }
  }, [state, autoReset, resetDelay])

  const isDisabled = disabled || internalState === 'loading'

  const stateOverrides: Partial<Record<ButtonState, string>> = {
    success: '!bg-emerald-600 !shadow-emerald-600/20',
    error:   '!bg-rose-600 !shadow-rose-600/20',
    loading: 'opacity-80 cursor-wait',
  }

  const renderContent = () => {
    switch (internalState) {
      case 'loading':
        return (
          <motion.span
            key="loading"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            className="flex items-center gap-2"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            {children}
          </motion.span>
        )
      case 'success':
        return (
          <motion.span
            key="success"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            className="flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Salvo!
          </motion.span>
        )
      case 'error':
        return (
          <motion.span
            key="error"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            className="flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Erro
          </motion.span>
        )
      default:
        return (
          <motion.span
            key="idle"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-2"
          >
            {icon}
            {children}
          </motion.span>
        )
    }
  }

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={internalState === 'loading'}
      className={[
        'relative inline-flex items-center justify-center font-semibold transition-all duration-150',
        'active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50',
        'disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none overflow-hidden',
        variantClasses[variant],
        sizeClasses[size],
        stateOverrides[internalState] ?? '',
        className,
      ].join(' ')}
      {...props}
    >
      <AnimatePresence mode="wait">
        {renderContent()}
      </AnimatePresence>
    </button>
  )
})

Button.displayName = 'Button'

'use client'

import { forwardRef } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helper?: string
  error?: string
  leftIcon?: React.ReactNode
  rightElement?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  helper,
  error,
  leftIcon,
  rightElement,
  id,
  className = '',
  disabled,
  ...props
}, ref) => {
  const inputId = id ?? `input-${Math.random().toString(36).slice(2, 7)}`
  const helperId = helper ? `${inputId}-helper` : undefined
  const errorId  = error  ? `${inputId}-error`  : undefined

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-[var(--color-text-secondary)]"
        >
          {label}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[var(--color-text-muted)] pointer-events-none">
            {leftIcon}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-describedby={errorId ?? helperId}
          aria-invalid={!!error}
          className={[
            'w-full py-2.5 rounded-xl text-sm glass-input',
            'placeholder:text-[var(--color-text-muted)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-all duration-150',
            leftIcon    ? 'pl-10' : 'pl-4',
            rightElement ? 'pr-10' : 'pr-4',
            error ? 'border-rose-500/60 focus:border-rose-500 focus:shadow-rose-500/20' : '',
            className,
          ].join(' ')}
          {...props}
        />

        {rightElement && (
          <span className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {rightElement}
          </span>
        )}
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-xs text-rose-400 font-medium">
          {error}
        </p>
      )}
      {helper && !error && (
        <p id={helperId} className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
          {helper}
        </p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

'use client'

import { forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  helper?: string
  error?: string
  leftIcon?: React.ReactNode
  options: SelectOption[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  helper,
  error,
  leftIcon,
  options,
  id,
  className = '',
  disabled,
  ...props
}, ref) => {
  const selectId = id ?? `select-${Math.random().toString(36).slice(2, 7)}`

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-medium text-[var(--color-text-secondary)]"
        >
          {label}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[var(--color-text-muted)] pointer-events-none z-10">
            {leftIcon}
          </span>
        )}

        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          aria-invalid={!!error}
          className={[
            'w-full py-2.5 rounded-xl text-sm glass-input appearance-none',
            'bg-[var(--color-surface-alt)] text-[var(--color-text-primary)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'cursor-pointer transition-all duration-150',
            leftIcon ? 'pl-10' : 'pl-4',
            'pr-10',
            error ? 'border-rose-500/60' : '',
            className,
          ].join(' ')}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-200">
              {opt.label}
            </option>
          ))}
        </select>

        {/* Custom chevron */}
        <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--color-text-muted)] pointer-events-none">
          <ChevronDown className="w-4 h-4" />
        </span>
      </div>

      {error && <p role="alert" className="text-xs text-rose-400 font-medium">{error}</p>}
      {helper && !error && <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">{helper}</p>}
    </div>
  )
})

Select.displayName = 'Select'

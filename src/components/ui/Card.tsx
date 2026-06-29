'use client'

import { forwardRef } from 'react'
import { motion } from 'framer-motion'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  animate?: boolean   // entrada animada
  hover?: boolean     // escala leve no hover
  glow?: boolean      // glow no hover
  className?: string
}

export const Card = forwardRef<HTMLDivElement, CardProps>(({
  children,
  animate = false,
  hover = false,
  glow = false,
  className = '',
  ...props
}, ref) => {
  const base = `glass-card rounded-2xl border-[var(--color-border)] ${className}`

  if (animate || hover || glow) {
    return (
      <motion.div
        ref={ref as any}
        initial={animate ? { opacity: 0, y: 10 } : undefined}
        animate={animate ? { opacity: 1, y: 0  } : undefined}
        transition={{ duration: 0.18, ease: [0.215, 0.61, 0.355, 1] }}
        whileHover={hover ? { scale: 1.015 } : undefined}
        className={`${base} ${glow ? 'hover:shadow-indigo-500/10 hover:shadow-xl' : ''}`}
        {...(props as any)}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <div ref={ref} className={base} {...props}>
      {children}
    </div>
  )
})

Card.displayName = 'Card'

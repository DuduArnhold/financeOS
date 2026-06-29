'use client'

// AnimatedNumber — conta de um valor para outro com animação suave.
// Respeita prefers-reduced-motion: se ativo, exibe o valor final instantaneamente.

import { useEffect, useRef, useState } from 'react'

interface AnimatedNumberProps {
  value: number
  duration?: number          // ms
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = () => setReduced(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reduced
}

export function AnimatedNumber({
  value,
  duration = 600,
  decimals = 2,
  prefix = '',
  suffix = '',
  className = '',
}: AnimatedNumberProps) {
  const reducedMotion = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const startRef   = useRef(value)
  const startTime  = useRef<number | null>(null)
  const rafRef     = useRef<number | null>(null)
  const prevValue  = useRef(value)

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(value)
      return
    }

    const from = prevValue.current
    prevValue.current = value

    if (from === value) return

    startRef.current = from
    startTime.current = null

    const animate = (now: number) => {
      if (!startTime.current) startTime.current = now
      const elapsed  = now - startTime.current
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased    = 1 - Math.pow(1 - progress, 3)
      setDisplay(from + (value - from) * eased)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setDisplay(value)
      }
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(animate)

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value, duration, reducedMotion])

  const formatted = display.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return (
    <span className={className} aria-live="polite" aria-atomic="true">
      {prefix}{formatted}{suffix}
    </span>
  )
}

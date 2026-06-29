'use client'

// PullRefresh — pull-to-refresh mobile-first.
// Renderiza uma área sensível ao arrasto no topo do conteúdo.

import { useRef, useState, useCallback } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { RefreshCw } from 'lucide-react'

const TRIGGER_THRESHOLD = 64   // px necessários para disparar
const MAX_PULL         = 80   // px máximo de arrasto visual

interface PullRefreshProps {
  onRefresh: () => Promise<void>
  children: React.ReactNode
}

export function PullRefresh({ onRefresh, children }: PullRefreshProps) {
  const y         = useMotionValue(0)
  const [loading, setLoading] = useState(false)
  const startY    = useRef<number | null>(null)
  const pulling   = useRef(false)

  // Transforma o y em rotação do ícone e opacidade
  const iconRotate = useTransform(y, [0, MAX_PULL], [0, 180])
  const opacity    = useTransform(y, [0, TRIGGER_THRESHOLD / 2], [0, 1])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Só ativa se estiver no topo da página
    if (window.scrollY > 0) return
    startY.current = e.touches[0].clientY
    pulling.current = true
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || startY.current === null || loading) return
    const delta = e.touches[0].clientY - startY.current
    if (delta < 0) return
    const dampened = Math.min(delta * 0.45, MAX_PULL)
    y.set(dampened)
  }, [y, loading])

  const handleTouchEnd = useCallback(async () => {
    pulling.current = false
    const current = y.get()

    if (current >= TRIGGER_THRESHOLD && !loading) {
      setLoading(true)
      await animate(y, MAX_PULL, { duration: 0.1 })
      try { await onRefresh() } finally {
        setLoading(false)
        animate(y, 0, { type: 'spring', stiffness: 300, damping: 30 })
      }
    } else {
      animate(y, 0, { type: 'spring', stiffness: 300, damping: 30 })
    }
    startY.current = null
  }, [y, loading, onRefresh])

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Pull indicator */}
      <motion.div
        style={{ opacity, height: y }}
        className="flex items-center justify-center overflow-hidden"
        aria-hidden="true"
      >
        <motion.div style={{ rotate: iconRotate }}>
          <RefreshCw
            className={`w-5 h-5 text-indigo-400 ${loading ? 'animate-spin' : ''}`}
            strokeWidth={2}
          />
        </motion.div>
      </motion.div>

      {/* Actual content */}
      <motion.div style={{ y: loading ? MAX_PULL : y }}>
        {children}
      </motion.div>
    </div>
  )
}

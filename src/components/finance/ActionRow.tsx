'use client'

// ActionRow — container de ação de qualquer item de lista.
// Delega comportamento para uma estratégia: HoverStrategy (desktop) ou SwipeStrategy (mobile).
// No futuro: LongPressStrategy, KeyboardStrategy, ContextMenuStrategy — sem alterar ActionRow.

import { useCallback } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { Trash2, Pencil } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActionConfig {
  onEdit?:   () => void
  onDelete?: () => void
}

interface ActionRowProps extends ActionConfig {
  children: React.ReactNode
  className?: string
}

// ─── Desktop: HoverStrategy ───────────────────────────────────────────────────

function HoverActions({ onEdit, onDelete }: ActionConfig) {
  return (
    <div
      className="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex-shrink-0"
      aria-label="Ações"
    >
      {onEdit && (
        <button
          onClick={onEdit}
          aria-label="Editar"
          className="p-2 rounded-xl text-sky-400 hover:bg-sky-500/10 transition-all duration-120 active:scale-95 cursor-pointer"
        >
          <Pencil className="w-4 h-4" />
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          aria-label="Excluir"
          className="p-2 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-all duration-120 active:scale-95 cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

// ─── Mobile: SwipeStrategy ────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 72   // px para ativar
const SWIPE_MAX       = 88   // max deslocamento visual

function SwipeRow({ children, onEdit, onDelete, className = '' }: ActionRowProps) {
  const x = useMotionValue(0)

  // Background de exclusão (esquerda → vermelho)
  const deleteBg = useTransform(x, [-SWIPE_MAX, -SWIPE_THRESHOLD, 0], [1, 0.8, 0])
  // Background de edição (direita → azul)
  const editBg   = useTransform(x, [0, SWIPE_THRESHOLD, SWIPE_MAX], [0, 0.8, 1])

  const handleDragEnd = useCallback(async () => {
    const current = x.get()
    if (current < -SWIPE_THRESHOLD && onDelete) {
      await animate(x, -SWIPE_MAX * 1.5, { duration: 0.15 })
      onDelete()
    } else if (current > SWIPE_THRESHOLD && onEdit) {
      onEdit()
    }
    animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 })
  }, [x, onDelete, onEdit])

  return (
    <div className={`relative overflow-hidden rounded-2xl md:hidden ${className}`}>
      {/* Delete background (swipe left) */}
      {onDelete && (
        <motion.div
          className="absolute inset-y-0 right-0 flex items-center justify-end pr-5 bg-rose-500/80 rounded-2xl"
          style={{ opacity: deleteBg }}
        >
          <Trash2 className="w-5 h-5 text-white" />
        </motion.div>
      )}

      {/* Edit background (swipe right) */}
      {onEdit && (
        <motion.div
          className="absolute inset-y-0 left-0 flex items-center justify-start pl-5 bg-sky-500/80 rounded-2xl"
          style={{ opacity: editBg }}
        >
          <Pencil className="w-5 h-5 text-white" />
        </motion.div>
      )}

      {/* Draggable content */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: onDelete ? -SWIPE_MAX : 0, right: onEdit ? SWIPE_MAX : 0 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
        whileTap={{ cursor: 'grabbing' }}
        className="relative z-10 touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  )
}

// ─── ActionRow — orquestrador ─────────────────────────────────────────────────

export function ActionRow({ children, onEdit, onDelete, className = '' }: ActionRowProps) {
  return (
    <>
      {/* Mobile: swipe strategy */}
      <SwipeRow onEdit={onEdit} onDelete={onDelete} className={className}>
        {children}
      </SwipeRow>

      {/* Desktop: hover strategy */}
      <div className={`hidden md:flex items-center gap-2 group ${className}`}>
        <div className="flex-1 min-w-0">{children}</div>
        <HoverActions onEdit={onEdit} onDelete={onDelete} />
      </div>
    </>
  )
}

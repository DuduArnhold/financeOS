'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  ArrowUpCircle,
  ArrowDownCircle,
  CalendarDays,
  Target,
  User
} from 'lucide-react'

const navItems = [
  { href: '/',         label: 'Dashboard', icon: LayoutDashboard, activeColor: 'text-indigo-400',  activeBg: 'bg-indigo-500/15' },
  { href: '/receitas', label: 'Receitas',  icon: ArrowUpCircle,   activeColor: 'text-emerald-400', activeBg: 'bg-emerald-500/15' },
  { href: '/despesas', label: 'Despesas',  icon: ArrowDownCircle, activeColor: 'text-rose-400',    activeBg: 'bg-rose-500/15' },
  { href: '/contas',   label: 'Contas',    icon: CalendarDays,    activeColor: 'text-amber-400',   activeBg: 'bg-amber-500/15' },
  { href: '/metas',    label: 'Metas',     icon: Target,          activeColor: 'text-violet-400',  activeBg: 'bg-violet-500/15' },
  { href: '/perfil',   label: 'Perfil',    icon: User,            activeColor: 'text-sky-400',     activeBg: 'bg-sky-500/15' },
]

export default function BottomNav() {
  const pathname = usePathname()
  if (pathname === '/login') return null

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-lg z-50"
    >
      <div className="glass-card rounded-3xl h-[68px] flex items-center justify-around px-1 shadow-[0_8px_30px_rgb(0,0,0,0.5)] border-slate-800/80">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className="flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-150 relative group"
            >
              <div className={`p-2 rounded-xl transition-all duration-150 ${
                isActive
                  ? `${item.activeBg} ${item.activeColor} scale-110`
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30 group-active:scale-95'
              }`}>
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.8} />
              </div>
              <span className={`mt-0.5 text-[10px] font-medium transition-colors duration-150 ${
                isActive ? `${item.activeColor} font-semibold` : 'text-slate-500 group-hover:text-slate-400'
              }`}>
                {item.label}
              </span>

              {/* Active dot indicator */}
              <AnimatePresence>
                {isActive && (
                  <motion.span
                    layoutId="nav-dot"
                    className={`absolute top-1 w-1 h-1 rounded-full ${item.activeColor.replace('text-', 'bg-')}`}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                    transition={{ duration: 0.18 }}
                  />
                )}
              </AnimatePresence>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

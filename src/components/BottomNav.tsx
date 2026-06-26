'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  CalendarDays, 
  Target, 
  User 
} from 'lucide-react'

export default function BottomNav() {
  const pathname = usePathname()

  // Hide nav on login page
  if (pathname === '/login') return null

  const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/receitas', label: 'Receitas', icon: ArrowUpCircle, activeColor: 'text-emerald-400' },
    { href: '/despesas', label: 'Despesas', icon: ArrowDownCircle, activeColor: 'text-rose-400' },
    { href: '/contas', label: 'Contas', icon: CalendarDays, activeColor: 'text-amber-400' },
    { href: '/metas', label: 'Metas', icon: Target, activeColor: 'text-indigo-400' },
    { href: '/perfil', label: 'Perfil', icon: User, activeColor: 'text-sky-400' },
  ]

  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-lg h-16 glass-card rounded-2xl flex items-center justify-around px-2 z-50 shadow-[0_8px_30px_rgb(0,0,0,0.5)] border-slate-800/80">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href
        const activeColor = item.activeColor || 'text-indigo-400'

        return (
          <Link 
            key={item.href} 
            href={item.href}
            className="flex flex-col items-center justify-center flex-1 h-full py-1 text-xs font-medium transition-all duration-200 relative group"
          >
            <div className={`p-1.5 rounded-xl transition-all duration-200 ${
              isActive 
                ? `bg-slate-800/80 scale-110 ${activeColor}` 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}>
              <Icon className="w-5 h-5" />
            </div>
            <span className={`mt-0.5 text-[10px] md:text-xs transition-colors duration-200 ${
              isActive ? 'text-slate-200 font-semibold' : 'text-slate-500 group-hover:text-slate-400'
            }`}>
              {item.label}
            </span>
            {isActive && (
              <span className={`absolute top-0 w-1 h-1 rounded-full ${
                isActive ? (item.activeColor ? item.activeColor.replace('text-', 'bg-') : 'bg-indigo-400') : ''
              }`} />
            )}
          </Link>
        )
      })}
    </nav>
  )
}

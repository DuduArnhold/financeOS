'use client'

// AppShell — wrapper de layout universal.
// Toda página usa <AppShell> e nunca monta layout manualmente.

interface AppShellProps {
  children: React.ReactNode
  className?: string
}

export function AppShell({ children, className = '' }: AppShellProps) {
  return (
    <main
      className={`container max-w-lg mx-auto px-4 pt-6 pb-28 animate-fade-in ${className}`}
    >
      {children}
    </main>
  )
}

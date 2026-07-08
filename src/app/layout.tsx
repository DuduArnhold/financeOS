import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider }   from '@/context/AuthContext'
import { ThemeProvider }  from '@/context/ThemeContext'
import { DialogProvider } from '@/context/DialogContext'
import { ToastProvider }  from '@/context/ToastContext'
import { Toaster }        from 'sonner'
import BottomNav          from '@/components/navigation/BottomNav'
import { bootstrapPlatform } from '@/platform/bootstrap'

bootstrapPlatform()

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FinanceOS — Controle Financeiro Inteligente',
  description: 'Controle sua vida financeira em menos de 2 minutos por dia.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FinanceOS',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body 
        className="min-h-full flex flex-col bg-[var(--color-bg)] text-[var(--color-text-primary)] selection:bg-indigo-500/30"
        suppressHydrationWarning
      >
        <ThemeProvider>
          <AuthProvider>
            <DialogProvider>
              <ToastProvider>
                {/* Toaster (sonner) — renderiza os toasts físicos na tela */}
                <Toaster
                  theme="dark"
                  position="top-right"
                  toastOptions={{
                    className: 'glass-card border-slate-800 text-slate-100 !rounded-2xl',
                    duration: 3500,
                  }}
                  gap={8}
                />
                <div className="flex-1 pb-24">
                  {children}
                </div>
                <BottomNav />
              </ToastProvider>
            </DialogProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

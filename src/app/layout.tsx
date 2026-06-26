import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "sonner";
import BottomNav from "@/components/BottomNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FinanceOS - Controle Financeiro Inteligente",
  description: "Controle sua vida financeira em menos de 2 minutos por dia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#090d16] text-slate-100 selection:bg-indigo-500/30">
        <AuthProvider>
          <div className="flex-1 pb-24">
            {children}
          </div>
          <BottomNav />
          <Toaster 
            theme="dark" 
            position="top-right" 
            toastOptions={{
              className: 'glass-card border-slate-800 text-slate-100',
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}


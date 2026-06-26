'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'
import { Mail, Lock, User, Wallet, ArrowRight } from 'lucide-react'
import Loader from '@/components/Loader'

export default function LoginPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nome, setNome] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.push('/')
    }
  }, [user, loading, router])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Preencha todos os campos.')
      return
    }
    if (isSignUp && !nome) {
      toast.error('Preencha seu nome para criar a conta.')
      return
    }

    setAuthLoading(true)

    try {
      if (isSignUp) {
        // Sign up logic
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              nome: nome,
            },
          },
        })

        if (error) {
          toast.error(error.message)
        } else {
          toast.success('Conta criada com sucesso! Você já pode entrar.')
          setIsSignUp(false)
          setPassword('')
        }
      } else {
        // Sign in logic
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          toast.error(error.message)
        } else {
          toast.success('Bem-vindo ao FinanceOS!')
          router.push('/')
        }
      }
    } catch (err: any) {
      toast.error('Ocorreu um erro ao processar a requisição.')
      console.error(err)
    } finally {
      setAuthLoading(false)
    }
  }

  if (loading || (user && !authLoading)) {
    return <Loader />
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Top Brand Logo */}
      <div className="flex items-center gap-2 mb-8 animate-fade-in">
        <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-500/20">
          <Wallet className="w-6 h-6" />
        </div>
        <span className="text-xl font-bold tracking-tight text-white">
          Finance<span className="text-indigo-400">OS</span>
        </span>
      </div>

      {/* Card container */}
      <div className="w-full max-w-md glass-card rounded-2xl p-8 border-slate-800/80 shadow-2xl relative overflow-hidden animate-fade-in">
        {/* Decorative ambient gradient inside the card */}
        <div className="absolute -top-12 -right-12 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-white">
            {isSignUp ? 'Criar nova conta' : 'Acessar FinanceOS'}
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            {isSignUp 
              ? 'Cadastre-se para gerenciar suas finanças em 2 minutos' 
              : 'Entre com seus dados para ver seu saldo'
            }
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-medium">Nome completo</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm glass-input focus:ring-2 focus:ring-indigo-500/30"
                  disabled={authLoading}
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-slate-300 text-xs font-medium">E-mail</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm glass-input focus:ring-2 focus:ring-indigo-500/30"
                disabled={authLoading}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-slate-300 text-xs font-medium">Senha</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha secreta"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm glass-input focus:ring-2 focus:ring-indigo-500/30"
                disabled={authLoading}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-6 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            disabled={authLoading}
          >
            {authLoading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {isSignUp ? 'Criar minha conta' : 'Entrar no sistema'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-slate-800/80 pt-6">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setNome('')
              setPassword('')
            }}
            className="text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors"
            disabled={authLoading}
          >
            {isSignUp 
              ? 'Já possui uma conta? Faça login' 
              : 'Não tem conta? Crie uma grátis'
            }
          </button>
        </div>
      </div>
    </main>
  )
}

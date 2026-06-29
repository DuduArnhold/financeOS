'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { Mail, Lock, User, Wallet, ArrowRight, Loader2 } from 'lucide-react'

import { Card }   from '@/components/ui/Card'
import { Input }  from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function LoginPage() {
  const { user, loading } = useAuth()
  const toast  = useToast()
  const router = useRouter()

  const [isSignUp,     setIsSignUp]     = useState(false)
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [nome,         setNome]         = useState('')
  const [authLoading,  setAuthLoading]  = useState(false)
  const [submitState,  setSubmitState]  = useState<'idle'|'loading'|'success'|'error'>('idle')

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
    setSubmitState('loading')

    try {
      if (isSignUp) {
        // Sign up logic
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { nome: nome.trim() },
          },
        })

        if (error) {
          setSubmitState('error')
          toast.error(error.message)
          setTimeout(() => setSubmitState('idle'), 2000)
        } else {
          setSubmitState('success')
          toast.success('Conta criada! Você já pode entrar.')
          setTimeout(() => {
            setIsSignUp(false)
            setPassword('')
            setSubmitState('idle')
          }, 800)
        }
      } else {
        // Sign in logic
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          setSubmitState('error')
          toast.error(error.message)
          setTimeout(() => setSubmitState('idle'), 2000)
        } else {
          setSubmitState('success')
          toast.success('Bem-vindo ao FinanceOS!')
          setTimeout(() => {
            router.push('/')
          }, 800)
        }
      }
    } catch (err: any) {
      setSubmitState('error')
      toast.error('Ocorreu um erro ao processar a requisição.')
      setTimeout(() => setSubmitState('idle'), 2000)
      console.error(err)
    } finally {
      setAuthLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#090d16] flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="text-xs text-[var(--color-text-secondary)] font-semibold tracking-widest uppercase">FinanceOS</span>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--color-bg)]">
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
      <Card animate className="w-full max-w-md p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative ambient gradient inside the card */}
        <div className="absolute -top-12 -right-12 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
            {isSignUp ? 'Criar nova conta' : 'Acessar FinanceOS'}
          </h1>
          <p className="text-[var(--color-text-secondary)] text-xs mt-1">
            {isSignUp 
              ? 'Cadastre-se para gerenciar suas finanças em 2 minutos' 
              : 'Entre com seus dados para ver seu saldo'
            }
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <Input
              label="Nome completo"
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Seu nome"
              leftIcon={<User className="w-4 h-4 text-slate-400" />}
              disabled={authLoading}
              required
            />
          )}

          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="seuemail@exemplo.com"
            leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
            disabled={authLoading}
            required
          />

          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Sua senha secreta"
            leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
            disabled={authLoading}
            required
          />

          <Button
            type="submit"
            variant="primary"
            state={submitState}
            disabled={authLoading}
            className="w-full mt-6"
          >
            {isSignUp ? 'Criar minha conta' : 'Entrar no sistema'}
            {submitState === 'idle' && <ArrowRight className="w-4 h-4 ml-1" />}
          </Button>
        </form>

        <div className="mt-6 text-center border-t border-slate-800/80 pt-6">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setNome('')
              setPassword('')
            }}
            className="text-indigo-400 hover:text-indigo-300 text-xs font-semibold transition-colors cursor-pointer"
            disabled={authLoading}
          >
            {isSignUp 
              ? 'Já possui uma conta? Faça login' 
              : 'Não tem conta? Crie uma grátis'
            }
          </button>
        </div>
      </Card>
    </main>
  )
}

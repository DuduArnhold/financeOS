'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

export interface UserProfile {
  id: string
  nome: string
  email: string
  avatar_url?: string | null
  telefone?: string | null
  ativo: boolean
  moeda: string
  fechamento_dia: number
  tema: string
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  /**
   * Busca o perfil no banco de dados.
   * Os metadados de fallback são passados como parâmetro (não fechados sobre o estado
   * `user`) para que a referência desta função seja permanentemente estável.
   */
  const fetchProfile = useCallback(async (
    uid: string,
    fallbackMeta?: { nome?: string; email?: string }
  ) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          nome,
          email,
          avatar_url,
          telefone,
          ativo,
          settings:settings(moeda, fechamento_dia, tema)
        `)
        .eq('id', uid)
        .maybeSingle()

      if (error) {
        console.error('AuthContext: error fetching profile', error)
        setProfile({
          id: uid,
          nome: fallbackMeta?.nome || 'Usuário',
          email: fallbackMeta?.email || '',
          moeda: 'R$',
          fechamento_dia: 30,
          tema: 'dark',
          ativo: true,
        })
      } else if (data) {
        // Normaliza settings (pode vir como objeto ou array dependendo da versão do Supabase)
        interface SettingsDb {
          moeda?: string
          fechamento_dia?: number
          tema?: string
        }
        const settingsRaw = data.settings as SettingsDb | SettingsDb[] | null | undefined
        const settingsObj = Array.isArray(settingsRaw) ? settingsRaw[0] : settingsRaw

        setProfile({
          id: data.id,
          nome: data.nome,
          email: data.email,
          avatar_url: data.avatar_url,
          telefone: data.telefone,
          ativo: data.ativo,
          moeda: settingsObj?.moeda || 'R$',
          fechamento_dia: settingsObj?.fechamento_dia ?? 30,
          tema: settingsObj?.tema || 'dark',
        })
      } else {
        // Perfil ainda não criado (lag do trigger de novo cadastro)
        setProfile({
          id: uid,
          nome: fallbackMeta?.nome || 'Usuário',
          email: fallbackMeta?.email || '',
          moeda: 'R$',
          fechamento_dia: 30,
          tema: 'dark',
          ativo: true,
        })
      }
    } catch (e) {
      console.error('AuthContext: exception fetching profile, using fallback', e)
      setProfile({
        id: uid,
        nome: fallbackMeta?.nome || 'Usuário',
        email: fallbackMeta?.email || '',
        moeda: 'R$',
        fechamento_dia: 30,
        tema: 'dark',
        ativo: true,
      })
    }
  }, []) // Dependências intencionalmente vazias: a função nunca precisa ser recriada.

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id, {
        nome: user.user_metadata?.nome as string | undefined,
        email: user.email,
      })
    }
  }, [user, fetchProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    router.push('/login')
  }, [router])

  /**
   * Efeito principal de autenticação — roda UMA ÚNICA VEZ no mount.
   * `fetchProfile` é estável (deps vazias), portanto isso é seguro.
   * Redirecionamentos foram removidos daqui para evitar race conditions;
   * cada página ou o efeito de guarda abaixo tratam os redirecionamentos.
   */
  useEffect(() => {
    let active = true // Evita atualizações de estado em componentes desmontados

    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!active) return

        if (session) {
          setUser(session.user)
          await fetchProfile(session.user.id, {
            nome: session.user.user_metadata?.nome as string | undefined,
            email: session.user.email,
          })
        } else {
          setUser(null)
          setProfile(null)
        }
      } catch (err) {
        console.error('AuthContext: error checking session', err)
      } finally {
        if (active) setLoading(false)
      }
    }

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!active) return

        if (session) {
          setUser(session.user)
          await fetchProfile(session.user.id, {
            nome: session.user.user_metadata?.nome as string | undefined,
            email: session.user.email,
          })
        } else {
          setUser(null)
          setProfile(null)
        }
        if (active) setLoading(false)
      }
    )

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [fetchProfile]) // fetchProfile é estável — este efeito roda somente uma vez.

  /**
   * Efeito de guarda de rota: separado do efeito de auth para evitar acoplamento.
   * Redireciona para /login somente quando o carregamento termina e não há sessão.
   */
  useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      router.push('/login')
    }
  }, [loading, user, pathname, router])

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

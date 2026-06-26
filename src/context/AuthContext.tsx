'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
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

  const fetchProfile = async (uid: string) => {
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
        console.error('Error fetching profile:', error)
      } else if (data) {
        // Flatten settings (handles both array and single object returns depending on supabase version)
        const settingsRaw: any = data.settings
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
        // Fallback profile if profile row is not created yet (e.g. trigger lag)
        setProfile({
          id: uid,
          nome: user?.user_metadata?.nome || 'Usuário',
          email: user?.email || '',
          moeda: 'R$',
          fechamento_dia: 30,
          tema: 'dark',
          ativo: true,
        })
      }
    } catch (e) {
      console.error(e)
    }
  }

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    router.push('/login')
  }

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setUser(session.user)
          await fetchProfile(session.user.id)
        } else {
          setUser(null)
          setProfile(null)
          if (pathname !== '/login') {
            router.push('/login')
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          setUser(session.user)
          await fetchProfile(session.user.id)
          if (pathname === '/login') {
            router.push('/')
          }
        } else {
          setUser(null)
          setProfile(null)
          if (pathname !== '/login') {
            router.push('/login')
          }
        }
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [pathname, router])

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

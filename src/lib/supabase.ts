import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Verifica se a URL é válida para evitar travamentos durante o build do Next.js
const isValidUrl = (url: string) => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

const finalUrl = isValidUrl(supabaseUrl) ? supabaseUrl : 'https://placeholder.supabase.co'
const finalKey = supabaseAnonKey || 'placeholder-key'

if (!isValidUrl(supabaseUrl) || !supabaseAnonKey) {
  console.warn('FinanceOS: Credenciais reais do Supabase não configuradas no .env.local')
}

export const supabase = createClient(finalUrl, finalKey)

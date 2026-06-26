'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { 
  User, 
  Coins, 
  Calendar, 
  Sun, 
  Moon, 
  LogOut, 
  Save, 
  Loader2,
  CheckCircle2
} from 'lucide-react'
import Loader from '@/components/Loader'
import { toast } from 'sonner'

const CURRENCIES = [
  { value: 'R$', label: 'Real Brasileiro (R$)' },
  { value: '$', label: 'Dólar Americano ($)' },
  { value: '€', label: 'Euro (€)' },
  { value: '£', label: 'Libra Esterlina (£)' }
]

export default function PerfilPage() {
  const { user, profile, loading, refreshProfile, signOut } = useAuth()
  const router = useRouter()

  const [nome, setNome] = useState('')
  const [moeda, setMoeda] = useState('R$')
  const [fechamentoDia, setFechamentoDia] = useState(30)
  const [tema, setTema] = useState('dark')
  
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  // Sync state with profile once loaded
  useEffect(() => {
    if (profile) {
      setNome(profile.nome)
      setMoeda(profile.moeda || 'R$')
      setFechamentoDia(profile.fechamento_dia || 30)
      setTema(profile.tema || 'dark')
    }
  }, [profile])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      toast.error('O nome não pode estar vazio.')
      return
    }
    const day = Number(fechamentoDia)
    if (isNaN(day) || day < 1 || day > 31) {
      toast.error('O dia de fechamento deve ser um número entre 1 e 31.')
      return
    }

    setSaving(true)
    try {
      // 1. Atualizar nome na tabela profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          nome: nome.trim()
        })
        .eq('id', user?.id)

      if (profileError) throw profileError

      // 2. Atualizar configurações na tabela settings
      const { error: settingsError } = await supabase
        .from('settings')
        .update({
          moeda,
          fechamento_dia: day,
          tema
        })
        .eq('user_id', user?.id)

      if (settingsError) throw settingsError
      
      await refreshProfile()
      toast.success('Configurações atualizadas!')
    } catch (err: any) {
      console.error('Error saving profile settings:', err)
      toast.error(err.message || 'Erro ao salvar configurações.')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    if (confirm('Deseja realmente sair do aplicativo?')) {
      try {
        await signOut()
        toast.success('Até logo!')
      } catch (err) {
        console.error('Error signing out:', err)
        toast.error('Erro ao sair.')
      }
    }
  }

  if (loading || !profile) {
    return <Loader />
  }

  return (
    <main className="container max-w-lg mx-auto px-4 pt-6 pb-20 animate-fade-in">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Ajustes</span>
          <h1 className="text-2xl font-bold text-white tracking-tight">Seu Perfil</h1>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold px-4 py-2 rounded-xl transition-all duration-200 cursor-pointer active:scale-95 animate-fade-in"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>

      {/* Profile Form */}
      <div className="glass-card rounded-2xl p-6 border-slate-800/80 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-xl pointer-events-none" />

        <form onSubmit={handleSave} className="space-y-5">
          {/* Nome Input */}
          <div className="space-y-1">
            <label className="text-slate-300 text-xs font-medium">Seu Nome</label>
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
                disabled={saving}
                required
              />
            </div>
          </div>

          {/* Email (Read-Only) */}
          <div className="space-y-1">
            <label className="text-slate-500 text-xs font-medium">Endereço de E-mail</label>
            <input
              type="email"
              value={profile.email}
              className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-900/40 border border-slate-800 text-slate-500 cursor-not-allowed outline-none select-none"
              readOnly
            />
          </div>

          {/* Moeda Select */}
          <div className="space-y-1">
            <label className="text-slate-300 text-xs font-medium">Moeda Padrão</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                <Coins className="w-4 h-4" />
              </span>
              <select
                value={moeda}
                onChange={(e) => setMoeda(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm glass-input appearance-none bg-[#0a0f1d] cursor-pointer"
                disabled={saving}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value} className="bg-slate-900 text-slate-200">
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dia de Fechamento Input */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-slate-300 text-xs font-medium">Dia de Fechamento do Mês</label>
              <span className="text-[10px] text-slate-400">Ciclos de faturamento</span>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                <Calendar className="w-4 h-4" />
              </span>
              <input
                type="number"
                min="1"
                max="31"
                value={fechamentoDia}
                onChange={(e) => setFechamentoDia(Number(e.target.value))}
                placeholder="30"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm glass-input focus:ring-2 focus:ring-indigo-500/30 font-semibold"
                disabled={saving}
                required
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Determina quando seu saldo mensal é redefinido. Ex: Se for dia 30, o ciclo corrente vai do dia 30 do mês passado ao dia 29 deste mês.
            </p>
          </div>

          {/* Tema Toggle (Light/Dark) */}
          <div className="space-y-1.5 pt-1">
            <label className="text-slate-300 text-xs font-medium">Aparência (Tema)</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTema('dark')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                  tema === 'dark'
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-md'
                    : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:text-slate-300'
                }`}
                disabled={saving}
              >
                <Moon className="w-3.5 h-3.5" />
                Escuro (Recomendado)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTema('light')
                  toast.info('Modo Claro simulado. O design premium fica melhor no modo Escuro!')
                }}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                  tema === 'light'
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-md'
                    : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:text-slate-300'
                }`}
                disabled={saving}
              >
                <Sun className="w-3.5 h-3.5" />
                Claro
              </button>
            </div>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Configurações
              </>
            )}
          </button>
        </form>
      </div>

      {/* Info Box */}
      <div className="mt-4 p-4 rounded-2xl bg-indigo-950/20 border border-indigo-900/20 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-bold text-slate-200">Suas finanças em 2 minutos</h4>
          <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
            O FinanceOS foi desenhado para registrar transações o mais rápido possível. Configure seu dia de fechamento de acordo com o dia de vencimento de suas principais faturas ou recebimento de salário.
          </p>
        </div>
      </div>
    </main>
  )
}

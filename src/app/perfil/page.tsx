'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth }   from '@/context/AuthContext'
import { useToast }  from '@/context/ToastContext'
import { useDialog } from '@/context/DialogContext'
import { useTheme }  from '@/context/ThemeContext'
import { supabase }  from '@/lib/supabase'
import { User, Coins, Calendar, Sun, Moon, LogOut, Save, Laptop } from 'lucide-react'

import { AppShell }       from '@/components/layout/AppShell'
import { PageHeader, PageTitle } from '@/components/layout/PageHeader'
import { Button }         from '@/components/ui/Button'
import { Card }           from '@/components/ui/Card'
import { Input }          from '@/components/ui/Input'
import { Select }         from '@/components/ui/Select'
import { Badge }          from '@/components/ui/Badge'
import { SkeletonCard }   from '@/components/feedback/Skeletons'

const CURRENCIES = [
  { value: 'R$', label: 'Real Brasileiro (R$)' },
  { value: '$', label: 'Dólar Americano ($)' },
  { value: '€', label: 'Euro (€)' },
  { value: '£', label: 'Libra Esterlina (£)' }
]

export default function PerfilPage() {
  const { user, profile, loading, refreshProfile, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const toast  = useToast()
  const dialog = useDialog()
  const router = useRouter()

  const [nome,           setNome]           = useState('')
  const [moeda,          setMoeda]          = useState('R$')
  const [fechamentoDia,  setFechamentoDia]  = useState(30)
  const [tema,           setTema]           = useState<'dark'|'light'|'system'>('dark')
  
  const [saving,         setSaving]         = useState(false)
  const [submitState,    setSubmitState]    = useState<'idle'|'loading'|'success'|'error'>('idle')

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  // Sync state with profile once loaded
  useEffect(() => {
    if (profile) {
      setNome(profile.nome)
      setMoeda(profile.moeda || 'R$')
      setFechamentoDia(profile.fechamento_dia || 30)
      setTema((profile.tema as any) || 'dark')
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
    setSubmitState('loading')
    try {
      // 1. Atualizar nome na tabela profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ nome: nome.trim() })
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
      
      // 3. Atualizar tema local através do ThemeContext
      setTheme(tema)

      await refreshProfile()
      setSubmitState('success')
      toast.success('Configurações atualizadas!')
      setTimeout(() => setSubmitState('idle'), 1000)
    } catch (err: any) {
      console.error('Error saving profile settings:', err)
      setSubmitState('error')
      toast.error(err.message || 'Erro ao salvar configurações.')
      setTimeout(() => setSubmitState('idle'), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    const ok = await dialog.confirm({
      title: 'Sair do aplicativo?',
      description: 'Você precisará fazer login novamente para acessar suas finanças.',
      confirmText: 'Sair',
      variant: 'danger'
    })
    if (!ok) return

    try {
      await signOut()
      toast.success('Até logo!')
    } catch (err) {
      console.error('Error signing out:', err)
      toast.error('Erro ao sair.')
    }
  }

  if (loading || !profile) {
    return (
      <AppShell>
        <SkeletonCard className="h-96" />
      </AppShell>
    )
  }

  return (
    <AppShell>
      {/* Page Header */}
      <PageHeader
        left={<PageTitle eyebrow="Ajustes" title="Seu Perfil" />}
        right={
          <Button
            variant="outline"
            size="sm"
            icon={<LogOut className="w-3.5 h-3.5 text-rose-400" />}
            onClick={handleLogout}
            className="!border-rose-500/20 hover:!bg-rose-500/10 hover:!text-rose-400"
          >
            Sair
          </Button>
        }
      />

      {/* Profile Form */}
      <Card animate className="p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-xl pointer-events-none" />

        <form onSubmit={handleSave} className="space-y-5">
          {/* Nome Input */}
          <Input
            label="Seu Nome"
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Seu nome"
            leftIcon={<User className="w-4 h-4" />}
            disabled={saving}
            required
          />

          {/* Email (Read-Only) */}
          <div className="space-y-1.5 w-full">
            <label className="block text-xs font-medium text-[var(--color-text-muted)]">
              Endereço de E-mail
            </label>
            <input
              type="email"
              value={profile.email}
              className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-900/40 border border-slate-800 text-[var(--color-text-secondary)] cursor-not-allowed outline-none select-none"
              readOnly
            />
          </div>

          {/* Moeda Select */}
          <Select
            label="Moeda Padrão"
            options={CURRENCIES}
            value={moeda}
            onChange={e => setMoeda(e.target.value)}
            leftIcon={<Coins className="w-4 h-4" />}
            disabled={saving}
            required
          />

          {/* Dia de Fechamento Input */}
          <Input
            label="Dia de Fechamento do Mês"
            type="number"
            min="1"
            max="31"
            value={fechamentoDia}
            onChange={e => setFechamentoDia(Number(e.target.value))}
            placeholder="30"
            leftIcon={<Calendar className="w-4 h-4" />}
            helper="Determina quando seu saldo mensal é redefinido. Ex: Se for dia 30, o ciclo corrente vai do dia 30 do mês passado ao dia 29 deste mês."
            disabled={saving}
            required
          />

          {/* Tema Toggle (Light/Dark/System) */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold text-[var(--color-text-secondary)] block">Aparência (Tema)</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTema('dark')}
                className={`py-2.5 px-3 rounded-xl text-[11px] font-semibold flex flex-col items-center justify-center gap-1 border transition-all duration-150 cursor-pointer ${
                  tema === 'dark'
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-md'
                    : 'bg-[var(--color-surface-alt)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-slate-700'
                }`}
                disabled={saving}
              >
                <Moon className="w-4 h-4" />
                Escuro
              </button>
              <button
                type="button"
                onClick={() => setTema('light')}
                className={`py-2.5 px-3 rounded-xl text-[11px] font-semibold flex flex-col items-center justify-center gap-1 border transition-all duration-150 cursor-pointer ${
                  tema === 'light'
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-md'
                    : 'bg-[var(--color-surface-alt)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-slate-700'
                }`}
                disabled={saving}
              >
                <Sun className="w-4 h-4" />
                Claro
              </button>
              <button
                type="button"
                onClick={() => setTema('system')}
                className={`py-2.5 px-3 rounded-xl text-[11px] font-semibold flex flex-col items-center justify-center gap-1 border transition-all duration-150 cursor-pointer ${
                  tema === 'system'
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-md'
                    : 'bg-[var(--color-surface-alt)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-slate-700'
                }`}
                disabled={saving}
              >
                <Laptop className="w-4 h-4" />
                Sistema
              </button>
            </div>
          </div>

          {/* Save Button */}
          <Button
            type="submit"
            variant="primary"
            state={submitState}
            icon={<Save className="w-4 h-4" />}
            className="w-full mt-4"
          >
            Salvar Configurações
          </Button>
        </form>
      </Card>
    </AppShell>
  )
}

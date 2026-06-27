-- ESQUEMA DO BANCO DE DADOS - JA PLATFORM (CORE & FINANCEOS MODULE)
-- Execute este script no SQL Editor do seu projeto Supabase.

-- Habilitar a extensão pgcrypto para uso do gen_random_uuid()
create extension if not exists pgcrypto;

-- =========================================================================
-- FUNCÕES DE SUPORTE E SEGURANÇA
-- =========================================================================

-- Função para atualização automática do updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- =========================================================================
-- 1. NÚCLEO COMPARTILHADO (CORE)
-- =========================================================================

-- Perfil de Usuário
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  nome text not null,
  email text unique not null,
  avatar_url text,
  telefone text,
  ultimo_login timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  ativo boolean default true not null
);

alter table public.profiles enable row level security;

create policy "Usuários veem o próprio perfil" on public.profiles 
  for select using (auth.uid() = id);
create policy "Usuários atualizam o próprio perfil" on public.profiles 
  for update using (auth.uid() = id);
create policy "Usuários inserem o próprio perfil" on public.profiles 
  for insert with check (auth.uid() = id);

-- Trigger de data de atualização em profiles
drop trigger if exists set_updated_at_profiles on public.profiles;
create trigger set_updated_at_profiles
  before update on public.profiles
  for each row execute procedure public.update_updated_at_column();

-- Módulos Habilitados
create table public.user_modules (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  module text not null, -- 'lucro_simples', 'finance_os', etc.
  enabled boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, module)
);

alter table public.user_modules enable row level security;
create policy "Usuários gerenciam seus próprios módulos" on public.user_modules 
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Configurações Globais
create table public.settings (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  moeda text default 'R$' not null,
  fechamento_dia integer default 30 not null check (fechamento_dia between 1 and 31),
  tema text default 'dark' not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.settings enable row level security;
create policy "Usuários gerenciam suas configurações" on public.settings 
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Trigger de data de atualização em settings
drop trigger if exists set_updated_at_settings on public.settings;
create trigger set_updated_at_settings
  before update on public.settings
  for each row execute procedure public.update_updated_at_column();


-- =========================================================================
-- 2. MÓDULO FINANCEOS (FINANÇAS PESSOAIS)
-- =========================================================================

-- Contas Financeiras (ex: Nubank, Carteira)
create table public.finance_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  nome text not null,
  saldo_inicial numeric default 0 not null,
  tipo text default 'Outro' not null check (tipo in ('Banco', 'Carteira', 'Dinheiro', 'Investimento', 'Outro')),
  cor text,
  ativo boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.finance_accounts enable row level security;
create policy "Usuários gerenciam suas contas financeiras" on public.finance_accounts 
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Categorias de Movimentações
create table public.finance_categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade, -- null indica categoria pública do sistema
  nome text not null,
  tipo text not null check (tipo in ('receita', 'despesa', 'ambos')),
  cor text,
  icone text,
  ordem integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.finance_categories enable row level security;
create policy "Usuários veem categorias públicas e privadas" on public.finance_categories 
  for select using (user_id is null or auth.uid() = user_id);
create policy "Usuários gerenciam suas próprias categorias" on public.finance_categories 
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Movimentações Unificadas (Ledger Geral)
create table public.finance_movements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  tipo text not null check (tipo in ('receita', 'despesa')),
  valor numeric not null check (valor > 0),
  categoria_id uuid references public.finance_categories(id) on delete set null,
  account_id uuid references public.finance_accounts(id) on delete cascade not null,
  forma_pagamento text not null check (forma_pagamento <> ''),
  data date not null default current_date,
  descricao text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.finance_movements enable row level security;
create policy "Usuários gerenciam suas próprias movimentações" on public.finance_movements 
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Contas a Pagar
create table public.finance_contas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  nome text not null,
  valor numeric not null check (valor > 0),
  vencimento date not null,
  paga boolean default false not null,
  recorrente boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.finance_contas enable row level security;
create policy "Usuários gerenciam suas contas" on public.finance_contas 
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Metas Financeiras
create table public.finance_metas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  nome text not null,
  valor_meta numeric not null check (valor_meta > 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.finance_metas enable row level security;
create policy "Usuários gerenciam suas metas" on public.finance_metas 
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Histórico de Depósitos para Metas (Cálculo dinâmico)
create table public.finance_goal_deposits (
  id uuid default gen_random_uuid() primary key,
  meta_id uuid references public.finance_metas(id) on delete cascade not null,
  valor numeric not null check (valor > 0),
  data date not null default current_date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.finance_goal_deposits enable row level security;
create policy "Usuários gerenciam depósitos de suas metas" on public.finance_goal_deposits 
  for all using (
    exists (
      select 1 from public.finance_metas m 
      where m.id = finance_goal_deposits.meta_id and m.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.finance_metas m 
      where m.id = finance_goal_deposits.meta_id and m.user_id = auth.uid()
    )
  );


-- =========================================================================
-- 3. ÍNDICES DE PERFORMANCE E UNICIDADE
-- =========================================================================
create index if not exists idx_finance_movements_user on public.finance_movements(user_id);
create index if not exists idx_finance_movements_date on public.finance_movements(data);
create index if not exists idx_finance_movements_account on public.finance_movements(account_id);
create index if not exists idx_finance_movements_category on public.finance_movements(categoria_id);
create index if not exists idx_finance_contas_user on public.finance_contas(user_id);
create index if not exists idx_finance_accounts_user on public.finance_accounts(user_id);
create index if not exists idx_user_modules_user on public.user_modules(user_id);

-- Índices de Unicidade de Categorias
create unique index if not exists idx_finance_categories_uniq_system 
  on public.finance_categories (nome, tipo) 
  where user_id is null;

create unique index if not exists idx_finance_categories_uniq_user 
  on public.finance_categories (user_id, nome, tipo) 
  where user_id is not null;


-- =========================================================================
-- 4. TRIGGER PARA NOVOS CADASTROS
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  -- 1. Criar perfil
  insert into public.profiles (id, nome, email, ativo)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nome', ''), 'Usuário'),
    new.email,
    true
  );

  -- 2. Ativar Módulos Padrão (Lucro Simples ativo, FinanceOS desativado por padrão)
  insert into public.user_modules (user_id, module, enabled)
  values 
    (new.id, 'lucro_simples', true),
    (new.id, 'finance_os', false);

  -- 3. Criar configurações default
  insert into public.settings (user_id, moeda, fechamento_dia, tema)
  values (new.id, 'R$', 30, 'dark');

  -- 4. Criar conta financeira default (Carteira física)
  insert into public.finance_accounts (user_id, nome, saldo_inicial, tipo, cor, ativo)
  values (new.id, 'Minha Carteira', 0, 'Dinheiro', '#10b981', true);

  return new;
end;
$$ language plpgsql security definer;

-- Recriar trigger com drop trigger garantido
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- =========================================================================
-- 5. POPULAR CATEGORIAS PADRÃO DO SISTEMA (PÚBLICAS)
-- =========================================================================
insert into public.finance_categories (user_id, nome, tipo, cor, icone, ordem)
values 
  -- Receitas
  (null, 'Salário', 'receita', '#10b981', 'Briefcase', 1),
  (null, 'Venda', 'receita', '#34d399', 'ShoppingBag', 2),
  (null, 'Pix', 'receita', '#60a5fa', 'QrCode', 3),
  (null, 'Transferência', 'receita', '#a78bfa', 'Send', 4),
  (null, 'Outros', 'receita', '#94a3b8', 'HelpCircle', 5),
  -- Despesas
  (null, 'Mercado', 'despesa', '#f43f5e', 'ShoppingCart', 1),
  (null, 'Combustível', 'despesa', '#fb923c', 'Fuel', 2),
  (null, 'Moradia', 'despesa', '#f87171', 'Home', 3),
  (null, 'Lazer', 'despesa', '#f472b6', 'Sparkles', 4),
  (null, 'Saúde', 'despesa', '#22d3ee', 'Heart', 5),
  (null, 'Investimento', 'despesa', '#818cf8', 'TrendingUp', 6),
  (null, 'Outros', 'despesa', '#94a3b8', 'HelpCircle', 7)
on conflict (nome, tipo) where user_id is null do nothing;

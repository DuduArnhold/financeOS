-- =========================================================================
-- ESQUEMA DE BANCO DE DADOS CONSOLIDADO - FINANCEOS & MONEYBRIDGE
-- Execute este script no SQL Editor do seu projeto Supabase.
-- =========================================================================

-- Habilitar a extensão pgcrypto para uso do gen_random_uuid()
create extension if not exists pgcrypto;

-- =========================================================================
-- PARTE 1: FUNCÕES DE SUPORTE E SEGURANÇA
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
-- PARTE 2: NÚCLEO COMPARTILHADO (CORE)
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
-- PARTE 3: MÓDULO FINANCEOS (FINANÇAS PESSOAIS)
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

-- Categorias de Movimentações (com suporte a system_key)
create table public.finance_categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade, -- null indica categoria pública do sistema
  nome text not null,
  tipo text not null check (tipo in ('receita', 'despesa', 'ambos')),
  cor text,
  icone text,
  ordem integer default 0,
  system_key text unique, -- Identificador único de integração (ex: 'sale', 'salary')
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.finance_categories enable row level security;
create policy "Usuários veem categorias públicas e privadas" on public.finance_categories 
  for select using (user_id is null or auth.uid() = user_id);
create policy "Usuários gerenciam suas próprias categorias" on public.finance_categories 
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
  paid_at timestamp with time zone,
  categoria_preferida_id uuid references public.finance_categories(id) on delete set null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.finance_contas enable row level security;
create policy "Usuários gerenciam suas contas" on public.finance_contas 
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Trigger de auto-atualização do updated_at em finance_contas
drop trigger if exists set_updated_at_finance_contas on public.finance_contas;
create trigger set_updated_at_finance_contas
  before update on public.finance_contas
  for each row execute procedure public.update_updated_at_column();

-- Enum para controle de origem
create type public.movement_origin as enum (
  'manual',
  'conta',
  'lucro_simples',
  'ofx',
  'csv',
  'open_finance',
  'pix',
  'transferencia'
);

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
  conta_id uuid references public.finance_contas(id) on delete set null,
  origem public.movement_origin default 'manual'::public.movement_origin not null,
  origem_uuid uuid,
  origem_ref text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.finance_movements enable row level security;
create policy "Usuários gerenciam suas próprias movimentações" on public.finance_movements 
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Trigger de auto-atualização do updated_at em finance_movements
drop trigger if exists set_updated_at_finance_movements on public.finance_movements;
create trigger set_updated_at_finance_movements
  before update on public.finance_movements
  for each row execute procedure public.update_updated_at_column();

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

-- Tabela de Transferências entre contas
create table public.finance_transfers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  source_account_id uuid references public.finance_accounts(id) on delete cascade not null,
  target_account_id uuid references public.finance_accounts(id) on delete cascade not null,
  valor numeric not null check (valor > 0),
  data date not null default current_date,
  descricao text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.finance_transfers enable row level security;
create policy "Usuários gerenciam suas próprias transferências" on public.finance_transfers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- =========================================================================
-- PARTE 4: EVENTOS E MAPEAMENTOS DO MONEYBRIDGE
-- =========================================================================

-- Tabela de Eventos (Auditoria e Idempotência)
create table public.moneybridge_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  origin text not null,
  event_id text not null,
  event_type text not null,
  status text not null check (status in ('processing', 'processed', 'failed')),
  payload jsonb not null,
  normalized_payload jsonb,
  duration_ms integer,
  error text,
  processed_by text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(origin, event_id)
);

alter table public.moneybridge_events enable row level security;
create policy "Usuários gerenciam seus eventos" on public.moneybridge_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Tabela de Mapeamentos (Mappings)
create table public.integration_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  origin text not null,
  event_type text not null,
  account_id uuid references public.finance_accounts(id) on delete cascade not null,
  category_id uuid references public.finance_categories(id) on delete cascade not null,
  priority integer default 0 not null,
  enabled boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, origin, event_type, priority)
);

alter table public.integration_mappings enable row level security;
create policy "Usuários gerenciam seus mapeamentos de integração" on public.integration_mappings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- =========================================================================
-- PARTE 5: ÍNDICES DE PERFORMANCE E UNICIDADE
-- =========================================================================
create index if not exists idx_finance_movements_user on public.finance_movements(user_id);
create index if not exists idx_finance_movements_date on public.finance_movements(data);
create index if not exists idx_finance_movements_account on public.finance_movements(account_id);
create index if not exists idx_finance_movements_category on public.finance_movements(categoria_id);
create index if not exists idx_finance_movements_conta on public.finance_movements(conta_id);
create index if not exists idx_finance_contas_user on public.finance_contas(user_id);
create index if not exists idx_finance_accounts_user on public.finance_accounts(user_id);
create index if not exists idx_user_modules_user on public.user_modules(user_id);

create index if not exists idx_finance_transfers_user on public.finance_transfers(user_id);
create index if not exists idx_finance_transfers_source on public.finance_transfers(source_account_id);
create index if not exists idx_finance_transfers_target on public.finance_transfers(target_account_id);
create index if not exists idx_finance_transfers_date on public.finance_transfers(data);

-- Índices de Unicidade de Categorias
create unique index if not exists idx_finance_categories_uniq_system 
  on public.finance_categories (nome, tipo) 
  where user_id is null;

create unique index if not exists idx_finance_categories_uniq_user 
  on public.finance_categories (user_id, nome, tipo) 
  where user_id is not null;


-- =========================================================================
-- PARTE 6: TRIGGER TRANSACIONAL DE NOVOS USUÁRIOS
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger as $$
declare
  var_account_id uuid;
  var_category_id uuid;
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

  -- 4. Criar conta financeira default e capturar o ID
  insert into public.finance_accounts (user_id, nome, saldo_inicial, tipo, cor, ativo)
  values (new.id, 'Minha Carteira', 0, 'Dinheiro', '#10b981', true)
  returning id into var_account_id;

  -- 5. Buscar categoria sistêmica de vendas ('sale')
  select id into var_category_id
  from public.finance_categories
  where system_key = 'sale'
  limit 1;

  -- 6. Criar mapeamento de integração padrão do Lucro Simples
  if var_account_id is not null and var_category_id is not null then
    insert into public.integration_mappings (user_id, origin, event_type, account_id, category_id, priority, enabled)
    values (new.id, 'lucro_simples', 'sale.closed', var_account_id, var_category_id, 0, true);
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Associar trigger ao evento de cadastro de novos usuários do auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- =========================================================================
-- PARTE 7: FUNÇÕES TRANSACIONAIS ADICIONAIS (CONTAS E DOMÍNIO)
-- =========================================================================

-- Função para pagar conta
create or replace function public.pay_conta(
  p_conta_id uuid,
  p_user_id uuid,
  p_account_id uuid,
  p_categoria_id uuid,
  p_forma_pagamento text,
  p_data date,
  p_observacao text
)
returns void as $$
declare
  v_valor numeric;
begin
  select valor into v_valor from public.finance_contas where id = p_conta_id and user_id = p_user_id;
  
  if v_valor is null then
    raise exception 'Conta não encontrada ou não pertence ao usuário.';
  end if;

  update public.finance_contas
  set paga = true,
      paid_at = timezone('utc'::text, now()),
      categoria_preferida_id = p_categoria_id
  where id = p_conta_id and user_id = p_user_id;

  insert into public.finance_movements (
    user_id,
    tipo,
    valor,
    categoria_id,
    account_id,
    forma_pagamento,
    data,
    descricao,
    conta_id,
    origem,
    origem_uuid
  ) values (
    p_user_id,
    'despesa',
    v_valor,
    p_categoria_id,
    p_account_id,
    p_forma_pagamento,
    p_data,
    p_observacao,
    p_conta_id,
    'conta'::public.movement_origin,
    p_conta_id
  );
end;
$$ language plpgsql security definer;

-- Função para desfazer pagamento de conta
create or replace function public.unpay_conta(
  p_conta_id uuid,
  p_user_id uuid,
  p_delete_movement boolean
)
returns void as $$
begin
  update public.finance_contas
  set paga = false,
      paid_at = null
  where id = p_conta_id and user_id = p_user_id;

  if p_delete_movement then
    delete from public.finance_movements
    where conta_id = p_conta_id and user_id = p_user_id;
  else
    update public.finance_movements
    set conta_id = null
    where conta_id = p_conta_id and user_id = p_user_id;
  end if;
end;
$$ language plpgsql security definer;


-- =========================================================================
-- PARTE 8: SEED DE CATEGORIAS PADRÃO
-- =========================================================================
insert into public.finance_categories (user_id, nome, tipo, cor, icone, ordem, system_key)
values 
  -- Receitas
  (null, 'Salário', 'receita', '#10b981', 'Briefcase', 1, 'salary'),
  (null, 'Venda', 'receita', '#34d399', 'ShoppingBag', 2, 'sale'),
  (null, 'Pix', 'receita', '#60a5fa', 'QrCode', 3, 'pix'),
  (null, 'Transferência', 'receita', '#a78bfa', 'Send', 4, 'transfer'),
  (null, 'Outros', 'receita', '#94a3b8', 'HelpCircle', 5, 'other_income'),
  -- Despesas
  (null, 'Mercado', 'despesa', '#f43f5e', 'ShoppingCart', 1, 'market'),
  (null, 'Combustível', 'despesa', '#fb923c', 'Fuel', 2, 'fuel'),
  (null, 'Moradia', 'despesa', '#f87171', 'Home', 3, 'housing'),
  (null, 'Lazer', 'despesa', '#f472b6', 'Sparkles', 4, 'leisure'),
  (null, 'Saúde', 'despesa', '#22d3ee', 'Heart', 5, 'health'),
  (null, 'Investimento', 'despesa', '#818cf8', 'TrendingUp', 6, 'investment'),
  (null, 'Outros', 'despesa', '#94a3b8', 'HelpCircle', 7, 'other_expense')
on conflict (nome, tipo) where user_id is null 
do update set system_key = excluded.system_key;

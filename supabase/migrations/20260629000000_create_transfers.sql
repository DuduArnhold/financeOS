-- MIGRATION: CRIAÇÃO DA TABELA DE TRANSFERÊNCIAS (finance_transfers)

-- 1. Criar tabela de transferências
create table if not exists public.finance_transfers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  source_account_id uuid references public.finance_accounts(id) on delete cascade not null,
  target_account_id uuid references public.finance_accounts(id) on delete cascade not null,
  valor numeric not null check (valor > 0),
  data date not null default current_date,
  descricao text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Habilitar Row Level Security (RLS)
alter table public.finance_transfers enable row level security;

-- 3. Criar políticas RLS de acesso proprietário
drop policy if exists "Usuários gerenciam suas próprias transferências" on public.finance_transfers;
create policy "Usuários gerenciam suas próprias transferências" on public.finance_transfers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. Adicionar índices de performance
create index if not exists idx_finance_transfers_user on public.finance_transfers(user_id);
create index if not exists idx_finance_transfers_source on public.finance_transfers(source_account_id);
create index if not exists idx_finance_transfers_target on public.finance_transfers(target_account_id);
create index if not exists idx_finance_transfers_date on public.finance_transfers(data);

-- =========================================================================
-- MIGRATION: integration_keys_and_audit
-- =========================================================================

-- 1. Criar a tabela de chaves de API com RLS
create table if not exists public.integration_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  origin text not null,
  key_hash text unique not null,
  prefix text not null,
  description text,
  permissions text[] default '{"*"}'::text[] not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_used_at timestamp with time zone,
  last_ip text,
  revoked_at timestamp with time zone,
  revoked_by uuid references public.profiles(id) on delete set null
);

alter table public.integration_keys enable row level security;

drop policy if exists "Usuários gerenciam suas chaves de API" on public.integration_keys;
create policy "Usuários gerenciam suas chaves de API" on public.integration_keys
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Permite que o servidor (webhook/anon) valide chaves por hash sem autenticação JWT
-- (hashes HMAC-SHA256 são irreversíveis, portanto safe para leitura pública)
create policy "Webhook pode validar chaves por hash"
  on public.integration_keys
  for select
  using (true);


-- 2. Adicionar as colunas de auditoria de tentativas no moneybridge_events
alter table public.moneybridge_events 
  add column if not exists attempt_count integer default 1 not null,
  add column if not exists last_attempt_at timestamp with time zone default timezone('utc'::text, now()) not null;

-- =========================================================================
-- 1. ADICIONAR SYSTEM_KEY EM CATEGORIAS E SEEDAR VALORES
-- =========================================================================
alter table public.finance_categories add column system_key text unique;

-- Atualizar categorias públicas do sistema
update public.finance_categories set system_key = 'salary' where user_id is null and nome = 'Salário' and tipo = 'receita';
update public.finance_categories set system_key = 'sale' where user_id is null and nome = 'Venda' and tipo = 'receita';
update public.finance_categories set system_key = 'pix' where user_id is null and nome = 'Pix' and tipo = 'receita';
update public.finance_categories set system_key = 'transfer' where user_id is null and nome = 'Transferência' and tipo = 'receita';
update public.finance_categories set system_key = 'other_income' where user_id is null and nome = 'Outros' and tipo = 'receita';

update public.finance_categories set system_key = 'market' where user_id is null and nome = 'Mercado' and tipo = 'despesa';
update public.finance_categories set system_key = 'fuel' where user_id is null and nome = 'Combustível' and tipo = 'despesa';
update public.finance_categories set system_key = 'housing' where user_id is null and nome = 'Moradia' and tipo = 'despesa';
update public.finance_categories set system_key = 'leisure' where user_id is null and nome = 'Lazer' and tipo = 'despesa';
update public.finance_categories set system_key = 'health' where user_id is null and nome = 'Saúde' and tipo = 'despesa';
update public.finance_categories set system_key = 'investment' where user_id is null and nome = 'Investimento' and tipo = 'despesa';
update public.finance_categories set system_key = 'other_expense' where user_id is null and nome = 'Outros' and tipo = 'despesa';

-- =========================================================================
-- 2. TABELA DE EVENTOS DO MONEYBRIDGE (AUDITORIA E IDEMPOTÊNCIA)
-- =========================================================================
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

-- =========================================================================
-- 3. TABELA DE MAPEAMENTOS DE INTEGRAÇÃO (MAPPINGS)
-- =========================================================================
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
-- 4. ATUALIZAR TRIGGER DE NOVOS USUÁRIOS PARA CRIAR MAPEAMENTO DEFAULT
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

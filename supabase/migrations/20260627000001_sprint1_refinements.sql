-- 1. Criar o enum para controle de origem
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

-- 2. Adicionar relacionamento de conta a pagar, origens flexíveis (UUID interno + REF externa) e auditoria em finance_movements
alter table public.finance_movements 
add column conta_id uuid references public.finance_contas(id) on delete set null,
add column origem public.movement_origin default 'manual'::public.movement_origin not null,
add column origem_uuid uuid,
add column origem_ref text,
add column updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
add column deleted_at timestamp with time zone;

create index if not exists idx_finance_movements_conta on public.finance_movements(conta_id);

-- Trigger de auto-atualização do updated_at em finance_movements
drop trigger if exists set_updated_at_finance_movements on public.finance_movements;
create trigger set_updated_at_finance_movements
  before update on public.finance_movements
  for each row execute procedure public.update_updated_at_column();

-- 3. Adicionar data de pagamento, preferência de categoria e auditoria em finance_contas
alter table public.finance_contas 
add column paid_at timestamp with time zone,
add column categoria_preferida_id uuid references public.finance_categories(id) on delete set null,
add column updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
add column deleted_at timestamp with time zone;

-- Trigger de auto-atualização do updated_at em finance_contas
drop trigger if exists set_updated_at_finance_contas on public.finance_contas;
create trigger set_updated_at_finance_contas
  before update on public.finance_contas
  for each row execute procedure public.update_updated_at_column();

-- 4. Função Transacional para Pagar Conta (pay_conta)
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
  -- Obter valor da conta
  select valor into v_valor from public.finance_contas where id = p_conta_id and user_id = p_user_id;
  
  if v_valor is null then
    raise exception 'Conta não encontrada ou não pertence ao usuário.';
  end if;

  -- 1. Atualizar a conta a pagar
  update public.finance_contas
  set paga = true,
      paid_at = timezone('utc'::text, now()),
      categoria_preferida_id = p_categoria_id
  where id = p_conta_id and user_id = p_user_id;

  -- 2. Inserir a despesa vinculada
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

-- 5. Função Transacional para Desfazer Pagamento (unpay_conta)
create or replace function public.unpay_conta(
  p_conta_id uuid,
  p_user_id uuid,
  p_delete_movement boolean
)
returns void as $$
begin
  -- 1. Marcar a conta como pendente
  update public.finance_contas
  set paga = false,
      paid_at = null
  where id = p_conta_id and user_id = p_user_id;

  -- 2. Tratar a movimentação associada
  if p_delete_movement then
    -- Excluir fisicamente (ou soft delete se preferir no futuro)
    delete from public.finance_movements
    where conta_id = p_conta_id and user_id = p_user_id;
  else
    -- Apenas desvincular a transação da conta para manter histórico físico
    update public.finance_movements
    set conta_id = null
    where conta_id = p_conta_id and user_id = p_user_id;
  end if;
end;
$$ language plpgsql security definer;

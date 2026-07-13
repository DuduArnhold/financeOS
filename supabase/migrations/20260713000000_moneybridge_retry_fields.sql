-- =========================================================================
-- MIGRATION: moneybridge_retry_fields
-- =========================================================================

-- 1. Adicionar colunas de suporte a retries, temporização e rastreabilidade
alter table public.moneybridge_events 
  add column if not exists first_attempt_at timestamp with time zone,
  add column if not exists next_retry_at timestamp with time zone,
  add column if not exists normalizer_version integer default 1 not null,
  add column if not exists processing_started_at timestamp with time zone;

-- 2. Criar índice parcial de alta performance para a varredura do RetryExecutor
create index if not exists idx_moneybridge_events_retry
  on public.moneybridge_events (status, next_retry_at)
  where status = 'failed';

-- 3. Criar a função SQL para buscar e bloquear eventos falhos elegíveis com SKIP LOCKED
create or replace function public.claim_failed_events_for_retry(
  max_attempts_param int,
  limit_param int
)
returns setof public.moneybridge_events
language plpgsql
security definer
as $$
begin
  return query
  select *
  from public.moneybridge_events
  where status = 'failed'
    and attempt_count < max_attempts_param
    and next_retry_at <= timezone('utc'::text, now())
  order by next_retry_at asc
  limit limit_param
  for update skip locked;
end;
$$;

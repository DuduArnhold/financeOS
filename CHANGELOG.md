# Changelog: FinanceOS & MoneyBridge

Este arquivo documenta todas as decisões técnicas estruturais, marcos operacionais e novas capacidades introduzidas na plataforma MoneyBridge do FinanceOS.

---

## [v0.7.0] - 2026-07-13
### Adicionado
- **Homologação Operacional**: Webhooks reais integrados com banco de dados de produção do Supabase com tratamento correto de RLS.
- **RetryExecutor**: Motor de reprocessamento automático periódico integrado com o banco de dados (`claim_failed_events_for_retry` via `FOR UPDATE SKIP LOCKED`).
- **Política de Backoff**: Cálculo resiliente de retentativas usando Backoff Exponencial com Jitter de ±15%.
- **Evitar Conflito de Chave Única**: Atualização em lote no `Orchestrator` em vez de inserção cega quando o log de evento já existe.
- **Renomeação Semântica**: Migração do conceito `handleStoredEvent` para `rehydrateEvent`.
- **Governança Operacional**: Introdução do registro de observações permanente `docs/operations/operational-observations.md`.

---

## [v0.6.0] - 2026-07-07
### Adicionado
- **Segurança de Webhook**: Validação de chaves de API com hash HMAC-SHA256 (`integration_keys`).
- **Sanitização**: Filtro contra proxies e sanitização de IPs de ingresso.
- **Platform Hardening**: Janelas de rate-limiting deslizante para prevenção de ataques DOS nos endpoints de integração.
- **Logs Estruturados**: Logging formatado em JSON para rastreamento de requests e tracing de chamadas com correlation ID.

---

## [v0.5.0] - 2026-06-30
### Adicionado
- **MoneyBridge Core**: Introdução do `MoneyBridgeOrchestrator` para coordenação de eventos.
- **Conectores e Normalizadores**: Mapeamento do conector `Lucro Simples` traduzindo payloads brutos externos para canônicos (`PlatformEvent`).
- **Event Bus em Memória**: Barramento de eventos unificado para desacoplamento de módulos de domínio.
- **Registry de Handlers**: Registro dinâmico de tratadores de eventos de negócio (Vendas e Compras).

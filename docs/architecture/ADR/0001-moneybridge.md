# ADR 0001: MoneyBridge Integration Architecture

## Status
Aprovado (Revisão de Baseline da Sprint 3)

## Contexto
O FinanceOS precisa se conectar a sistemas externos como o Lucro Simples para automatizar entradas e saídas de caixa. Integrações ponto a ponto criam acoplamento rígido que dificulta a manutenção e a adição de novos canais (como PIX, OFX ou outras plataformas de e-commerce).

## Decisão
Implementar o **MoneyBridge** como o orquestrador de integrações da JA Platform, isolando os conectores externos e as regras de mapeamento do domínio financeiro central.

### Fluxo de Componentes:
`Connector` (recebe payload) → `Normalizer` (converte para formato imutável da plataforma) → `PlatformPublisher` (gateway de auditoria/validação) → `EventBus` → `MoneyBridge Orchestrator` → `Registry` (resolve handler) → `Handler` (despacha Command) → `CommandBus` → `CommandHandler` → `MovementService` → `Supabase`.

### Idempotência:
Toda verificação de processamento único será feita usando a chave única `(origin, event_id)` na tabela de logs `moneybridge_events`.

# ADR 0003: Command Bus and Command Handlers (CQRS)

## Status
Aprovado (Revisão de Baseline da Sprint 3)

## Contexto
O domínio de negócio do FinanceOS (gravação de movimentações, atualização de metas) deve ser protegido contra dependências de infraestrutura de integrações. Não devemos misturar lógica de parsing de eventos com ações diretas no banco de dados.

## Decisão
Implementar um **Command Bus** (`ICommandBus`) síncrono. 
* Os manipuladores de integração (`EventHandlers`) geram instâncias de `PlatformCommand` (puros, com tipos primitivos escalares).
* O `CommandBus` despacha o comando para o respectivo handler de comando (`ICommandHandler`) que implementa a lógica do caso de uso (ex: `CreateMovementCommandHandler`).
* A arquitetura deixa preparada a assinatura para futuramente encadear middlewares de log, validação de segurança e retentativas transacionais.

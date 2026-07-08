# JA Platform — MoneyBridge Data Flow

O diagrama a seguir descreve a jornada visual completa do processamento de eventos do MoneyBridge, desde o recebimento de dados do sistema externo até a persistência no banco de dados do FinanceOS.

```mermaid
sequenceDiagram
    autonumber
    participant LS as Lucro Simples (Externo)
    participant Conn as LucroSimplesConnector
    participant Norm as LucroSimplesNormalizer
    participant Pub as PlatformPublisher
    participant Bus as MemoryEventBus
    participant Orch as MoneyBridgeOrchestrator
    participant Repo as IntegrationRepository
    participant Registry as HandlerRegistry
    participant Handler as SaleClosedHandler
    participant CBus as CommandBus
    participant CHan as CreateMovementCommandHandler
    participant DB as Supabase (PostgreSQL)

    LS->>Conn: Fechamento de Caixa (Raw Data)
    Conn->>Norm: Enviar dados crus
    Norm->>Norm: Traduzir para NormalizedSale
    Norm->>Conn: Retornar NormalizedSale
    Conn->>Pub: Publicar Evento
    Pub->>Bus: Enviar PlatformEvent
    Bus->>Orch: Entregar evento assinado
    Orch->>Repo: Validar Idempotência (origin, event_id)
    Note over Orch, Repo: Grava com status 'processing' no Supabase
    Orch->>Registry: Resolver Handler por (origin, type, version)
    Registry-->>Orch: Retorna SaleClosedHandler
    Orch->>Repo: Consultar mappings ativos do usuário
    Repo-->>Orch: Retorna mapping (Conta & Categoria)
    Orch->>Handler: Executar Handler com mapping
    Handler->>CBus: Despachar CreateMovementCommand (Puro)
    CBus->>CHan: Executar CommandHandler correspondente
    CHan->>DB: Persistir Movimentação Financeira
    CHan-->>Handler: Sucesso
    Handler-->>Orch: Finalizado
    Orch->>Repo: Atualizar status do evento para 'processed'
```

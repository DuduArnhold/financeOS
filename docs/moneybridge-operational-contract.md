# Contrato Operacional do MoneyBridge

Este documento estabelece as diretrizes arquiteturais, contratos de dados, garantias operacionais e restrições para qualquer conector ou fluxo de processamento no ecossistema MoneyBridge.

---

## 1. Eventos Suportados e Formatos Canônicos

Todo evento normalizado pela plataforma deve seguir o tipo genérico `PlatformEvent<T>` definido em `src/platform/types.ts`. Os payloads (`payload: T`) canônicos homologados são:

### 1.1 `NormalizedSale` (Vendas)
Utilizado para `sale.closed`, `sale.cancelled` e `sale.refunded`.
* `occurredAt`: Data/Hora ISO 8601 UTC.
* `amount`: Valor decimal absoluto maior que zero (ex: `1300.00`).
* `currency`: Código ISO 4217 (ex: `'BRL'`).
* `description`: Descrição legível humana da operação.
* `tags`: Lista de strings adicionais para rotulagem (ex: `['lucro_simples']`).
* `vendaId`: Identificador único de referência externa.

### 1.2 `NormalizedPurchase` (Compras/Despesas)
Utilizado para `purchase.created` e `purchase.paid`.
* `occurredAt`: Data/Hora ISO 8601 UTC.
* `amount`: Valor decimal absoluto maior que zero.
* `currency`: Código ISO 4217.
* `description`: Descrição legível humana da operação.
* `tags`: Lista de strings adicionais.
* `compraId`: Identificador único de referência externa da compra.

---

## 2. Pipeline Oficial de Processamento

O fluxo de processamento de dados é dividido em dois pipelines distintos para evitar que operações em lote (sincronização/replays) sobrecarreguem ou impactem negativamente o processamento em tempo real (ingestão).

### 2.1 Pipeline de Ingestão (Tempo Real)
Responsável por receber webhooks imediatos externos de plataformas parceiras.

```
Origem (Webhook)
       ↓
 [ Normalizer ]
       ↓
 [ PlatformEvent (Validação) ]
       ↓
 [ RetryExecutor (Persistência/Garantia) ]
       ↓
 [ MoneyBridgeOrchestrator ]
       ↓
 [ Handlers e Persistência de Domínio ]
```

### 2.2 Pipeline de Sincronização (Lotes / Histórico)
Responsável por cargas em lote, replays manuais/automáticos de auditoria e reconciliações periódicas.

```
Replay / Carga Histórica / Reconciliação
                  ↓
           [ Sync Engine ]
                  ↓
 [ PlatformEvent (Validação) ]
                  ↓
 [ RetryExecutor (Persistência/Garantia) ]
                  ↓
 [ MoneyBridgeOrchestrator ]
                  ↓
 [ Handlers e Persistência de Domínio ]
```

### 2.3 Pipeline de Reprocessamento (Retry / Replay)
Fluxo detalhado de reprocessamento (rehidratação) de eventos históricos ou falhos sem burlar o pipeline e regras:

```
[ RetryExecutor / Replay Service ]
                  ↓
   [ Connector (rehydrateEvent) ]
                  ↓
     [ Normalizer (Reconstrução) ]
                  ↓
     [ PlatformEvent (Validação) ]
                  ↓
     [ MoneyBridgeOrchestrator ]
                  ↓
 [ Handlers e Persistência de Domínio ]
```

---

## 3. Garantias e Políticas Operacionais

A plataforma oferece as seguintes garantias funcionais:
* **Idempotência**: Nenhum evento com o mesmo `origin` e `eventId` será processado mais de uma vez. Eventos duplicados são detectados na camada do `Orchestrator` e marcados como duplicados com status `processed` sem reexecutar os handlers.
* **Auditoria de Entrada**: Todos os eventos recebidos com sucesso na rota HTTP ou via carga histórica são registrados imediatamente na tabela `moneybridge_events` com status `processing` antes do pipeline de domínio rodar.
* **Reprodutibilidade (Replay)**: Qualquer evento processado com falha (`failed`) é passível de Replay manual ou automático, reexecutando exatamente o mesmo pipeline sem side-effects no banco além dos esperados.
* **Rastreabilidade**: Todos os passos de logs gerados no ecossistema compartilham o mesmo `correlationId` para depuração simplificada.
* **Acionamento do RetryExecutor**: O `RetryExecutor` persistirá as tentativas e estados de falha no banco de dados. O acionamento ("quem acorda os retries") será orquestrado por um **Supabase Cron (`pg_net` / `pg_cron`)** acionando periodicamente (ex: a cada 5 minutos) uma **Supabase Edge Function** ou uma rota de API segura no Next.js (ex: `/api/moneybridge/retry-executor`), responsável por executar `RetryExecutor.scan()`.

---

## 4. Métricas de Performance e SLA

Para garantir a qualidade de serviço e a fluidez do sistema, a plataforma é desenhada sob as seguintes diretrizes de desempenho e monitoramento:
* **Objetivos de Latência (SLOs)**: Os tempos de latência (como P95 < 200 ms e P99 < 500 ms para o tempo total do webhook até a persistência) representam objetivos internos de qualidade de software (SLOs) sob ambiente padrão homologado, não constituindo um contrato de SLA rígido suscetível a variações de infraestrutura de rede, VPS ou banco de dados.
* **Vazão e Consistência**: O sistema deve manter consistência transacional, idempotência e latência operacional aceitável durante processamento contínuo sob cargas compatíveis com os limites do ambiente homologado.
* **Taxa de Retries**: Retries executados, recuperados e falhos devem ser catalogados para diagnóstico no painel de controle.
* **Abstração de Métricas**: O `IntegrationMetricsProvider` representa uma abstração lógica para a coleta e exibição de dados de performance. A implementação inicial utiliza consultas SQL diretas. Futuramente, para garantir escalabilidade frente a milhões de linhas de eventos, esta camada poderá ser substituída por views materializadas (Materialized Views), cache em Redis ou integração direta com OpenTelemetry, sem alteração no contrato técnico ou quebra da UI.

---

## 5. Governança e Restrições Arquiteturais

* **Compatibilidade Obrigatória**: Toda alteração arquitetural envolvendo conectores, replay, sincronização ou processamento de eventos deve permanecer compatível com este Contrato Operacional. Caso uma alteração exija violar esse contrato, o próprio contrato deve ser revisado e aprovado em comitê/design review antes da implementação do código.
* **Violações**: Serão tratadas como dívidas técnicas severas as seguintes ações:
  1. Chamar handlers de domínio diretamente a partir de rotas ou conectores sem passar pelo `Orchestrator`.
  2. Criar tabelas auxiliares de transações para conectores específicos que contornem a lógica financeira unificada.
  3. Modificar o formato do `PlatformEvent` ou criar payloads proprietários que não implementem os contratos canônicos (`NormalizedSale` / `NormalizedPurchase`).
  4. Executar persistências diretas no banco de dados do FinanceOS sem passar pelo pipeline de eventos e seus handlers correspondentes.

---

## 6. Non-Goals (Fora de Escopo do MoneyBridge)

Para evitar desvios no escopo da plataforma e debates conceituais futuros, fica estabelecido que o MoneyBridge **NÃO**:
- **Transforma Regras de Negócio de Domínio**: Não aplica regras tributárias, comissionamentos complexos ou cálculos específicos de margem do comerciante. Essa responsabilidade pertence ao ERP/origem ou às telas do FinanceOS.
- **Calcula Indicadores Financeiros**: Não consolida o dashboard principal do FinanceOS, fluxo de caixa acumulado ou DRE diretamente no pipeline. Ele simplesmente cria as transações de base (`finance_movements`, `finance_contas`) para que o Core do FinanceOS processe estes indicadores.
- **Altera Payloads de Origem**: Não remove ou limpa propriedades brutas do webhook recebido. O payload original é mantido intacto em `moneybridge_events.payload` para auditoria e replays futuros de forma fidedigna.
- **Cria Atalhos para Handlers**: Não permite saltar etapas como normalização ou orquestração para otimizar latências individuais às custas da integridade estrutural.
- **Executa Integrações diretamente no Banco**: Não substitui a execução síncrona/lotes por manipulações de procedures internas do Postgres além das APIs de repositórios homologadas.

---

## 7. Fora do Escopo da Fase 1 (Out de Escopo)

Para manter o foco na entrega e mitigar riscos técnicos, os seguintes itens estão explicitamente fora do escopo desta fase do MoneyBridge e não serão implementados:
- Integração nativa com **OpenTelemetry** no código de negócio.
- Uso de **filas distribuídas dedicadas** (como BullMQ, Kafka ou RabbitMQ).
- Suporte a **múltiplos conectores** externos além do `Lucro Simples`.
- Infraestrutura de **escalabilidade horizontal complexa** ou auto-scaling sob demanda.
- **Particionamento horizontal** ou sharding de tabelas do banco de dados.
- Implementação de um padrão de **Event Sourcing completo** ou framework de **CQRS** estrito na arquitetura do Core.

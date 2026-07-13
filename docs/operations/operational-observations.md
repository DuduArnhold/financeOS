# Registro de Observações Operacionais (MoneyBridge)

Este documento atua como diário e histórico operacional de longo prazo para a plataforma MoneyBridge. Seu objetivo é catalogar o comportamento real do sistema sob carga, isolando fatos (sintomas e evidências) de inferências (hipóteses), direcionando decisões de engenharia com base em dados reais de produção.

> [!IMPORTANT]
> **Critério de Intervenção**: Nenhuma alteração de código será realizada durante as janelas de observação ativa, exceto quando houver perda de dados, corrupção de estado, indisponibilidade total da plataforma ou vulnerabilidade crítica de segurança. Todas as demais ocorrências serão registradas e avaliadas apenas após o encerramento da janela.

---

## 1. Classificação e Taxonomia de Decisão

### Classificação de Ocorrências (Tipo)
- **Informação**: Comportamento esperado da plataforma (ex: descarte de duplicados, retries bem-sucedidos).
- **Atenção**: Comportamento anômalo que não impacta a operação imediata, mas merece acompanhamento (ex: oscilação de latência).
- **Bug**: Erro funcional ou de validação que requer correção, mas não interrompe o fluxo crítico de dados.
- **Incidente**: Falha impeditiva que compromete a integridade do sistema ou interrompe a operação.

### Classificação de Severidade (Impacto)
- **S0 (Perda de Dados)**: Corrupção, deleção acidental ou perda de integridade de dados históricos/financeiros.
- **S1 (Operação Parada)**: Fluxo de webhooks bloqueado ou indisponibilidade total de rotas críticas da plataforma.
- **S2 (Funcionalidade Degradada)**: Serviços operando de forma lenta, retries excessivos ou indisponibilidade parcial não impeditiva.
- **S3 (Problema Cosmético)**: Erros leves de interface ou logs incoerentes sem impacto prático no processamento.

### Classificação de Decisão
- **Não agir**: Comportamento resolvido por resiliência nativa ou evento transitório irrelevante.
- **Monitorar**: Adicionar observabilidade/logs específicos na próxima sprint para coletar mais dados.
- **Corrigir**: Bug ou falha que será corrigido em sprint subsequente.
- **Abrir melhoria**: Identificada oportunidade de otimização operacional.
- **Rever arquitetura**: Evento que desafia premissas do contrato operacional.

---

## 2. Diário de Bordo (Ocorrências)

| ID | Data/Hora | Sintoma Observado | Evidências (logs, IDs, queries) | Origem | Hipótese | Impacto | Sev. | Detectado Por | MTTD / MTTR | Decisão | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| *Exemplo* | *13/07/2026 14:22* | *Retry de webhook executado* | *Evento sale.closed, attempt=2, timeout no banco* | *RetryExecutor* | *Timeout temporário no banco do Supabase* | *Nenhum (retry concluiu com sucesso)* | *S2* | *Logs* | *MTTD: 3m / MTTR: 2m* | *Não agir* | *Encerrado* |

---

## 3. Resumos Operacionais Diários

### Dia 1 (13/07/2026)
- **Webhooks recebidos**: 
- **Processados com sucesso**: 
- **Duplicados descartados**: 
- **Retries disparados**: 
- **Replays acionados manualmente**: 
- **Falhas permanentes**: 
- **Latência Média / P95 / P99**: 
- **Eventos órfãos (inconsistências)**: 
- **Último erro crítico**: `Nenhum`
- **Disponibilidade observada**: 100%

### Dia 2 (14/07/2026)
- **Webhooks recebidos**: 
- **Processados com sucesso**: 
- **Duplicados descartados**: 
- **Retries disparados**: 
- **Replays acionados manualmente**: 
- **Falhas permanentes**: 
- **Latência Média / P95 / P99**: 
- **Eventos órfãos (inconsistências)**: 
- **Último erro crítico**: `Nenhum`
- **Disponibilidade observada**: 100%

---

## 4. Tendências Observadas
- *(Sem dados - Iniciando observação de 48h)*

---

## 5. Perguntas-Chave Operacionais (Avaliação de Fim de Ciclo)
- Existe alguma tendência de aumento na latência ao longo do tempo?
- Existe algum evento que concentra a maior parte dos retries?
- Existe algum horário recorrente com maior incidência de falhas?
- A fila de eventos consegue voltar a zero após períodos de maior carga?
- Algum componente ou origem concentrou mais de 80% das ocorrências registradas?
- Qual é a taxa real de duplicidade detectada no webhook?
- O console de logs permitiu que o operador identificasse e investigasse falhas de forma simples?

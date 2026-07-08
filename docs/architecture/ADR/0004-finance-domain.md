# ADR 0004: Finance Domain and System Keys

## Status
Aprovado (Revisão de Baseline da Sprint 3)

## Contexto
Quando dados de vendas externas (como fechamento de caixa) chegam, eles precisam ser mapeados para contas e categorias financeiras correspondentes no FinanceOS. Fazer essa busca baseando-se em strings de texto (ex: buscar por categoria chamada "Venda") gera dependências frágeis que quebram com rebatizados do usuário ou internacionalização (Sales, Ventas, etc.).

## Decisão
1. **System Keys em Categorias:** Adicionar a coluna `system_key` na tabela `finance_categories`. As categorias públicas nativas terão chaves únicas (ex: `'sale'` para Vendas, `'salary'` para Salário).
2. **Mapeamento de Usuário:** Toda busca de mapeamento padrão será feita consultando a categoria pela chave do sistema (ex: `system_key = 'sale'`), blindando as integrações contra rebatizados no front-end.
3. **Padrão de Mapeamentos:** A tabela `integration_mappings` associará a combinação de `(user_id, origin, event_type)` à conta e à categoria financeira configuradas, ordenadas por prioridade (`priority ASC`), aplicando a regra de correspondência *First-Match Wins*.

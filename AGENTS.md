<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Regras do Projeto FinanceOS & MoneyBridge

## Estabilidade da Arquitetura e Engenharia de Produto
- **Congelamento Arquitetural**: Nenhuma refatoração estrutural ou de design de software será realizada no MoneyBridge sem que um problema real em produção ou um novo requisito de negócio a justifique.
- **Observação Primeiro**: O monitoramento e a instrumentação da plataforma devem ser baseados no comportamento real em produção. Observamos falhas, latências e duplicidades em execução real por pelo menos 48 horas antes de desenhar ou implementar painéis ou alertas adicionais.
- **Entregas de Produto**: Cada sprint de desenvolvimento deve obrigatoriamente produzir algo que possa ser demonstrado e utilizado visualmente pelo usuário ou operador final, evitando o acúmulo de infraestrutura sem validação prática.
- **Disciplina da Sprint B (Registrar antes de Corrigir)**: Durante a janela de testes e operação real de 48 horas, registrar os problemas e anomalias no arquivo `observations.md` é mais prioritário do que corrigi-los. Deve-se avaliar impacto, frequência e causa antes de escrever qualquer código.
- **Congelamento Estrito de Domínio**: Fica vetada a criação de novos handlers, tabelas, componentes ou abstrações de código que não sejam correções críticas de segurança ou bugs impeditivos da operação.


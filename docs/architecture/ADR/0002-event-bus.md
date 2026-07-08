# ADR 0002: Event Bus Abstraction (IEventBus)

## Status
Aprovado (Revisão de Baseline da Sprint 3)

## Contexto
Diferentes partes da JA Platform precisam reagir a eventos de forma assíncrona. Inicialmente, a aplicação roda inteiramente no navegador do cliente (Next.js client-side). No entanto, a infraestrutura de publicação e assinatura de eventos deve poder migrar para servidores (Kafka, Redis, RabbitMQ ou Supabase Realtime) no futuro.

## Decisão
Abstrair o Event Bus sob uma interface genérica `IEventBus`. 

A primeira implementação para a Sprint 3A será um broker em memória local (`MemoryEventBus`), permitindo a assinatura genérica por meio de coringas `*` ou por tipo de evento e origem.

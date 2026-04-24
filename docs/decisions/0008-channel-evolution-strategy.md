# ADR 0008: Channel Evolution Strategy

## Status
Proposed

## Contexto
v1 é WhatsApp-only, mas o produto pode evoluir para app móvel/web. Decisão arquitetural de fundo: o domínio (diagnóstico, arquétipos, análise multimodal, assinatura, créditos) deve ser **channel-agnostic** desde o dia 0, ou acopla-se ao WhatsApp e refatora depois?

## Decisão
TBD — fechar na Fase 3. **Recomendação preliminar**: domínio channel-agnostic, WhatsApp como adapter.

## Opções Consideradas
- **(A) Channel-agnostic core + adapter**: `packages/core` puro, `packages/channels/whatsapp-adapter` plugável. Custo upfront ~15%. Migração para app: novo adapter, zero refactor de domínio.
- **(B) WhatsApp-coupled**: tudo no app principal, atalhos, mais rápido para v1. Migração para app: refactor pesado.
- **(C) Híbrido**: domínio começa acoplado, refatora quando app for decidido. Risco clássico de "depois vira nunca".

## Critérios de Decisão
- Probabilidade real de existir Fase 2 — App (≥60%? então (A)).
- Custo de tempo upfront aceitável.
- Capacidade do time de manter abstração sem cair em over-engineering.

## Consequências
- Se (A): `ChannelPort` derivada de 1 caso real (WhatsApp), não desenhada no abstrato. Testes de contrato no port desde o Épico 0.
- Se (B) ou (C): ADR explícito assumindo dívida técnica.

## Owner
@architect.

## Bloqueia
- Fase 3 — Arquitetura (estrutura de pacotes).

## Relacionado
- ADR 0001 — WhatsApp Gateway.
- ADR 0010 — Context Engineering Strategy (contexto também precisa ser channel-agnostic).

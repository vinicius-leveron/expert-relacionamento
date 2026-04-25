# ADR 0001: WhatsApp Gateway

## Status
Proposed

## Contexto
Canal único do MVP é WhatsApp. Existem três caminhos viáveis com perfis de risco, custo e velocidade de integração distintos.

## Decisão
TBD — fechar na Fase 3 (`@architect`).

## Opções Consideradas
- **Z-API**: integração rápida, custo previsível, **risco alto de banimento** (não-oficial).
- **Evolution API** (self-hosted): controle total, mesmo risco de banimento, custo ops próprio.
- **WhatsApp Cloud API** (Meta oficial): zero risco de banimento, custo por conversa, exige aprovação de templates e Business verification.

## Critérios de Decisão
- Custo por mensagem em volume MVP (1k–10k usuários).
- Risco de banimento e plano de mitigação.
- Latência p95 envio/recebimento.
- Suporte a interactive messages, mídia, templates.
- Time-to-first-message-sent.

## Consequências
TBD.

## Owner
@architect com input de Vinícius (risco de negócio).

## Bloqueia
- Fase 3 — Arquitetura (definição do `ChannelPort`).
- Épico 0 — Foundation (não dá para subir webhook sem decisão).

## Relacionado
- ADR 0008 — Channel Evolution Strategy.
- `docs/inputs/briefing-original.md` §Riscos.

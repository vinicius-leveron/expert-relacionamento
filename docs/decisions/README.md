# Architecture Decision Records — Perpétuo

Decisões arquiteturais e de produto **com impacto em código/sistema**. Cada ADR é imutável após `Accepted`; mudanças geram novo ADR que substitui (`Superseded by`).

## Convenção

- Numeração sequencial (`NNNN-slug.md`). Gaps são preservados (não renumeramos).
- Status: `Proposed` → `Accepted` | `Rejected` | `Superseded`.
- ADR é para decisão técnica com custo composto. Decisões de projeto/negócio ficam fora (ver seção abaixo).

## Índice

| # | Título | Status | Bloqueia | Owner |
|---|---|---|---|---|
| 0001 | WhatsApp Gateway | Proposed | Fase 3 — Arquitetura | @architect |
| 0002 | Payment Platform | Proposed | Fase 3 — Arquitetura | @pm + @architect |
| 0003 | Archetype Set | Proposed | Fase 5 — Conversation Design | Isabela + @pm |
| 0004 | Diagnostic Questions | Proposed | Fase 5 — Conversation Design | Isabela + @pm |
| 0008 | Channel Evolution Strategy | Proposed | Fase 3 — Arquitetura | @architect |
| 0009 | AI Provider Strategy | Proposed | Fase 3 — Arquitetura (NFR custo) | @architect |
| 0010 | Context Engineering Strategy | Proposed | Fase 3 + Fase 5 | @architect + Isabela |
| 0011 | User Identity Model | Proposed | Fase 3 — Arquitetura (schema) | @architect |

## Categorias

- **Bloqueante técnico** (impede arquitetura ou Épico 0): 0001, 0002, 0008, 0009, 0010, 0011.
- **Bloqueante de produto** (impede Épico 1+): 0003, 0004.

## Fora de escopo deste backlog

Pendências de projeto/negócio do briefing original que **não são ADRs** e devem ser rastreadas fora deste repo (ferramenta de gestão, contrato, conversa direta entre sócios):

- **Nome do produto e da IA** — decisão de marca. Quando definido, vira variável de configuração; não exige ADR. Referenciado em ADR 0010 como insumo externo.
- **Termo de sociedade Vinícius × Isabela** — jurídico/comercial.
- **Alocação do Marlon entre ENKRA e Perpétuo** — organizacional.

Se alguma dessas decisões gerar consequência técnica concreta (ex: Marlon entrar como co-lead e impor convenções ENKRA), aí sim cria-se ADR específico.

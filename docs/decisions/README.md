# Architecture Decision Records — Perpétuo

Decisões arquiteturais e de produto rastreáveis. Cada ADR é imutável após `Accepted`; mudanças geram novo ADR que substitui (`Superseded by`).

## Convenção

- Numeração sequencial (`NNNN-slug.md`).
- Status: `Proposed` → `Accepted` | `Rejected` | `Superseded`.
- Toda decisão com custo composto vira ADR. Não use ADR para escolha trivial.

## Índice

| # | Título | Status | Bloqueia | Owner |
|---|---|---|---|---|
| 0001 | WhatsApp Gateway | Proposed | Fase 3 — Arquitetura | @architect |
| 0002 | Payment Platform | Proposed | Fase 3 — Arquitetura | @pm + @architect |
| 0003 | Archetype Set | Proposed | Fase 5 — Conversation Design | Isabela + @pm |
| 0004 | Diagnostic Questions | Proposed | Fase 5 — Conversation Design | Isabela + @pm |
| 0005 | Product Naming | Proposed | Fase 3 — Arquitetura (branding) | Vinícius + Isabela |
| 0006 | Partnership Terms | Proposed | Não-bloqueante técnico | Vinícius + Isabela |
| 0007 | Marlon Allocation | Proposed | Não-bloqueante técnico | Vinícius + Marlon |
| 0008 | Channel Evolution Strategy | Proposed | Fase 3 — Arquitetura | @architect |
| 0009 | AI Provider Strategy | Proposed | Fase 3 — Arquitetura (NFR custo) | @architect |
| 0010 | Context Engineering Strategy | Proposed | Fase 3 + Fase 5 | @architect + Isabela |

## Categorias

- **Bloqueante técnico** (impede arquitetura ou Épico 0): 0001, 0002, 0008, 0009, 0010.
- **Bloqueante de produto** (impede Épico 1+): 0003, 0004, 0005.
- **Organizacional** (não bloqueia código): 0006, 0007.

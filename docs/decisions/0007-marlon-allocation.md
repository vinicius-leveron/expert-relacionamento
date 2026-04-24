# ADR 0007: Marlon Allocation

## Status
Proposed

## Contexto
Marlon é referência técnica de backend (projeto ENKRA). A alocação dele entre ENKRA e Perpétuo está indefinida. Afeta convenções (queremos espelhar ENKRA?) e disponibilidade para revisão.

## Decisão
TBD — decisão organizacional.

## Opções Consideradas
- **Espelhar convenções ENKRA**: source-tree, naming, libs base. Ganha consistência cross-projeto, perde autonomia.
- **Perpétuo autônomo**: stack independente, Marlon entra só como reviewer. Mais flexível, custo de manter padrões próprios.
- **Marlon co-lead técnico Perpétuo**: alocação 50/50, decisão arquitetural compartilhada.

## Critérios de Decisão
- Disponibilidade real do Marlon (horas/semana).
- Sobreposição de stack ENKRA × Perpétuo.
- Necessidade de revisão senior em decisões arquiteturais críticas.

## Consequências
TBD. **Não bloqueia** infra técnica — `@architect` toma decisões sozinho se necessário.

## Owner
Vinícius + Marlon.

## Bloqueia
- Nada técnico crítico. Pode atrasar refinamento de `docs/framework/source-tree.md` se quisermos espelhar ENKRA.

## Relacionado
- Fase 3 — Arquitetura.

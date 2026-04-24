# ADR 0005: Product Naming

## Status
Proposed

## Contexto
Codinome interno é "Perpétuo". Nome público do produto + nome da IA (persona) ainda não decididos. Afeta domínio, marca, copy e — crucialmente — system prompts (o nome da IA é injetado no contexto).

## Decisão
TBD.

## Opções Consideradas
A definir com Isabela. Variáveis em jogo:
- Nome do produto (SaaS): pode ser "Perpétuo" mesmo, ou outro.
- Nome da IA/persona (com voz da Isabela): precisa soar humano, feminino, próximo.
- Domínio + handle social disponíveis.

## Critérios de Decisão
- Disponibilidade de domínio `.com.br`, Instagram, marca INPI.
- Memorabilidade.
- Não-conflito com concorrente Cristal (Letícia Félix).
- Coerência com posicionamento anti-redpill.

## Consequências
TBD. Impacta: system prompts, repo naming, env vars, branding em mensagens.

## Owner
Vinícius + Isabela.

## Bloqueia
- Fase 3 — Arquitetura (apenas branding em logs/observabilidade — não bloqueia infra).
- Fase 5 — Conversation Design (nome da IA é variável de contexto).

## Relacionado
- ADR 0010 — Context Engineering Strategy (nome da IA vai no system prompt).

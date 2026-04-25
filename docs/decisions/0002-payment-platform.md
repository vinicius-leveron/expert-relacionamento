# ADR 0002: Payment Platform

## Status
Proposed

## Contexto
Modelo de assinatura anual (R$ 297–497) + venda de créditos avulsos. Brasil-first, PIX obrigatório, recorrência anual + upsell de créditos.

## Decisão
TBD — fechar na Fase 3.

## Opções Consideradas
- **Hotmart**: marketplace de infoprodutos, fee alto, ótimo para tracking afiliado, **fraco em recorrência granular**.
- **Kiwify**: similar a Hotmart, fee competitivo, suporte a recorrência, integrações via webhook.
- **Rubla**: gateway brasileiro com foco SaaS, recorrência nativa, menor base instalada.
- **Stripe + checkout próprio**: recorrência best-in-class, custo de implementação alto, PIX limitado.

## Critérios de Decisão
- Suporte nativo a recorrência anual + créditos avulsos no mesmo CPF.
- Fees totais (gateway + adquirente) em projeção 100/500/1k assinantes.
- Webhook reliability + DLQ.
- Estorno e disputa: fluxo claro?
- Tax handling (NF, retenção).

## Consequências
TBD.

## Owner
@pm + @architect; decisão financeira passa por Vinícius.

## Bloqueia
- Fase 3 — Arquitetura (módulo `subscription` + middleware "cliente ativo").
- Épico 0 — Foundation.

## Relacionado
- `docs/inputs/briefing-original.md` §Pendências #4.

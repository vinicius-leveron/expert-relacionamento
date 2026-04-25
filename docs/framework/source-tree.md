# Source Tree — Perpétuo

> **Status**: pending — populated after Phase 3 (`@architect`).
>
> Estrutura preliminar derivada do ADR 0008 (channel evolution) — sujeita a confirmação:
>
> ```
> packages/
>   core/                        # domínio puro, channel-agnostic, AI-provider-agnostic
>   ai-gateway/                  # context builders, provider adapters, guardrails (ADR 0009/0010)
>   channels/
>     whatsapp-adapter/          # ChannelPort impl WhatsApp (ADR 0001)
>   payment-gateway/             # PaymentPort impl (ADR 0002)
> apps/
>   api/                         # HTTP + webhooks WhatsApp + webhooks pagamento
>   worker/                      # filas (nurturing, reengajamento, sumarização de contexto)
> docs/                          # PRD, architecture, ADRs, framework, stories
> ```
>
> A versão final aqui especifica monorepo tool (turbo? nx? pnpm workspaces?), estrutura de testes, convenções de naming e regras de import (Constitution v1.0.0 exige absolute imports).

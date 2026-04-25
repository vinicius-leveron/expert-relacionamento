# ADR 0011: User Identity Model

## Status
Proposed

## Contexto
v1 só conhece usuários pelo número de WhatsApp. Quando vier o app (ADR 0008), o mesmo humano precisa ser **a mesma entidade** independente do canal — senão histórico, arquétipo, assinatura e créditos ficam fragmentados.

A escolha do identificador estável afeta:
- Schema do banco — toda tabela com `user_id` referencia essa entidade.
- Lógica de unificação (mesmo telefone via WhatsApp + email no app = 1 usuário ou 2?).
- LGPD (telefone é PII; UUID interno é melhor para logs).
- Fluxo de signup futuro do app.

Mudar isso depois é refactor sério (toda FK, todo log, toda integração analytics).

## Decisão
TBD — fechar na Fase 3.

## Opções Consideradas

### (A) UUID interno como PK; telefone e email são identidades externas
- `users.id` = UUID gerado internamente.
- `users.phone_e164` (único, normalizado E.164) — populado no primeiro contato WhatsApp.
- `users.email` (único, opcional) — populado quando app/checkout pedir.
- Tabela `user_identities` opcional para múltiplas formas de login no futuro.
- **Prós**: telefone fora dos logs, app + WhatsApp se reconciliam por telefone verificado, schema preparado para multi-canal.
- **Contras**: 1 camada extra de indireção desde o dia 0.

### (B) Telefone normalizado como PK
- `users.phone` (E.164) é a chave.
- **Prós**: simples, WhatsApp é o canal único hoje.
- **Contras**: telefone vaza em todo lugar (logs, FKs, métricas). Trocar de número = novo usuário ou migração manual. App futuro precisa forçar telefone como login.

### (C) Híbrido: telefone como ID público, UUID como surrogate interno
- Schema (A) mas APIs internas trafegam telefone.
- **Contras**: pior dos dois mundos, vazamento de PII volta.

## Critérios de Decisão
- LGPD: minimizar PII em logs/telemetria.
- Reconciliação cross-channel quando vier o app.
- Custo de migração se decidir errado.
- Compatibilidade com gateway de pagamento (CPF/email no checkout precisa amarrar no usuário).

## Recomendação preliminar
**(A)** — UUID interno + identidades externas. É o padrão de mercado para SaaS multi-canal e o custo upfront é baixo (1 coluna a mais, 1 join eventual). Decidir formalmente no benchmark de schema da Fase 3.

## Consequências
- Toda tabela do MVP usa FK `user_id` UUID.
- Webhook de WhatsApp resolve `phone_e164 → user_id` via lookup/upsert; o resto do sistema só vê `user_id`.
- Webhook de pagamento resolve `email → user_id` (ou cria associação se for primeira vez).
- Logs de aplicação carregam `user_id`, **nunca** telefone.
- `docs/architecture/message-pipeline.md` (Fase 3) inclui passo "resolve identity" no início do pipeline.

## Owner
@architect.

## Bloqueia
- Fase 3 — Arquitetura (schema do banco depende disso).
- Épico 0 — Foundation (primeira tabela `users` precisa estar resolvida).

## Relacionado
- ADR 0001 — WhatsApp Gateway (fonte do `phone_e164`).
- ADR 0002 — Payment Platform (fonte do `email` / amarração de checkout).
- ADR 0008 — Channel Evolution Strategy (motivação principal).
- ADR 0010 — Context Engineering Strategy (`user_id` é FK em `users.context_summary`).

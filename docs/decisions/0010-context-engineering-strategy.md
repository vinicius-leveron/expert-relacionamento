# ADR 0010: Context Engineering Strategy

## Status
Proposed

## Contexto
Em produto AI-heavy como Perpétuo, **engenharia de contexto não é detalhe de implementação — é metade do produto**. Define como o modelo recebe informação a cada turno conversacional, como a "voz da Isabela" se mantém estável, como o custo por chamada é controlado e como qualidade é medida.

Variáveis de contexto identificadas:
- **Identidade**: nome da IA (ADR 0005), system prompt com voz Isabela, guardrails anti-redpill.
- **Usuário**: arquétipo (ADR 0003), respostas do diagnóstico (ADR 0004), perfil declarado, dia do plano direcional 30d, histórico de uso.
- **Conversação**: histórico recente (N turnos) + sumário comprimido de turnos antigos.
- **Tarefa**: tipo de pedido (análise de print? perfil? coaching de mensagem? dúvida geral?).
- **Mídia**: imagens de print/perfil quando aplicável.
- **Memória de longo prazo**: preferências, padrões observados, gatilhos sensíveis (ex: divórcio recente, luto).

## Decisão
TBD — fechar na Fase 3 (arquitetura) + Fase 5 (conteúdo).

## Sub-decisões aninhadas

### 10.1 — System Prompt Architecture
- Single monolithic system prompt vs prompt em camadas (base voice + archetype overlay + task overlay).
- Versionamento: prompts como código, semver, A/B test.
- Onde mora: arquivo `prompts/` no repo? Banco? CMS?

### 10.2 — Memory Strategy
- **Sessão curta**: últimos N turnos sempre incluídos.
- **Sumário de longo prazo**: gerado periodicamente (ex: a cada 20 turnos), armazenado em `users.context_summary`, refrescado por job.
- **Fatos estruturados**: campos derivados (arquétipo, dia do plano) sempre injetados explicitamente, não via histórico.
- Janela de contexto budget: quanto cabe sem estourar custo NFR (ADR 0009).

### 10.3 — Prompt Caching
- Claude prompt caching: cachear system prompt + arquétipo + sumário do usuário (mudam pouco). Esperado: 60–80% redução de custo em conversas longas.
- Estratégia equivalente para outros providers (ADR 0009).

### 10.4 — Guardrails
- Camada pré-resposta: detecta vazamento de tom redpill, gírias proibidas, conselhos perigosos.
- Camada pós-resposta: scoring automático antes de enviar ao usuário; se score baixo, retry com instrução corretiva.
- Implementação: regex + classifier leve + LLM judge em sample.

### 10.5 — Eval Framework
- **Golden set**: ≥50 conversas-exemplo com saída esperada (curadas pela Isabela).
- **Scorer automático**: LLM judge com rubrica (voz, anti-redpill, utilidade, não-genérico).
- **Drift detection**: rodar eval no golden set a cada deploy de prompt; bloqueia merge se score cai.
- **Production sampling**: 1–5% das respostas reais passam por review humano (Isabela) semanalmente.

### 10.6 — Multimodal Context
- Análise de print: enviar imagem + system prompt específico + arquétipo do usuário + últimas 3 mensagens dele para contexto.
- Análise de perfil: imagem + system prompt diferente + arquétipo.
- **Não** misturar análise de print com histórico conversacional cheio (custo + ruído).

### 10.7 — Versionamento de Voz
- Quando Isabela ajusta a voz, como rolar para produção sem quebrar conversas em andamento?
- Política: prompts versionados, conversação em andamento usa versão que iniciou (sticky), nova conversa usa versão atual.

## Critérios de Decisão
- Custo médio por turno ≤ alvo (deriva do NFR R$ 30/usuário/mês).
- Qualidade percebida pela Isabela em eval blind ≥ 8/10.
- Drift detectável em <24h após release.
- Tempo de iteração de prompt (Isabela pede ajuste → produção): <1 dia.

## Consequências
- Schema do banco precisa de: `users.context_summary`, `users.archetype_id`, `users.plan_day`, `prompt_versions`, `conversation_messages` com `prompt_version_used`.
- Repo precisa de pasta `prompts/` versionada (ou serviço dedicado).
- Pipeline CI precisa rodar eval golden set antes de deploy.
- Camada `packages/ai-gateway` carrega context builders + guardrails + caching, não só chamada bruta ao provider.

## Owner
@architect (mecânica) + Isabela (conteúdo) + @pm (prioridades).

## Bloqueia
- Fase 3 — Arquitetura (camada AI gateway depende disso).
- Fase 5 — Conversation Design (voice.md derivado dos prompts).
- Épico 1 — Diagnóstico não roda sem context builder.

## Relacionado
- ADR 0003, 0004, 0005 (insumos de conteúdo).
- ADR 0009 — AI Provider Strategy.
- `docs/context-engineering/` (a ser criado na Fase 3).

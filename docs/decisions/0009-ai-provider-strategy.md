# ADR 0009: AI Provider Strategy

## Status
Proposed

## Contexto
Produto é AI-heavy: diagnóstico, análise de print de conversa (multimodal), análise de perfil Tinder/Instagram (multimodal), nurturing, reengajamento. NFR de custo: <R$ 30 / usuário / mês. NFR de latência: resposta WhatsApp p95 < 8s. Voz da Isabela é IP de produto e precisa ser estável.

## Decisão
TBD — fechar na Fase 3 com benchmark real, **não com afinidade pessoal**.

## Sub-decisões aninhadas

### 9.1 — Provider primário
- **Claude (Anthropic)**: prompt caching nativo, multimodal forte, bom em PT-BR, bom em seguir persona/voz.
- **GPT-4o / GPT-4V (OpenAI)**: multimodal maduro, base instalada, custo competitivo.
- **Gemini (Google)**: multimodal nativo, custo agressivo, latência variável.
- **Híbrido**: roteamento por tipo de tarefa.

### 9.2 — Tier por tarefa
- Diagnóstico (texto, baixa criticidade) → modelo barato (Haiku / 4o-mini / Flash).
- Análise de print/perfil (multimodal, alto valor) → modelo top (Sonnet / Opus / 4o / 1.5 Pro).
- Nurturing (texto pré-template) → modelo barato + cache agressivo.

### 9.3 — Fallback
- Provider primário cai ou estoura budget → fallback automático para secundário, ou degrada feature?

### 9.4 — Prompt strategy
- System prompt fixo + few-shot vs fine-tuning vs prompt caching vs RAG.
- Onde mora a "voz da Isabela" e como ela versiona.
- (Detalhado em ADR 0010.)

## Critérios de Decisão
- Custo real por análise (planilha: input tokens × output tokens × volume previsto × preço atual).
- Qualidade subjetiva da voz Isabela em blind review (Isabela escolhe melhor saída entre 3 providers).
- Latência p95 multimodal.
- Rate limits compatíveis com 1k–10k usuários.
- Compliance LGPD / data residency.

## Consequências
- Camada `packages/ai-gateway` com porta `AIProvider` — adapters trocáveis (mesmo princípio de ADR 0008).
- Trocar provider depois = 1 adapter novo, não refactor.

## Owner
@architect com input de Isabela em qualidade de voz.

## Bloqueia
- Fase 3 — Arquitetura (NFR de custo R$ 30/usuário só fecha com isso).
- ADR 0010 — Context Engineering depende disso.

## Relacionado
- ADR 0010 — Context Engineering Strategy.
- `docs/research/ai-provider-benchmark.md` (a ser produzido na Fase 3).

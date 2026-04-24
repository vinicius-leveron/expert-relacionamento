# Briefing Original — Perpétuo

> **Status**: fonte de verdade até `docs/brief.md` ser produzido pelo `@analyst` (Fase 1).
> **Origem**: redação do Vinícius (lead técnico, KOSMOS) com base em conversas com Isabela Louzada (autora/sócia de produto) e validação prática da imersão out/2025.
> **Data de captura**: 2026-04-24.
> **Idioma**: PT-BR.
> **Diretiva do autor**: "Ignora os prazos."

---

## 1. Sumário executivo

**Perpétuo** é um SaaS de assinatura via WhatsApp, posicionado como **anti-redpill**, voltado a coaching de relacionamento masculino. O produto transpõe e automatiza a metodologia da imersão da Isabela (validada em out/2025) para um agente conversacional multimodal com **voz da Isabela**, capaz de operar em escala.

Concorrente direta: **Cristal** (Letícia Félix), que cobra R$ 297/ano via WhatsApp e oferece apenas análise de conversa.

---

## 2. Posicionamento

- **Categoria**: SaaS de autodesenvolvimento masculino entregue por agente conversacional.
- **Tom**: anti-redpill, anti-PUA, foco em autoconhecimento e estratégia relacional.
- **Diferencial**: não é só análise de print — é jornada (diagnóstico → plano direcional → nurturing → análises sob demanda).
- **Voz da IA**: voz da Isabela (autora). É IP do produto, não detalhe de implementação.

## 3. Persona-alvo

- Homem, 25–38 anos, classe B/C+.
- Frustrado com aplicativos de relacionamento.
- Disposto a pagar até **R$ 500/ano** por solução que entregue resultados perceptíveis.
- Brasileiro, PT-BR.

## 4. Proposta de valor

IA com voz da Isabela no WhatsApp executando 5 capacidades:

1. **Análise de prints de conversa** — 3 sugestões de resposta com tons diferentes.
2. **Análise de perfil Tinder/Instagram** — leitura visual + contextual.
3. **Diagnóstico inicial** — 8 perguntas → arquétipo (4 tipos) + plano direcional 30 dias.
4. **Sequência de nurturing** — 30 dias por arquétipo.
5. **Gatilhos de reengajamento** — por inatividade.

## 5. Escopo do MVP v1

- **Canal**: WhatsApp Business (canal único).
- **Diagnóstico inicial**: 8 perguntas → 1 de 4 arquétipos.
- **Plano direcional**: gerado pós-diagnóstico.
- **Análise de print**: multimodal, **30 análises/mês** dentro da assinatura.
- **Análise de perfil**: multimodal, **5 análises/mês** dentro da assinatura.
- **Assinatura anual**: R$ 297–497 + créditos avulsos para uso excedente.
- **Verificação de cliente ativo**: middleware crítico, executado **a cada mensagem recebida**.
- **Rate limiting** + **upsell de créditos** quando cota se esgota.
- **Nurturing**: 30 dias, conteúdo segmentado por arquétipo.
- **Gatilhos de reengajamento**: por inatividade.
- **Dashboard de métricas**: Metabase ou similar.

### Fora de escopo do MVP v1
- App mobile/web (planejado como Fase 2 futura).
- Multi-canal (WhatsApp é o único hoje).
- Outros idiomas além de PT-BR.

## 6. Stack técnica preliminar

> Decisões finais ficam para `@architect` (Fase 3). Aqui é o estado da arte das hipóteses:

- **Backend**: Node.js (alinhar com ENKRA do Marlon).
- **Banco**: Postgres.
- **Gateway WhatsApp**: Z-API / Evolution API / Cloud API — **decisão pendente** (ADR 0001).
- **Filas/jobs assíncronos**: necessárias (briefing exige nurturing e reengajamento).
- **IA multimodal**: GPT-4V e/ou Claude — **decisão pendente** (ADR 0009).
- **Gateway de pagamento**: Hotmart / Kiwify / Rubla — **decisão pendente** (ADR 0002).
- **Storage temporário de mídia**: necessário para imagens de print/perfil.

## 7. Schema mínimo do banco (do briefing)

Entidades nomeadas pelo autor:

- `users`
- `subscriptions`
- `diagnoses`
- `messages`
- `usage_counters`
- `credits`
- `feedback`

> O modelo final é responsabilidade do `@architect` na Fase 3 — incluindo decisão sobre identity model (ADR 0011) e variáveis de contexto (ADR 0010).

## 8. Riscos identificados

| Risco | Origem | Mitigação preliminar |
|---|---|---|
| Banimento WhatsApp via Z-API/Evolution | gateway não-oficial | ADR 0001 + plano de contingência (Cloud API) |
| Custo de IA inviabilizar margem | provider pago por token | ADR 0009 + ADR 0010 (caching, eval) |
| Prompts não capturarem voz da Isabela | conteúdo é IP humano | ADR 0010 (versionamento + eval golden set) |
| Marlon dividido com ENKRA | recurso técnico compartilhado | escopo organizacional (fora deste backlog) |

## 9. Métricas-alvo (success criteria)

- **80%** dos usuários completam o diagnóstico.
- **60%** usam alguma análise nos primeiros 7 dias.
- **Custo de IA por usuário/mês < R$ 30**.
- **100 assinantes ativos** em 90 dias (post-launch).
- **Retenção D30 > 70%**.

## 10. Pendências bloqueadoras (do briefing original)

Numeração do briefing → ADR correspondente neste repo:

1. **8 perguntas aprovadas pela Isabela** → ADR 0004.
2. **Decisão WhatsApp API** → ADR 0001.
3. **4 arquétipos com Isabela e Wesley** → ADR 0003.
4. **Plataforma checkout** → ADR 0002.
5. **Nome produto/IA** → fora do backlog técnico (decisão de marca; vira config).
6. **Termo de sociedade** → fora do backlog técnico (jurídico).
7. **Alocação Marlon** → fora do backlog técnico (organizacional).

> Decisões adicionais surgidas durante o setup do repo: ADR 0008 (channel evolution), ADR 0009 (AI provider), ADR 0010 (context engineering), ADR 0011 (user identity model).

## 11. Anexos

Material complementar (12 ChatGPT links + Google Docs do briefing original) está catalogado em `docs/inputs/briefing-anexos.md`.

## 12. Pessoas

- **Isabela Louzada** — autora da metodologia, sócia de produto. Owner de voz, arquétipos e perguntas do diagnóstico.
- **Vinícius** (KOSMOS) — lead técnico, executor solo do MVP, autor deste briefing.
- **Marlon** — referência técnica de backend (ENKRA), alocação a definir.
- **Wesley** — colaborador no design dos arquétipos (junto com Isabela).

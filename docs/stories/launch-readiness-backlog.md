# Backlog de Prontidão para Lançamento

> **Escopo**: transformar o estado atual do repositório em um plano objetivo de entrega para colocar o produto no mercado.
>
> **Status do documento**: ativo.
>
> **Última atualização**: 2026-05-06.

## Objetivo

Priorizar o que realmente falta para lançamento sem cair em expansão de escopo. O foco aqui não é "mais features", e sim fechar os buracos entre:

- a promessa comercial do produto;
- o que o código já suporta;
- o que ainda precisa existir para operar com cobrança, retenção e confiança.

## Leitura do estado atual

### O que já existe

- App mobile com autenticação, perfil, conversa, assinatura e paywall.
- Chat com texto, imagem, áudio e anexos, com boa cobertura de testes locais.
- Persistência de conversas, anexos e estado estruturado do avatar.
- Webhook de pagamento Hubla e checagem de assinatura no backend.
- Worker de nurturing/reengajamento para fluxo orientado a canal externo.

### O que está desalinhado hoje

- O briefing original define um MVP **WhatsApp-first**, mas o repositório atual está claramente mais avançado no **app mobile**.
- A aba de jornada paga ainda é placeholder.
- Existem três leituras concorrentes de onboarding/diagnóstico:
  - briefing com **8 perguntas** e arquétipos;
  - tela local de diagnóstico com **5 perguntas** e resultado client-side;
  - fluxo novo de **Diagnóstico Pessoal** no chat, que alimenta um avatar estruturado em 7 fases.
- O briefing fala em **30 análises de print/mês**, **5 análises de perfil/mês** e **créditos avulsos**, mas o backend hoje só conta um limite genérico de imagem e não tem modelo explícito de créditos.
- O backlog multimodal ainda tem itens pendentes de remoção de anexo, métricas e smoke test integrado.

## Decisão obrigatória antes de construir mais

### `LAUNCH-DECISION-001` Fixar a superfície real de lançamento

- `Prioridade`: `P0`
- Pergunta:
  O lançamento vai ser **app-first** ou **WhatsApp-first**?
- Por que isso bloqueia:
  - O briefing segue WhatsApp-first.
  - O app já concentra a maior parte da UX e do funil pago.
  - O worker de jornada hoje foi desenhado para canal externo, não para experiência nativa do app.
- Recomendação:
  Escolher **app-first** como wedge imediato, porque é onde já existe mais produto utilizável no código.
- Critérios de aceite:
  - Um canal canônico de aquisição.
  - Um canal canônico de entrega da jornada.
  - Um funil canônico de diagnóstico.
  - Um modelo canônico de cobrança e limites.

## Épico 1 — Comercial, identidade e monetização

### `LAUNCH-COM-001` Unificar identidade entre app, checkout e canal conversacional

- `Prioridade`: `P0`
- Problema:
  O webhook de pagamento ainda pode criar um usuário novo a partir do e-mail do checkout quando não encontra correspondência prévia.
- Risco:
  Assinatura ativa em um usuário e histórico/avatar em outro.
- Critérios de aceite:
  - Compra concluída sempre se liga ao usuário correto.
  - Existe regra clara de reconciliação por e-mail, telefone e origem.
  - Casos ambíguos ficam em fila de revisão em vez de fragmentar dados.

### `LAUNCH-COM-002` Implementar limites de consumo do plano

- `Prioridade`: `P0`
- Problema:
  O produto prometido tem quotas específicas, mas o código atual só conta análises de imagem de forma genérica.
- Critérios de aceite:
  - Separar pelo menos:
    - análises de prints/conversas;
    - análises de perfil;
    - eventual uso excedente por crédito.
  - Exibir saldo remanescente no app.
  - Bloquear com mensagem comercial coerente ao atingir limite.
  - Preparar base para créditos avulsos, mesmo que a compra de créditos entre depois.

### `LAUNCH-COM-003` Fechar o fluxo de falha, expiração e retomada de assinatura

- `Prioridade`: `P1`
- Problema:
  O estado comercial já aparece no app, mas ainda falta endurecer a recuperação real de cobrança e suporte operacional.
- Critérios de aceite:
  - Estado `pending`, `payment_failed`, `cancelled` e `expired` têm CTA claro.
  - O usuário entende o que aconteceu e como retomar.
  - O time consegue auditar a origem do estado via metadata do gateway.

## Épico 2 — Onboarding, diagnóstico e jornada

### `LAUNCH-JRN-001` Substituir o placeholder da jornada por onboarding pago real

- `Prioridade`: `P0`
- Problema:
  A aba de jornada ainda informa que o onboarding pago "em breve".
- Critérios de aceite:
  - Após assinatura, o usuário entra em um fluxo real de ativação.
  - A jornada mostra próximo passo, progresso e objetivo do momento.
  - O paywall não leva o usuário para uma área vazia depois da compra.

### `LAUNCH-JRN-002` Escolher e consolidar um único diagnóstico de produção

- `Prioridade`: `P0`
- Problema:
  Há duplicidade entre diagnóstico legado, diagnóstico local do app e diagnóstico estruturado via chat.
- Recomendação:
  Tornar o **Diagnóstico Pessoal estruturado** o fluxo oficial e remover ou esconder os fluxos legados.
- Critérios de aceite:
  - Existe um único entry point de diagnóstico.
  - O resultado alimenta assinatura, chat, mentores e jornada.
  - O produto deixa claro o que é arquétipo legado e o que é avatar atual.

### `LAUNCH-JRN-003` Entregar a jornada diária no mesmo canal do lançamento

- `Prioridade`: `P0`
- Problema:
  A lógica de nurturing/reengajamento existe, mas precisa casar com o canal real de mercado.
- Critérios de aceite:
  - Se o lançamento for app-first, a jornada vira experiência nativa do app com mecanismos de reativação compatíveis.
  - Se o lançamento for WhatsApp-first, o worker e o funil do app deixam de ser caminho principal.
  - O usuário recebe um próximo passo claro todos os dias ou em cada interação relevante.

### `LAUNCH-JRN-004` Exibir progresso do avatar por fase com utilidade real

- `Prioridade`: `P1`
- Problema:
  O avatar já tem estrutura de fases, mas a progressão ainda não virou produto claramente navegável.
- Critérios de aceite:
  - Cada fase mostra status, resultado gerado e próximo desbloqueio.
  - Os mentores dependentes do avatar respeitam esse progresso.
  - O perfil deixa de parecer "quase pronto" e passa a orientar ação.

## Épico 3 — Chat multimodal e confiabilidade

### `LAUNCH-CHAT-001` Fechar o backlog multimodal pendente

- `Prioridade`: `P1`
- Problema:
  O recurso multimodal já tem base forte, mas ainda há itens documentados como pendentes.
- Critérios de aceite:
  - Remover anexo da conversa.
  - Confirmar comportamento de retry e estados de falha no app.
  - Sincronizar o documento de backlog com o estado real do código.

### `LAUNCH-CHAT-002` Executar smoke test integrado do chat

- `Prioridade`: `P0`
- Problema:
  Os testes locais estão verdes, mas falta validação real entre app, API, worker, storage e IA.
- Critérios de aceite:
  - Envio de imagem validado ponta a ponta.
  - Upload e indexação de arquivo validados ponta a ponta.
  - Resposta com citação de anexo validada ponta a ponta.
  - Evidência de teste registrada em documento curto de verificação.

### `LAUNCH-CHAT-003` Medir custo, falha e adoção do uso multimodal

- `Prioridade`: `P1`
- Problema:
  Sem observabilidade, fica difícil proteger margem e corrigir gargalos de UX.
- Critérios de aceite:
  - Eventos de upload, falha, indexação e uso de contexto.
  - Métrica de uso por tipo de mídia.
  - Métrica mínima de custo por usuário ou por conversa.

## Épico 4 — Operação de lançamento

### `LAUNCH-OPS-001` Montar checklist operacional de release

- `Prioridade`: `P0`
- Problema:
  Mesmo com feature pronta, lançamento quebra sem checklist de webhook, storage, worker e variáveis.
- Critérios de aceite:
  - Checklist de deploy.
  - Checklist de ambiente.
  - Checklist de rollback.
  - Checklist de smoke manual pós-release.

### `LAUNCH-OPS-002` Fechar links externos críticos do app

- `Prioridade`: `P1`
- Problema:
  Ainda existem pontos com suporte/legal não configurados e ações de settings incompletas.
- Critérios de aceite:
  - Canal de suporte funcional.
  - Documento legal externo funcional.
  - Decisão explícita sobre exclusão de conta no MVP.

### `LAUNCH-OPS-003` Instrumentar funil principal

- `Prioridade`: `P1`
- Problema:
  O briefing define metas de ativação, uso e retenção, mas o funil ainda não está explicitamente medido de ponta a ponta.
- Critérios de aceite:
  - Medir visita ao paywall.
  - Medir início e conclusão do diagnóstico.
  - Medir ativação de assinatura.
  - Medir primeira análise útil.
  - Medir retenção inicial da jornada.

## Ordem recomendada para a viagem

1. `LAUNCH-DECISION-001`
2. `LAUNCH-COM-001`
3. `LAUNCH-COM-002`
4. `LAUNCH-JRN-001`
5. `LAUNCH-JRN-002`
6. `LAUNCH-JRN-003`
7. `LAUNCH-CHAT-002`
8. `LAUNCH-CHAT-001`
9. `LAUNCH-CHAT-003`
10. `LAUNCH-OPS-001`
11. `LAUNCH-OPS-002`
12. `LAUNCH-OPS-003`

## Sequência sugerida de sprint

### Bloco 1 — Tese de lançamento e monetização

- Decidir canal oficial.
- Unificar identidade.
- Implementar quotas e bloqueios comerciais corretos.

### Bloco 2 — Ativação pós-compra

- Trocar placeholder da jornada.
- Consolidar um único diagnóstico de produção.
- Exibir próximo passo real depois da assinatura.

### Bloco 3 — Robustez do uso principal

- Rodar smoke integrado do chat.
- Fechar pendências do multimodal.
- Adicionar observabilidade mínima de custo e falha.

### Bloco 4 — Pronto para botar tráfego

- Checklist operacional.
- Suporte e links externos.
- Métricas do funil principal.

## Observações finais

- Se a decisão for **WhatsApp-first**, o backlog deve ser recortado e boa parte das telas do app deixa de ser prioridade imediata.
- Se a decisão for **app-first**, a maior entrega de valor não é "mais mentores", e sim uma jornada paga coerente com cobrança, diagnóstico, progresso e reativação.
- O repositório já tem base suficiente para lançar um piloto. O que falta agora é coerência de produto e fechamento operacional.

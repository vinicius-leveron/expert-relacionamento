# Backlog de Histórias — Chat Multimodal e Arquivos

> **Escopo**: evolução do chat do app com imagem multimodal, anexos como contexto e robustez operacional.
>
> **Status do documento**: ativo.
>
> **Última atualização**: 2026-04-29.

## Objetivo

Dar ao chat do app capacidade de:

- analisar imagens com IA multimodal;
- usar arquivos anexados como contexto de resposta;
- manter histórico consistente com previews e metadados;
- operar com guardrails de custo, tamanho, tipo e cleanup.

## Convenções

- `Status`
  - `feito`: já implementado no código e coberto por testes locais.
  - `em validacao`: implementado, mas ainda depende de smoke test real.
  - `pendente`: ainda não implementado.
- `Prioridade`
  - `P0`: bloqueia uso principal do recurso.
  - `P1`: importante para experiência e confiabilidade.
  - `P2`: melhoria de produto ou operação.

## Épico 1 — Imagem no chat

### `CHAT-IMG-001` Enviar imagem para análise multimodal

- `Status`: `em validacao`
- `Prioridade`: `P0`
- História:
  Como usuária, quero enviar uma imagem no chat para que a IA analise o conteúdo visual e responda dentro da mesma conversa.
- Critérios de aceite:
  - Posso selecionar uma imagem da galeria no app.
  - Posso enviar a imagem com ou sem texto complementar.
  - O backend envia a imagem para a IA como payload multimodal real.
  - A resposta volta pelo fluxo normal do chat.
- Dependências:
  - nenhuma.
- Observações:
  - Backend e mobile já possuem implementação base.
  - Falta validar ponta a ponta em ambiente real.

### `CHAT-IMG-002` Mostrar preview da imagem no histórico

- `Status`: `em validacao`
- `Prioridade`: `P0`
- História:
  Como usuária, quero ver a imagem que enviei no histórico do chat para confirmar qual conteúdo foi analisado.
- Critérios de aceite:
  - Mensagens de imagem aparecem com thumbnail no histórico.
  - Se houver texto junto, ele aparece associado à imagem.
  - Ao reabrir a conversa, a imagem continua disponível via URL assinada.
  - Se falhar gerar preview, o histórico continua carregando.
- Dependências:
  - `CHAT-IMG-001`

### `CHAT-IMG-003` Validar imagem antes do processamento

- `Status`: `feito`
- `Prioridade`: `P0`
- História:
  Como sistema, quero validar tipo e tamanho da imagem antes de processá-la para evitar falhas e custo desnecessário.
- Critérios de aceite:
  - Só aceitar `image/jpeg`, `image/png` e `image/webp`.
  - Rejeitar imagem acima do limite definido pelo produto.
  - Rejeitar payload com `base64` inválido.
  - Rejeitar `data:` URI cujo MIME diverge de `image.mediaType`.

### `CHAT-IMG-004` Preservar ou limpar imagem inline corretamente em falhas

- `Status`: `feito`
- `Prioridade`: `P1`
- História:
  Como sistema, quero limpar uploads órfãos e preservar imagens válidas já persistidas para não perder histórico nem acumular lixo no storage.
- Critérios de aceite:
  - Se a rota falhar antes de delegar para a pipeline, a imagem é removida do bucket.
  - Se a pipeline falhar antes de persistir a mensagem do usuário, a imagem é removida.
  - Se a mensagem do usuário já tiver sido salva, a imagem não é removida.
  - Falhas de cleanup geram log de warning.

## Épico 2 — Arquivos como contexto

### `CHAT-FILE-001` Anexar documento no chat

- `Status`: `em validacao`
- `Prioridade`: `P0`
- História:
  Como usuária, quero anexar um documento no chat para que a IA use esse conteúdo nas respostas.
- Critérios de aceite:
  - Posso anexar `pdf`, `txt`, `md` e `json`.
  - O upload acontece com URL assinada.
  - O arquivo fica ligado à conversa atual.
  - A mensagem pode ser enviada com arquivo, com ou sem texto.
- Dependências:
  - nenhuma.

### `CHAT-FILE-002` Mostrar status de processamento do anexo

- `Status`: `em validacao`
- `Prioridade`: `P0`
- História:
  Como usuária, quero ver se o arquivo ainda está subindo, indexando ou pronto para entender quando a IA já pode usá-lo.
- Critérios de aceite:
  - O anexo exibe `uploading`, `processing`, `ready` ou `failed`.
  - O status atualiza sem exigir refresh manual completo.
  - Se o arquivo falhar, a usuária consegue perceber isso no histórico/composer.
- Dependências:
  - `CHAT-FILE-001`

### `CHAT-FILE-003` Usar apenas arquivos da conversa atual como contexto

- `Status`: `em validacao`
- `Prioridade`: `P0`
- História:
  Como usuária, quero que a IA use somente os arquivos da conversa atual para que meu contexto não vaze entre conversas.
- Critérios de aceite:
  - O retrieval filtra por `user_id`, `conversation_id` e anexos `ready`.
  - A IA não acessa anexos de outro usuário.
  - A IA não usa anexos apagados em respostas futuras.
- Dependências:
  - `CHAT-FILE-001`
  - `CHAT-FILE-002`

### `CHAT-FILE-004` Citar a fonte quando usar arquivo

- `Status`: `em validacao`
- `Prioridade`: `P1`
- História:
  Como usuária, quero que a IA cite o arquivo usado na resposta para eu saber de onde veio a informação.
- Critérios de aceite:
  - Quando usar conteúdo de anexo, a resposta cita o nome do arquivo.
  - Se não houver contexto suficiente, a IA não inventa.
  - Se o arquivo ainda estiver processando, a IA informa isso explicitamente.
- Dependências:
  - `CHAT-FILE-003`

### `CHAT-FILE-005` Remover anexo da conversa

- `Status`: `pendente`
- `Prioridade`: `P1`
- História:
  Como usuária, quero remover um anexo para que ele deixe de influenciar respostas futuras.
- Critérios de aceite:
  - Posso excluir um anexo da conversa.
  - O arquivo deixa de aparecer nas listas do chat.
  - O retrieval não usa mais os chunks daquele anexo.
  - O objeto no storage é removido.
- Dependências:
  - `CHAT-FILE-001`
  - `CHAT-FILE-003`

## Épico 3 — Experiência de conversa

### `CHAT-UX-001` Enviar texto, imagem e arquivo em combinações válidas

- `Status`: `em validacao`
- `Prioridade`: `P0`
- História:
  Como usuária, quero poder enviar texto, imagem e arquivo em combinações compatíveis para usar o chat com flexibilidade.
- Critérios de aceite:
  - Posso enviar só texto.
  - Posso enviar só imagem.
  - Posso enviar imagem com texto.
  - Posso enviar só arquivo.
  - Posso enviar arquivo com texto.
- Dependências:
  - `CHAT-IMG-001`
  - `CHAT-FILE-001`

### `CHAT-UX-002` Ver mensagem otimista no chat

- `Status`: `pendente`
- `Prioridade`: `P1`
- História:
  Como usuária, quero ver minha mensagem aparecer imediatamente para perceber que o app está funcionando.
- Critérios de aceite:
  - Texto, imagem e arquivo entram no histórico local antes da resposta do backend.
  - O estado de envio é visível.
  - Em caso de falha, a mensagem pode ser identificada como não enviada.
- Dependências:
  - `CHAT-UX-001`

### `CHAT-UX-003` Tentar novamente envio com falha

- `Status`: `pendente`
- `Prioridade`: `P1`
- História:
  Como usuária, quero reenviar mensagens ou anexos que falharam para não precisar reconstruir o contexto manualmente.
- Critérios de aceite:
  - O app mostra ação de retry para falhas de upload.
  - O app mostra ação de retry para falhas de envio da mensagem.
  - O retry reaproveita os dados locais quando possível.
- Dependências:
  - `CHAT-UX-002`

### `CHAT-UX-004` Retomar conversa com histórico completo

- `Status`: `em validacao`
- `Prioridade`: `P1`
- História:
  Como usuária, quero reabrir uma conversa e ver mensagens, imagens e anexos anteriores para manter continuidade.
- Critérios de aceite:
  - O histórico carrega mensagens antigas.
  - Imagens já enviadas continuam com preview quando disponíveis.
  - Arquivos antigos aparecem com metadados básicos e status.
  - Falhas de preview não derrubam o histórico.
- Dependências:
  - `CHAT-IMG-002`
  - `CHAT-FILE-002`

## Épico 4 — Observabilidade e segurança operacional

### `CHAT-OPS-001` Aplicar limites de mídia

- `Status`: `em validacao`
- `Prioridade`: `P1`
- História:
  Como produto, quero impor limites por tipo de mídia para controlar custo, abuso e erro operacional.
- Critérios de aceite:
  - Imagem respeita limite de tamanho.
  - Documento respeita limite de tamanho.
  - Existe limite de quantidade de anexos por mensagem.
  - O erro de validação é padronizado e legível.
- Dependências:
  - nenhuma.

### `CHAT-OPS-002` Medir upload, processamento e uso de contexto

- `Status`: `pendente`
- `Prioridade`: `P2`
- História:
  Como time de produto e engenharia, quero medir o fluxo de mídia no chat para acompanhar adoção, custo e falhas.
- Critérios de aceite:
  - Métrica de upload concluído e falho.
  - Métrica de tempo de indexação.
  - Métrica de uso de contexto de anexo.
  - Métrica de falha de preview e cleanup.
- Dependências:
  - `CHAT-IMG-001`
  - `CHAT-FILE-002`

### `CHAT-OPS-003` Executar smoke test ponta a ponta do chat multimodal

- `Status`: `pendente`
- `Prioridade`: `P1`
- História:
  Como time, quero validar o fluxo real em ambiente integrado para reduzir risco de regressão entre mobile, API, worker e storage.
- Critérios de aceite:
  - Teste cobre envio de imagem.
  - Teste cobre preview da imagem no histórico.
  - Teste cobre upload e indexação de arquivo.
  - Teste cobre resposta da IA usando anexo pronto.
- Dependências:
  - `CHAT-IMG-001`
  - `CHAT-IMG-002`
  - `CHAT-FILE-003`

## Ordem recomendada de execução

1. `CHAT-IMG-001`
2. `CHAT-IMG-002`
3. `CHAT-FILE-001`
4. `CHAT-FILE-002`
5. `CHAT-FILE-003`
6. `CHAT-FILE-004`
7. `CHAT-UX-001`
8. `CHAT-OPS-001`
9. `CHAT-OPS-003`
10. `CHAT-FILE-005`
11. `CHAT-UX-002`
12. `CHAT-UX-003`
13. `CHAT-OPS-002`

## Próximo recorte recomendado

Se o objetivo agora é avançar o app sem abrir muitas frentes ao mesmo tempo, o próximo recorte deve ser:

1. validar `CHAT-IMG-001` e `CHAT-IMG-002` em fluxo real;
2. validar `CHAT-FILE-001` até `CHAT-FILE-004` com upload e resposta citando fonte;
3. implementar `CHAT-FILE-005`;
4. implementar `CHAT-UX-002` e `CHAT-UX-003`.

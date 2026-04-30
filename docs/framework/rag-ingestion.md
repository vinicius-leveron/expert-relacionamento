# RAG Ingestion

O projeto já tem um CLI para indexar material no Supabase usando o `RAGService`.

## Comando

```bash
pnpm --filter @perpetuo/worker ingest:rag -- ./docs/inputs --dry-run
pnpm --filter @perpetuo/worker ingest:rag -- ./docs/inputs --replace
pnpm --filter @perpetuo/worker ingest:rag -- --manifest rag-manifest.json --replace
pnpm --filter @perpetuo/worker query:rag -- --list-docs
pnpm --filter @perpetuo/worker query:rag -- "reativar conversa fria" --count 8 --threshold 0.65
```

## Env

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` é o caminho preferido, porque as tabelas do knowledge base estão protegidas por RLS para `service_role`.

## Formatos suportados

- `.md`
- `.txt`
- `.json`
- `.pdf`

PDF depende do binário `pdftotext` no ambiente.

## Flags

- `--dry-run`: prepara e chunka, mas não escreve no banco.
- `--replace`: remove documentos existentes com o mesmo `source_url` antes de reingerir.
- `--chunk-size <n>`: tamanho alvo do chunk em caracteres. Padrão `1200`.
- `--chunk-overlap <n>`: overlap entre chunks. Padrão `200`.
- `--source-url-prefix <url>`: prefixo para compor `source_url`.
- `--manifest <arquivo>`: aplica overrides por documento.

## Manifest

Exemplo:

```json
{
  "defaults": {
    "sourceType": "manual",
    "sourceUrlPrefix": "https://conteudo.isabela.local",
    "metadata": {
      "author": "Isabela"
    },
    "chunkMetadata": {
      "collection": "jornada-30-dias"
    }
  },
  "documents": [
    {
      "path": "docs/inputs/briefing-original.md",
      "title": "Briefing Original",
      "metadata": {
        "tags": ["briefing", "origem"]
      }
    },
    {
      "path": "conteudo/transcripts/aula-01.json",
      "title": "Aula 01",
      "sourceType": "transcript",
      "sourceUrl": "curso/aula-01",
      "chunkMetadata": {
        "module": "fundamentos"
      }
    }
  ]
}
```

Se `--manifest` for usado sem paths explícitos, o CLI ingere todos os `documents[].path` definidos nele.

## Deduplicação

Sem `--replace`, a ingestão não duplica mais um `source_url` já conhecido:

- se `contentHash` e config de chunking forem iguais, o arquivo é pulado como `unchanged`
- se o `source_url` existir com conteúdo diferente, o arquivo entra como `conflicted` e o CLI orienta reexecutar com `--replace`

Com `--replace`, os documentos antigos daquele `source_url` são removidos e reindexados.

## Query / inspeção

O CLI `query:rag` ajuda a validar a base já indexada:

```bash
pnpm --filter @perpetuo/worker query:rag -- --list-docs --source-type manual
pnpm --filter @perpetuo/worker query:rag -- "mensagem para responder sumiço" --count 5
pnpm --filter @perpetuo/worker query:rag -- "gatilhos de abertura" --json
```

`--list-docs` não precisa de `OPENAI_API_KEY`. Já a busca semântica precisa.

## Metadata salva

Cada documento indexado passa a carregar no `knowledge_documents.metadata`:

- `sourcePath`
- `contentHash`
- `contentLength`
- `chunking.size`
- `chunking.overlap`
- metadata definida em `defaults.metadata`
- metadata definida no documento do manifest

Cada chunk salva:

- `chunkIndex`
- `sectionTitle`, quando houver cabeçalho markdown
- metadata definida em `defaults.chunkMetadata`
- metadata definida em `documents[].chunkMetadata`

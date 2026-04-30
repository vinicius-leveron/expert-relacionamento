# Perpétuo

Coach de relacionamentos com IA. Uma experiência de autoconhecimento guiada pela Isabela.

## Stack

- **Mobile**: React Native + Expo (iOS/Android)
- **Backend**: Node.js + Hono.js
- **Database**: Supabase (PostgreSQL)
- **AI**: Anthropic Claude
- **Payments**: Hubla
- **WhatsApp**: Uazapi

## Estrutura

```
apps/
  api/          # Backend API
  mobile/       # App React Native
  worker/       # Background jobs

packages/
  ai-gateway/        # Integração com Claude
  payment-gateway/   # Integração com Hubla
  channels/          # WhatsApp adapter
  core/              # Domain logic
  database/          # Supabase client
```

## Requisitos

- Node.js 20+
- pnpm 9+
- Expo CLI
- Supabase CLI (para desenvolvimento local)

## Setup Local

```bash
# Instalar dependências
pnpm install

# Iniciar Supabase local
supabase start

# Rodar backend
pnpm --filter @perpetuo/api dev

# Rodar mobile
pnpm --filter @perpetuo/mobile dev
```

## Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

```bash
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
ANTHROPIC_API_KEY=

# Auth
JWT_SECRET=

# Payments (opcional)
PAYMENT_PROVIDER=mock
HUBLA_API_KEY=

# WhatsApp (opcional)
WHATSAPP_PROVIDER=mock
UAZAPI_SUBDOMAIN=
UAZAPI_TOKEN=
```

## Build Mobile

```bash
cd apps/mobile

# Preview (teste interno)
pnpm build:preview

# Produção
pnpm build:prod

# Submeter para lojas
pnpm submit
```

## Deploy

O deploy é automático via GitHub Actions:

- **Push para main**: Deploy para staging
- **Tag v***: Deploy para produção + submissão para lojas

### Secrets Necessários

Configure no GitHub:

- `VERCEL_TOKEN` - Deploy da API
- `VERCEL_ORG_ID` - ID da organização no Vercel
- `VERCEL_PROJECT_ID` - ID do projeto no Vercel
- `EXPO_TOKEN` - Build do mobile
- `APPLE_ID` / `ASC_APP_ID` / `APPLE_TEAM_ID` - App Store
- `SUPABASE_*` - Variáveis de produção
- `ANTHROPIC_API_KEY`
- `JWT_SECRET_PROD`

## Comandos

```bash
pnpm dev          # Dev mode
pnpm build        # Build all
pnpm test         # Run tests
pnpm lint         # Lint code
pnpm typecheck    # Type check
```

## Arquitetura

```
[Mobile App] → [API Gateway] → [AI Gateway] → [Claude]
                    ↓
              [Supabase DB]
                    ↓
              [Payment Gateway] → [Hubla]
                    ↓
              [WhatsApp Adapter] → [Uazapi]
```

## Licença

Proprietário - Perpétuo © 2024

# FinVault

FinVault is a hackathon-ready AI Financial Operating System for SMB founders and finance teams. It turns Zoho Books, Gmail, and document evidence into a structured financial graph, runs deterministic finance calculations, validates evidence, and only then asks AI to explain the verified result.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Architecture

```text
Data Sources -> Normalization -> Financial Graph -> Rules Engine -> Validation Engine -> AI Explanation Layer
```

The LLM never calculates numbers. Calculations live in `lib/rules-engine.ts`, source checks live in `lib/validation-engine.ts`, and AI explanation assembly lives in `lib/ai.ts`.

## MVP scope

- Executive command center dashboard
- Financial health score from weighted backend metrics
- Risk engine with evidence, impact, and recommended actions
- Ask FinVault route with metric mapping, validation, and source-backed answers
- Action engine route for collection plans, board summaries, and payment reminders
- Zoho and Gmail OAuth/sync route placeholders with normalized entity contracts
- Supabase schema for organizations, memberships, graph entities, integrations, evidence, alerts, and actions

## Production integrations

Copy `.env.example` to `.env.local`, fill provider keys, create the Supabase tables in `supabase/schema.sql`, then replace the demo seed in `lib/financial-graph.ts` with reads from Supabase.

### Required callback URLs

Configure these in provider dashboards:

```text
Zoho Books OAuth redirect: http://localhost:3000/api/sync/zoho
Google OAuth redirect:     http://localhost:3000/api/sync/gmail
```

For deployment, replace `http://localhost:3000` with `NEXT_PUBLIC_APP_URL`.

### API routes

```text
GET  /api/status                 Safe env/provider readiness check
GET  /api/integrations/status    OAuth URLs, redirect URIs, missing provider vars
GET  /api/dashboard              Calculated financial dashboard model
GET  /api/graph                  Normalized graph seed and relationship edges
POST /api/ask                    Source-backed Ask FinVault answers
POST /api/actions                Validated action drafts
GET  /api/sync/zoho              Zoho OAuth start/callback
GET  /api/sync/gmail             Gmail OAuth start/callback
```

Zoho and Gmail callbacks exchange OAuth codes when credentials are configured. If Supabase is configured, integration credentials are written to `integration_connections`; otherwise the API returns a demo-mode persistence message. OpenAI is optional: if `OPENAI_API_KEY` is missing, Ask FinVault returns a deterministic validated explanation.

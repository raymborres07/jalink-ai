# JalinkAI — Handoff / Progress Notes

Last updated: 2026-07-13 (Postgres migration for Vercel deployment)

One-liner: an AI-native procure-to-pay operating layer for ASEAN manufacturing SMEs, starting with a Capture → Match → Risk invoice reconciliation wedge, designed to expand modularly into a broader workflow-orchestration platform.

This file exists to answer "where are we" at a glance. It is a status doc, not a spec — see the pitch deck for the full narrative.

## Status at a glance

| Piece | Status | Notes |
|---|---|---|
| Pitch deck | ✅ Done | 15-slide HTML artifact, see link below |
| Landing / orchestrator dashboard | ✅ Working, real DB-backed | `/` route — Procurement Agent task count, Approvals badge, and Live activity are queried live from SQLite |
| Procure-to-pay reconciliation demo | ✅ Working, real backend | `/procure-to-pay` route — Capture/Match/Risk are real `createServerFn` calls that read/write SQLite, not a frontend timer |
| Real AI (SEA-LION or any LLM) | ❌ Still not wired up | Capture Agent's extraction is a deterministic stand-in (see below) — the DB round-trip is real, the "understanding the image" part isn't yet |
| Backend / database / persistence | ✅ Real, now Postgres | `drizzle-orm/vercel-postgres` + `@vercel/postgres`, reads `POSTGRES_URL`. Local `jalinkai.db` SQLite file is dead (safe to delete), not used anymore |
| Auth | ❌ None | Still not needed at this stage |
| WhatsApp Business API integration | ❌ Not real | UI mockup only (`WhatsAppView` in `ReconciliationDemo.tsx`) — but it now renders real backend responses, not fake ones |
| Deployed to Vercel | ⏳ Code is ready, deployment itself is a manual step | See "Deploying to Vercel" below — GitHub push, Vercel import, and DB attach can't be done from here |

**Bottom line: the Capture → Match → Risk pipeline is a real full-stack feature, now on Postgres instead of SQLite.** Every run creates an actual row in the database; the Match Agent's rule logic and the Risk Agent's supplier lookup are real code executing against real data. The database itself was migrated from local SQLite to Vercel Postgres so it survives Vercel's ephemeral serverless functions — see "Deploying to Vercel" for the manual steps still needed. The one deliberately-fake part left is `fakeExtract()` in `src/agents/capture.ts` — it returns realistic structured output instantly instead of calling a vision model, since there's no SEA-LION/Claude/GPT-4V API key configured yet.

## Deploying to Vercel

The code side of the migration is done — this is what's still a manual, human-only step (I can't click through Vercel's dashboard or push to your GitHub account):

1. **Push to GitHub** — commit these changes and push the repo.
2. **Import to Vercel** — Vercel dashboard → Add New → Project → import the repo. It auto-detects TanStack Start.
3. **Attach Postgres** — in the new project's Storage tab → Create Database → Postgres. Vercel injects `POSTGRES_URL` (and related vars) into the deployment automatically.
4. **Pull env vars locally** — `npx vercel env pull .env.local` (needed so local dev and `drizzle-kit push` can reach the same database).
5. **Push the schema** — `npx drizzle-kit push` (creates `suppliers`/`invoices` tables on the live Postgres DB; this replaces the old SQLite auto-bootstrap).
6. **Seed demo data** — `npx tsx src/server/db/seed.ts` (inserts the two demo suppliers; safe to re-run, uses `onConflictDoNothing()`).

After that, the deployed `.vercel.app` URL is a working live copy of the exact same app, with the same demo scenario, but persisted in the cloud instead of a local file.

## Deck

Published artifact (republish the same file to update, same URL persists):
`C:\Users\raymb\AppData\Local\Temp\claude\E--Portfolio-jalinkAI\896915b7-1382-40ad-bc9a-541b56709954\scratchpad\synapse-pitch-deck.html`
→ https://claude.ai/code/artifact/1e1dcc3f-a140-4bd3-8fda-d3ed27141d04

15 slides: cover, problem (macro + SME-specific), why the gap is open, the wedge, multi-agent architecture, trust/governance, how it expands (SME-native, not enterprise-first), target market/ICP, market sizing (**has placeholder numbers — see TODO**), competitive table, per-transaction business model, distribution/channels, long-term vision.

Arrow keys / click edges / dot nav to move through it.

## App — what's actually in this repo

TanStack Start + React 19 + Tailwind v4, scaffolded by Lovable, now with a real backend.

- **`/` — `src/components/synapse/Dashboard.tsx`** — the "big vision" orchestrator dashboard. The 7-step "PR-2041 Steel Coil" workflow narrative, Finance/Inventory/Legal/Sales/HR agent stats, and enterprise-impact numbers are still illustrative mock data (there's no backend for those departments). What's real: the **Procurement Agent task count**, the **Approvals badge**, and the **Live activity feed** — all fetched via `getDashboardStats()` on mount and reflect actual rows in Postgres. Empty state and loading skeleton included.
- **`/procure-to-pay` — `src/components/synapse/ReconciliationDemo.tsx`** — the real product wedge, now backend-driven:
  - Click **"Run reconciliation"** → calls `captureInvoice` → `matchInvoice` → `scoreRisk` in sequence via `useServerFn`, each a real `createServerFn` in `src/agents/`. Each call writes to Postgres; UI stage transitions are driven by the actual responses, not a timer.
  - **Back office / WhatsApp thread toggle** — same real run, two renderings (`OfficeView` / `WhatsAppView`).
  - **Established / New supplier toggle** — two real rows in the `suppliers` table (`established` = 34 orders of history, `new` = zero, category-benchmark fallback). Switching calls the same real pipeline with a different `supplierId`.
  - **Evidence-gated approval** — Approve/Hold/Escalate call `recordDecision`, which writes the decision back to the invoice's row — this is the actual "write back to the supplier dataset" the pitch deck describes, not a simulation of it.

The one remaining fake piece: `fakeExtract()` in `src/agents/capture.ts` returns realistic OCR/vision-LLM-shaped output instantly instead of calling a real model. Everything downstream of that (matching, scoring, persistence, dashboard) is genuinely real.

### Server architecture

- **`src/server/db/schema.ts`** — drizzle **pg-core** schema (migrated from sqlite-core): `suppliers` (id, name, riskScore, riskLabel, basis, onTimeRate, disputeFrequency, priceVariance) and `invoices` (id, supplierId, poNumber, invoiceNumber, status, decision, extracted/matchResult/riskResult as `jsonb` columns, createdAt as `timestamp`). IDs are `text` (UUID for invoices, semantic string for suppliers) — deliberately **not** `serial`, since they're app-generated, not DB-generated; switching to serial would have broken every place `supplierId === "established"` is checked.
- **`src/server/db/client.server.ts`** — `drizzle-orm/vercel-postgres` + `@vercel/postgres`, reads `POSTGRES_URL` from the environment. No more auto-bootstrap-on-import (that was fine for a local SQLite file, not appropriate for a shared serverless Postgres instance) — schema now goes through `drizzle-kit push`, seeding through `src/server/db/seed.ts`. The `.server.ts` suffix is load-bearing — this project's Vite config denies importing anything under a `server/` path from client code, so this file (and the old `src/server/agents/` location) had to be structured carefully. See "Gotchas" below.
- **`src/server/db/seed.ts`** — one-time script, `npx tsx src/server/db/seed.ts`, inserts the two demo suppliers with `onConflictDoNothing()` (safe to re-run).
- **`src/agents/{capture,match,risk,stats}.ts`** — the four `createServerFn`s (Capture, Match, Risk + decision recorder, dashboard stats). Deliberately **not** under `src/server/` despite the name — see Gotchas. Insert/update calls no longer use `.run()` (a better-sqlite3-only method) — the Postgres driver's query builders are awaited directly.
- **`drizzle.config.ts`** — `dialect: "postgresql"`, reads `POSTGRES_URL`. Required now — this is how `npx drizzle-kit push` creates the tables on the live database; there's no more auto-bootstrap fallback.

### Gotchas discovered building this

- **`src/server/**` is unconditionally denied for client imports in this project.** Not just native modules — the whole path segment. `createServerFn` definitions need to live in a client-importable location (hence `src/agents/`, not `src/server/agents/` as originally planned) since the client legitimately needs to import the function reference to get its RPC stub. Only pure server-internal code (the actual `db` connection) belongs under `src/server/`, and even then needs the `.server.ts` suffix to be safely excluded from the client bundle.
- If you add a new agent or server-only module, put the `createServerFn` in `src/agents/`, and anything it needs that must never reach the browser (db clients, secrets) in `src/server/**` with a `.server.ts` filename.

## Running it locally

**Local dev now requires a real Postgres connection** — there's no more SQLite fallback. Do the "Deploying to Vercel" steps above first (at least through creating the Postgres database and `npx vercel env pull .env.local`), then:

```bash
cd synapse-workflow-pilot
bun install && bun dev      # preferred — bun.lock is the real lockfile
# or
npm install && npm run dev  # works, see "npm quirks" below
```

Dev server picks the first free port starting at 8080 (was 8082 in the last verified run — check the terminal output). **Not re-verified against a live Postgres instance** — I don't have Vercel/GitHub access from here, so this refactor is code-complete but unrun. Once you've pulled `.env.local` and pushed the schema, worth a quick click-through before you trust it.

### npm quirks (only relevant if not using bun)

`package.json` has an `overrides` block pinning `@typescript-eslint/*` and the `browserslist` family (`caniuse-lite`, `electron-to-chromium`, etc.) to exact versions taken from `bun.lock`. This exists because npm's resolver hit two separate packages where the "latest matching semver" didn't actually have a published tarball on the registry mirror this was built against (`@typescript-eslint/scope-manager@8.63.0` and `baseline-browser-mapping@2.10.43` both errored with `ETARGET`). If a fresh `npm install` ever fails the same way again, check `bun.lock` for the exact working version and add it to `overrides`.

If you see `Cannot find native binding... npm has a bug related to optional dependencies` (rolldown/vite native binary) — delete `node_modules` and `package-lock.json` and reinstall clean. This is [npm/cli#4828](https://github.com/npm/cli/issues/4828), not specific to this repo.

### Known non-issue

Both pages log a React hydration-mismatch warning to the console (`data-tsd-source` attribute diff, sometimes also a live-clock timestamp diff on `/`). This comes from Lovable's dev-time source-tagging plugin plus the dashboard's `setInterval` clock — cosmetic only, doesn't affect rendering or functionality, safe to ignore.

## What's genuinely uncertain / needs a real decision

- **Market sizing numbers on the deck are placeholders** (marked with a dashed amber box). Need real ASEAN SME census / trade data before this goes in front of investors.
- **SEA-LION v4 is referenced throughout but never called.** No API key, no integration. If the pitch gets traction, this is the first real build item — see below.
- **Pricing model (per-invoice) is a directional bet, not validated.** No SME has actually been asked what they'd pay.

## Next build milestones (if this moves past pitch stage)

1. ~~A database~~ — done. Postgres (Vercel Postgres) via drizzle-orm, real `suppliers`/`invoices` tables, deployable and cloud-persisted.
2. ~~Real Match Agent~~ — done. Deterministic rules in `src/agents/match.ts`, no LLM involved, matches the pitch deck's "the arithmetic isn't AI" claim.
3. **Real Capture Agent** — swap `fakeExtract()` in `src/agents/capture.ts` for an actual SEA-LION (or Claude/GPT-4V as a fallback) vision + structured-output call. This is now the single highest-leverage remaining fake piece — everything downstream already works with real data once this returns real extractions.
4. **Wizard-of-Oz pilot with 2-3 design partners** — now that persistence is real, a human-in-the-loop pilot would actually accumulate a real supplier dataset instead of a throwaway one. There's an old Streamlit-based version of this at the repo root (`app.py` + `wizard_app.py`) — worth reviving as the operator-facing side.
5. **Real WhatsApp Business API integration** — the `WhatsAppView` component is a convincing mockup of the target UX and now renders real backend data; making it real means a WhatsApp Business API account and a webhook backend that calls the same `src/agents/*` server functions, which don't need to change.

## File map

```
synapse-workflow-pilot/
├── src/
│   ├── agents/
│   │   ├── capture.ts               — CaptureAgent (createServerFn, fake extraction, real DB write)
│   │   ├── match.ts                 — MatchAgent (createServerFn, real deterministic rules)
│   │   ├── risk.ts                  — RiskAgent + recordDecision (createServerFn)
│   │   └── stats.ts                 — getDashboardStats (createServerFn)
│   ├── server/db/
│   │   ├── schema.ts                — drizzle schema (suppliers, invoices)
│   │   └── client.server.ts         — better-sqlite3 connection + auto-bootstrap + seed
│   ├── components/synapse/
│   │   ├── Dashboard.tsx            — "/" orchestrator view (mix of real DB stats + illustrative mock)
│   │   └── ReconciliationDemo.tsx   — "/procure-to-pay" wedge demo (fully real backend)
│   ├── routes/
│   │   ├── index.tsx                — mounts Dashboard
│   │   ├── procure-to-pay.tsx       — mounts ReconciliationDemo
│   │   └── __root.tsx                — page shell, meta tags
│   └── styles.css                   — design tokens (ink/paper/rose/amber/success, oklch)
├── drizzle.config.ts                 — drizzle-kit config, for future migrations
├── jalinkai.db                       — local SQLite file (gitignored, auto-created)
├── app.py, wizard_app.py             — old Streamlit Wizard-of-Oz prototype (Python, unrelated stack)
└── package.json                      — see npm quirks above re: overrides block
```

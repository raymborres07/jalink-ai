# JalinkAI — Handoff / Progress Notes

Last updated: 2026-07-14 (Memory/Governance/Analytics/Integrations + Agents overview — every nav item now goes somewhere real)

One-liner: an AI-native procure-to-pay operating layer for ASEAN manufacturing SMEs, starting with a Capture → Match → Risk invoice reconciliation wedge, designed to expand modularly into a broader workflow-orchestration platform.

This file exists to answer "where are we" at a glance. It is a status doc, not a spec — see the pitch deck for the full narrative.

## Status at a glance

| Piece | Status | Notes |
|---|---|---|
| Pitch deck | ✅ Done | 15-slide HTML artifact, see link below |
| Landing / orchestrator dashboard | ✅ Working, real DB-backed | `/` route — every Agent library task count and the Departments sidebar now link to a real page, not a locked mockup |
| Procure-to-pay reconciliation demo | ✅ Working, real backend | `/procure-to-pay` route — Capture/Match/Risk are real `createServerFn` calls that read/write Postgres, not a frontend timer |
| Inventory Agent | ✅ Working, real backend | `/inventory` — real stock levels + reorder points; receiving/consuming stock writes a `stock_movements` row and recomputes the reorder recommendation |
| Finance Agent | ✅ Working, real backend | `/finance` — real CAPEX budgets; submitting a spend request runs a deterministic threshold/hedge check and writes back to the budget |
| Legal Agent | ✅ Working, real backend | `/legal` — real contract records; compliance checks validate status + required clauses (incl. the ASEAN cross-border clause) and log a verdict |
| Sales Agent | ✅ Working, real backend | `/sales` — real deal pipeline with a deterministic win-probability model, not a mock number |
| HR Agent | ✅ Working, real backend | `/hr` — real headcount/onboarding requests; headcount requests read the requesting department's live Finance budget for a cross-department policy check |
| Memory Agent | ✅ Working, real backend | `/memory` — real document index (policies/SOPs/contracts/decisions); client-side search + category filter over real rows, add-document form writes to Postgres |
| Integrations Agent | ✅ Working, real backend | `/integrations` — the 8 connectors shown on the Dashboard are real rows; Connect/Disconnect writes a real status change |
| Governance Agent | ✅ Working, real backend | `/governance` — no new table; a read-aggregation of every decision already written by Procurement/Finance/Legal/Sales/HR into one audit trail with a real pass-rate stat |
| Analytics Agent | ✅ Working, real backend | `/analytics` — cross-department charts (budget utilization, deal pipeline by stage, compliance pass/flag) computed from real rows, using `recharts` (previously an unused dependency) |
| Agent Library overview | ✅ Working, real backend | `/agents` — lists all 6 department agents with real task counts, reuses `getDashboardStats()`, no new backend needed |
| Top nav / sidebar navigation | ✅ Fully wired | Every top-nav item (Workflows/Agents/Memory/Governance/Analytics) and every Workspace sidebar item (Agents/Approvals/Enterprise Memory/Integrations/Business ROI/Governance) is a real `Link` now — previously all dead `<button>`s with no destination |
| Real AI (SEA-LION or any LLM) | ❌ Still not wired up | Capture Agent's extraction is a deterministic stand-in (see below) — the DB round-trip is real, the "understanding the image" part isn't yet |
| Backend / database / persistence | ✅ Real, now Postgres | `drizzle-orm/vercel-postgres` + `@vercel/postgres` in production, reads `POSTGRES_URL`. Local dev now supports a plain Postgres via `LOCAL_PG=1` (see "Running it locally") |
| Auth | ❌ None | Still not needed at this stage |
| WhatsApp Business API integration | ❌ Not real | UI mockup only (`WhatsAppView` in `ReconciliationDemo.tsx`) — but it now renders real backend responses, not fake ones |
| Deployed to Vercel | ⏳ Code is ready, deployment itself is a manual step | See "Deploying to Vercel" below — GitHub push, Vercel import, and DB attach can't be done from here |

**Bottom line: every clickable thing in the app now goes somewhere real.** Two passes got here: first, Procurement/Inventory/Finance/Legal/Sales/HR each got their own Drizzle tables, `createServerFn` agents, and a page (no more "module locked" toast). Second, the previously-dead top nav and sidebar (Workflows/Agents/Memory/Governance/Analytics/Integrations/Business ROI) got the same treatment — Memory and Integrations are real tables with real writes, Governance and Analytics are real read-aggregations over the data every other agent already produces (no new tables needed), and the Agent Library overview just reuses the existing dashboard stats. Every number, bar, and chart in the app is either a real DB row or a deterministic computation over real DB rows — nothing left is a static mock except the two items below. The one deliberately-fake part left is `fakeExtract()` in `src/agents/capture.ts` — it returns realistic structured output instantly instead of calling a vision model, since there's no SEA-LION/Claude/GPT-4V API key configured yet.

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

- **`/` — `src/components/synapse/Dashboard.tsx`** — the "big vision" orchestrator dashboard. The 7-step "PR-2041 Steel Coil" workflow narrative and enterprise-impact numbers are still illustrative (there's no backend for that specific simulated PR). What's real now: the **Agent library task counts for all six departments** (Procurement, Finance, Inventory, Legal, Sales, HR — each links to its real page), the **Departments sidebar** (real links, no more "module locked" toast), the **Approvals badge**, and the **Live activity feed** — all fetched via `getDashboardStats()` on mount and reflect actual rows in Postgres.
- **`/procure-to-pay` — `src/components/synapse/ReconciliationDemo.tsx`** — the original product wedge, backend-driven:
  - Click **"Run reconciliation"** → calls `captureInvoice` → `matchInvoice` → `scoreRisk` in sequence via `useServerFn`, each a real `createServerFn` in `src/agents/`. Each call writes to Postgres; UI stage transitions are driven by the actual responses, not a timer.
  - **Back office / WhatsApp thread toggle** — same real run, two renderings (`OfficeView` / `WhatsAppView`).
  - **Established / New supplier toggle** — two real rows in the `suppliers` table (`established` = 34 orders of history, `new` = zero, category-benchmark fallback). Switching calls the same real pipeline with a different `supplierId`.
  - **Evidence-gated approval** — Approve/Hold/Escalate call `recordDecision`, which writes the decision back to the invoice's row.
- **`/inventory` — `src/components/synapse/InventoryDemo.tsx`** — real stock levels (`inventoryItems` table) with a critical/low/ok status derived from `reorderPoint`. Receive/Consume buttons call `adjustStock`, which writes a `stock_movements` row and recomputes the quantity — real, not a slider that resets on refresh.
- **`/finance` — `src/components/synapse/FinanceDemo.tsx`** — real CAPEX budgets (`budgets` table, one row per department/period). Submitting a spend request runs `submitSpendRequest`, a deterministic check against `capexLimit`/`hedgeThreshold` (same logic the Dashboard's illustrative "Q1 CAPEX 62% utilized" step describes), and writes the result to `spendRequests` + updates `budgets.utilized`.
- **`/legal` — `src/components/synapse/LegalDemo.tsx`** — real contract records (`contracts` table). "Run compliance check" calls `runComplianceCheck`, which validates the contract's status and required clauses (including the ASEAN cross-border clause when the contract's region needs it), and logs the verdict to `complianceChecks`.
- **`/sales` — `src/components/synapse/SalesDemo.tsx`** — a real deal pipeline (`deals` table). Win probability is computed deterministically from stage + deal size in `src/agents/sales.ts`, not a random or hardcoded number, and recalculates every time a deal advances.
- **`/hr` — `src/components/synapse/HRDemo.tsx`** — real headcount/onboarding requests (`hrRequests` table). Submitting a headcount request reads the requesting department's live `budgets` row and attaches a real policy note if utilization is ≥80% — a genuine cross-department read, not a canned string.
- **`/memory` — `src/components/synapse/MemoryDemo.tsx`** — real document index (`documents` table: policy/SOP/contract/decision, multilingual). Client-side search + category filter over real rows; "Add document" writes a new row. The Dashboard's "Enterprise memory" card now shows the real count instead of a hardcoded "12,481".
- **`/integrations` — `src/components/synapse/IntegrationsDemo.tsx`** — real connector state (`connectors` table, the same 8 names the Dashboard lists). Connect/Disconnect calls `toggleConnector`, a real status flip + `lastSyncAt` update.
- **`/governance` — `src/components/synapse/GovernanceDemo.tsx`** — no new table. `getGovernanceLog` reads `invoices`/`complianceChecks`/`spendRequests`/`hrRequests`/`deals` and merges every decision/verdict into one chronological audit trail with a computed pass-rate stat — the same "write back to the dataset" every other agent already does, just surfaced in one place.
- **`/analytics` — `src/components/synapse/AnalyticsDemo.tsx`** — no new table. `getAnalytics` aggregates `budgets`/`deals`/`inventoryItems`/`complianceChecks` into cross-department metrics, rendered with `recharts` (installed as a dependency since the start but unused until now) — budget utilization by department, deal pipeline value by stage, compliance pass/flag split.
- **`/agents` — `src/components/synapse/AgentsOverviewDemo.tsx`** — no new agent. Lists all 6 department agents with real task counts by reusing `getDashboardStats()`.

The one remaining fake piece across every page: `fakeExtract()` in `src/agents/capture.ts` returns realistic OCR/vision-LLM-shaped output instantly instead of calling a real model. Everything else — matching, scoring, budgets, contracts, deals, HR requests, documents, connectors, the governance trail, the analytics charts, persistence, dashboard — is genuinely real.

### Server architecture

- **`src/server/db/schema.ts`** — drizzle **pg-core** schema. Original: `suppliers` and `invoices`. Added across two passes: `inventoryItems`/`stockMovements`, `budgets`/`spendRequests`, `contracts`/`complianceChecks`, `deals`, `hrRequests`, `documents`, `connectors` — same conventions as the original tables (app-generated `text` IDs, `jsonb` for structured results, `timestamp` for dates).
- **`src/server/db/client.server.ts`** — production reads `POSTGRES_URL` via `drizzle-orm/vercel-postgres` (`@vercel/postgres`, Neon's serverless WebSocket protocol — only reachable against a real Neon-backed endpoint). **New:** set `LOCAL_PG=1` in `.env.local` to route the same schema through `drizzle-orm/node-postgres` (plain TCP) against any local Postgres instead — used to build/verify both passes locally via a Docker Postgres container, since `@vercel/postgres` can't reach one directly. Production behavior is unchanged unless `LOCAL_PG` is explicitly set. The `.server.ts` suffix is still load-bearing — see "Gotchas" below.
- **`src/server/db/seed.ts`** — `npx tsx src/server/db/seed.ts`, inserts demo rows for every table, all with `onConflictDoNothing()` (safe to re-run).
- **`src/agents/{capture,match,risk,stats,inventory,finance,legal,sales,hr,memory,integrations,governance,analytics}.ts`** — one file per department/concern, each exporting its `createServerFn`s. `governance.ts` and `analytics.ts` are read-only aggregations with no corresponding table. Deliberately **not** under `src/server/` despite the name — see Gotchas.
- **`src/components/synapse/shared.tsx`** — small UI helpers (`PageHeader`, `Pill`, `SectionCard`, `ErrorBanner`, `EmptyState`) factored out so the department pages don't each reimplement `ReconciliationDemo.tsx`'s header/card/pill styling from scratch.
- **`drizzle.config.ts`** — `dialect: "postgresql"`, reads `POSTGRES_URL`. This is how `npx drizzle-kit push` creates/updates tables on the target database (local or Vercel Postgres, depending on which `POSTGRES_URL` is in the environment when you run it).

### Gotchas discovered building this

- **`src/server/**` is unconditionally denied for client imports in this project.** Not just native modules — the whole path segment. `createServerFn` definitions need to live in a client-importable location (hence `src/agents/`, not `src/server/agents/` as originally planned) since the client legitimately needs to import the function reference to get its RPC stub. Only pure server-internal code (the actual `db` connection) belongs under `src/server/`, and even then needs the `.server.ts` suffix to be safely excluded from the client bundle.
- If you add a new agent or server-only module, put the `createServerFn` in `src/agents/`, and anything it needs that must never reach the browser (db clients, secrets) in `src/server/**` with a `.server.ts` filename.
- **`import type { X } from "@/server/db/schema"` is fine on the client; `import { X } from "@/server/db/schema"` for a runtime value (a `const` array, an enum-like tuple) is not.** Hit this twice, independently — `HRDemo.tsx` (`hrRequestTypes`) and `MemoryDemo.tsx` (`documentCategories`), both importing a runtime array to populate a `<select>`/filter buttons. Vite's import-protection plugin throws at dev-server load time (or would fail the build). Fix: keep a small client-side copy of the values (see `HR_REQUEST_TYPES` / `DOCUMENT_CATEGORIES` in those files) instead of importing the runtime export. Type-only imports are erased at compile time so they don't trigger the check; runtime imports do. **Easy to repeat** — if a new page needs a schema-defined enum's values for a `<select>`/filter UI, define a local client-safe copy from the start rather than reaching for the schema export.

## Running it locally

**Two ways to get a Postgres connection, depending on what you're doing:**

1. **Against the real Vercel Postgres** (to test against production data / before deploying) — do the "Deploying to Vercel" steps above through `npx vercel env pull .env.local`, then `npx drizzle-kit push` and the seed script.
2. **Against a local Postgres** (faster iteration, no Vercel account needed) — this is how this pass was actually built and verified:
   ```bash
   docker run -d --name jalinkai-postgres -e POSTGRES_PASSWORD=jalinkai -e POSTGRES_DB=jalinkai -p 55432:5432 postgres:16-alpine
   ```
   then create `.env.local`:
   ```
   POSTGRES_URL=postgres://postgres:jalinkai@localhost:55432/jalinkai
   LOCAL_PG=1
   ```
   `LOCAL_PG=1` routes `client.server.ts` through `drizzle-orm/node-postgres` instead of `drizzle-orm/vercel-postgres` — required because `@vercel/postgres` speaks Neon's serverless WebSocket protocol and can't reach a plain local Postgres. `pg`/`@types/pg` are already devDependencies for this. Omit `LOCAL_PG` (or don't set it) to fall back to the production driver.

Either way, then:

```bash
cd synapse-workflow-pilot
bun install && bun dev      # preferred — bun.lock is the real lockfile
# or
npm install && npm run dev  # works, see "npm quirks" below
```

Then push the schema and seed once against whichever `POSTGRES_URL` is active:

```bash
npx drizzle-kit push --force
npx tsx src/server/db/seed.ts
```

Dev server picks the first free port starting at 8080 (was 8081 against the local Postgres in the last verified run — check the terminal output). **This pass (Finance/Legal/Sales/HR/Inventory) was verified end-to-end against a local Postgres via the `LOCAL_PG=1` path** — every page loaded, every write (adjust stock, submit spend request, run compliance check, advance deal, submit/approve HR request) round-tripped through Postgres and rendered the updated real data, and the original `/` and `/procure-to-pay` pages were re-checked for regressions (none found). Not yet re-verified against the actual Vercel Postgres instance.

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

1. ~~A database~~ — done. Postgres (Vercel Postgres) via drizzle-orm, real tables across all 6 departments, deployable and cloud-persisted.
2. ~~Real Match Agent~~ — done. Deterministic rules in `src/agents/match.ts`, no LLM involved, matches the pitch deck's "the arithmetic isn't AI" claim.
3. ~~Real backends for Finance/Inventory/Legal/Sales/HR~~ — done, this pass. Each has real tables, a `createServerFn` agent with deterministic logic, and a page — see "App — what's actually in this repo" above.
4. **Real Capture Agent** — swap `fakeExtract()` in `src/agents/capture.ts` for an actual SEA-LION (or Claude/GPT-4V as a fallback) vision + structured-output call. This is now the single highest-leverage remaining fake piece — everything downstream already works with real data once this returns real extractions.
5. **Wizard-of-Oz pilot with 2-3 design partners** — now that persistence is real across every department, a human-in-the-loop pilot would actually accumulate real operational data instead of a throwaway one. There's an old Streamlit-based version of this at the repo root (`app.py` + `wizard_app.py`) — worth reviving as the operator-facing side.
6. **Real WhatsApp Business API integration** — the `WhatsAppView` component is a convincing mockup of the target UX and now renders real backend data; making it real means a WhatsApp Business API account and a webhook backend that calls the same `src/agents/*` server functions, which don't need to change.

## File map

```
synapse-workflow-pilot/
├── src/
│   ├── agents/
│   │   ├── capture.ts               — CaptureAgent (createServerFn, fake extraction, real DB write)
│   │   ├── match.ts                 — MatchAgent (createServerFn, real deterministic rules)
│   │   ├── risk.ts                  — RiskAgent + recordDecision (createServerFn)
│   │   ├── inventory.ts             — InventoryAgent — getInventory, adjustStock, getStockMovements
│   │   ├── finance.ts               — FinanceAgent — getBudgets, submitSpendRequest, getSpendRequests
│   │   ├── legal.ts                 — LegalAgent — getContracts, runComplianceCheck, getComplianceChecks
│   │   ├── sales.ts                 — SalesAgent — getDeals, createDeal, advanceDealStage
│   │   ├── hr.ts                    — HRAgent — getHrRequests, submitHrRequest, decideHrRequest
│   │   └── stats.ts                 — getDashboardStats (createServerFn, incl. departmentTaskCounts)
│   ├── server/db/
│   │   ├── schema.ts                — drizzle schema (suppliers, invoices, + 5 new department table groups)
│   │   ├── client.server.ts         — vercel-postgres (prod) / node-postgres (LOCAL_PG=1) connection
│   │   └── seed.ts                  — seeds demo rows for every table
│   ├── components/synapse/
│   │   ├── Dashboard.tsx            — "/" orchestrator view — real dept links + real task counts
│   │   ├── ReconciliationDemo.tsx   — "/procure-to-pay" wedge demo (fully real backend)
│   │   ├── InventoryDemo.tsx        — "/inventory" — stock levels + receive/consume
│   │   ├── FinanceDemo.tsx          — "/finance" — budgets + spend request check
│   │   ├── LegalDemo.tsx            — "/legal" — contracts + compliance check
│   │   ├── SalesDemo.tsx            — "/sales" — deal pipeline + win probability
│   │   ├── HRDemo.tsx               — "/hr" — headcount/onboarding requests
│   │   └── shared.tsx               — PageHeader/Pill/SectionCard/ErrorBanner/EmptyState, shared by the 5 above
│   ├── routes/
│   │   ├── index.tsx                — mounts Dashboard
│   │   ├── procure-to-pay.tsx       — mounts ReconciliationDemo
│   │   ├── inventory.tsx, finance.tsx, legal.tsx, sales.tsx, hr.tsx — one per department, same pattern
│   │   └── __root.tsx                — page shell, meta tags
│   └── styles.css                   — design tokens (ink/paper/rose/amber/success, oklch)
├── drizzle.config.ts                 — drizzle-kit config, for future migrations
├── jalinkai.db                       — local SQLite file (gitignored, dead — not used by any code path)
├── app.py, wizard_app.py             — old Streamlit Wizard-of-Oz prototype (Python, unrelated stack)
└── package.json                      — see npm quirks above re: overrides block; `pg`/`@types/pg` added for LOCAL_PG
```

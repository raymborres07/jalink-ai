import { drizzle as drizzleVercel } from "drizzle-orm/vercel-postgres";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// Production (Vercel): reads POSTGRES_URL from the environment automatically
// via the default @vercel/postgres `sql` client, which speaks Neon's
// serverless WebSocket protocol — only reachable against a real Neon-backed
// endpoint (Vercel Postgres), not a plain local Postgres.
//
// Local dev: set LOCAL_PG=1 in .env.local to route the same pg-core schema
// through drizzle-orm/node-postgres (plain TCP) against any local Postgres
// instead — same SQL dialect, same schema, different transport. Production
// is untouched unless LOCAL_PG is explicitly set.
//
// Schema is managed via `npx drizzle-kit push` (see drizzle.config.ts), not
// bootstrapped on import — this is a shared server-less Postgres instance,
// so DDL shouldn't run as a side effect of a cold start. Seed demo data once
// via `npx tsx src/server/db/seed.ts`.
export const db = process.env.LOCAL_PG
  ? drizzleNodePostgres(process.env.POSTGRES_URL!, { schema })
  : drizzleVercel({ schema });

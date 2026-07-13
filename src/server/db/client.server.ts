import { drizzle } from "drizzle-orm/vercel-postgres";
import * as schema from "./schema";

// Reads POSTGRES_URL (and related POSTGRES_URL_* vars) from the environment
// automatically via the default @vercel/postgres `sql` client. On Vercel this
// is injected for you once a Postgres database is attached to the project;
// locally, pull it with `npx vercel env pull .env.local`.
//
// Schema is managed via `npx drizzle-kit push` (see drizzle.config.ts), not
// bootstrapped on import — unlike the old SQLite setup, this is a shared
// server-less Postgres instance, so DDL shouldn't run as a side effect of a
// cold start. Seed the two demo suppliers once via `npx tsx src/server/db/seed.ts`.
export const db = drizzle({ schema });

import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../server/db/client.server";
import { dealStages, deals, type DealStage } from "../server/db/schema";

// Deterministic win-probability model: a base rate per pipeline stage,
// adjusted for deal size (very large deals close slower/less often for an
// SME-focused vendor; small deals close faster). Not AI-guessed — same
// "the arithmetic isn't AI" bar as the Match Agent.
const STAGE_BASE_PROBABILITY: Record<DealStage, number> = {
  lead: 15,
  qualified: 35,
  proposal: 60,
  won: 100,
  lost: 0,
};

function computeWinProbability(stage: DealStage, valueAmount: number): number {
  if (stage === "won" || stage === "lost") return STAGE_BASE_PROBABILITY[stage];
  const sizeAdjustment = valueAmount > 300_000_000 ? -10 : valueAmount < 50_000_000 ? 10 : 0;
  return Math.min(95, Math.max(5, STAGE_BASE_PROBABILITY[stage] + sizeAdjustment));
}

export const getDeals = createServerFn({ method: "GET" }).handler(async () => {
  return db.select().from(deals).orderBy(desc(deals.updatedAt));
});

const createDealInputSchema = z.object({
  customerName: z.string().min(1),
  region: z.string().min(1),
  valueAmount: z.number().int().positive(),
  currency: z.string().min(1),
});

export const createDeal = createServerFn({ method: "POST" })
  .validator((data: unknown) => createDealInputSchema.parse(data))
  .handler(async ({ data }) => {
    const now = new Date();
    const [deal] = await db
      .insert(deals)
      .values({
        id: randomUUID(),
        customerName: data.customerName,
        region: data.region,
        valueAmount: data.valueAmount,
        currency: data.currency,
        stage: "lead",
        winProbability: computeWinProbability("lead", data.valueAmount),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return deal;
  });

const advanceStageInputSchema = z.object({
  dealId: z.string(),
  stage: z.enum(dealStages),
});

export const advanceDealStage = createServerFn({ method: "POST" })
  .validator((data: unknown) => advanceStageInputSchema.parse(data))
  .handler(async ({ data }) => {
    const [deal] = await db.select().from(deals).where(eq(deals.id, data.dealId));
    if (!deal) throw new Error("Deal not found");

    const [updated] = await db
      .update(deals)
      .set({
        stage: data.stage,
        winProbability: computeWinProbability(data.stage, deal.valueAmount),
        updatedAt: new Date(),
      })
      .where(eq(deals.id, data.dealId))
      .returning();

    return updated;
  });

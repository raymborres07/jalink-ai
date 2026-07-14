import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../server/db/client.server";
import { budgets, spendRequests, type Budget, type SpendRequestStatus } from "../server/db/schema";

export interface BudgetWithUtilization extends Budget {
  utilizationPct: number;
}

function withUtilization(budget: Budget): BudgetWithUtilization {
  return { ...budget, utilizationPct: Math.round((budget.utilized / budget.capexLimit) * 100) };
}

export const getBudgets = createServerFn({ method: "GET" }).handler(
  async (): Promise<BudgetWithUtilization[]> => {
    const rows = await db.select().from(budgets).orderBy(budgets.department);
    return rows.map(withUtilization);
  },
);

const submitSpendInputSchema = z.object({
  budgetId: z.string(),
  description: z.string().min(1),
  amount: z.number().int().positive(),
});

export const submitSpendRequest = createServerFn({ method: "POST" })
  .validator((data: unknown) => submitSpendInputSchema.parse(data))
  .handler(async ({ data }) => {
    const [budget] = await db.select().from(budgets).where(eq(budgets.id, data.budgetId));
    if (!budget) throw new Error("Budget not found");

    const nextUtilized = budget.utilized + data.amount;
    const overLimit = nextUtilized > budget.capexLimit;
    const crossesHedgeThreshold = nextUtilized > budget.hedgeThreshold;

    // Rule (deterministic, not AI): same threshold logic the Dashboard's
    // illustrative Finance Agent step describes — flag a hedge above the
    // configured threshold, block outright only past the hard CAPEX limit.
    const status: SpendRequestStatus = overLimit
      ? "over_threshold"
      : crossesHedgeThreshold
        ? "hedge_recommended"
        : "approved";

    const reasoning = overLimit
      ? `${budget.department} ${budget.period} CAPEX limit is ${budget.currency} ${budget.capexLimit.toLocaleString()}. This spend would bring utilization to ${budget.currency} ${nextUtilized.toLocaleString()} — over the limit. Recommend deferring or splitting across periods.`
      : crossesHedgeThreshold
        ? `${budget.department} ${budget.period} utilization would reach ${budget.currency} ${nextUtilized.toLocaleString()}, above the ${budget.currency} ${budget.hedgeThreshold.toLocaleString()} hedge threshold. Recommend executing an FX forward hedge for the cross-border exposure.`
        : `Within budget — ${budget.department} ${budget.period} utilization moves to ${Math.round((nextUtilized / budget.capexLimit) * 100)}% of the ${budget.currency} ${budget.capexLimit.toLocaleString()} limit.`;

    const id = randomUUID();
    await db.insert(spendRequests).values({
      id,
      budgetId: data.budgetId,
      description: data.description,
      amount: data.amount,
      status,
      reasoning,
      createdAt: new Date(),
    });

    const [updatedBudget] = await db
      .update(budgets)
      .set({ utilized: nextUtilized })
      .where(eq(budgets.id, data.budgetId))
      .returning();

    return {
      id,
      status,
      reasoning,
      budget: withUtilization(updatedBudget),
    };
  });

export const getSpendRequests = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ budgetId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    return db
      .select()
      .from(spendRequests)
      .where(eq(spendRequests.budgetId, data.budgetId))
      .orderBy(desc(spendRequests.createdAt))
      .limit(10);
  });

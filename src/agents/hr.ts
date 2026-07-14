import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../server/db/client.server";
import { budgets, hrRequestTypes, hrRequests } from "../server/db/schema";

export const getHrRequests = createServerFn({ method: "GET" }).handler(async () => {
  return db.select().from(hrRequests).orderBy(desc(hrRequests.createdAt));
});

const submitInputSchema = z.object({
  type: z.enum(hrRequestTypes),
  department: z.string().min(1),
  roleOrName: z.string().min(1),
  justification: z.string().min(1),
});

export const submitHrRequest = createServerFn({ method: "POST" })
  .validator((data: unknown) => submitInputSchema.parse(data))
  .handler(async ({ data }) => {
    // Real cross-department check, not a mock: headcount requests are
    // flagged when the requesting department's CAPEX budget is already
    // tight, since new headcount is itself a budget line item.
    let policyNote: string | null = null;
    if (data.type === "headcount") {
      const [budget] = await db
        .select()
        .from(budgets)
        .where(eq(budgets.department, data.department));
      if (budget) {
        const utilizationPct = Math.round((budget.utilized / budget.capexLimit) * 100);
        policyNote =
          utilizationPct >= 80
            ? `${data.department} ${budget.period} budget is already ${utilizationPct}% utilized — Finance sign-off recommended before approving.`
            : `${data.department} ${budget.period} budget is ${utilizationPct}% utilized — within normal range.`;
      }
    }

    const [request] = await db
      .insert(hrRequests)
      .values({
        id: randomUUID(),
        type: data.type,
        department: data.department,
        roleOrName: data.roleOrName,
        justification: data.justification,
        status: "pending",
        policyNote,
        createdAt: new Date(),
      })
      .returning();

    return request;
  });

const decideInputSchema = z.object({
  requestId: z.string(),
  decision: z.enum(["approved", "rejected"] as const),
});

export const decideHrRequest = createServerFn({ method: "POST" })
  .validator((data: unknown) => decideInputSchema.parse(data))
  .handler(async ({ data }) => {
    const [updated] = await db
      .update(hrRequests)
      .set({ status: data.decision })
      .where(eq(hrRequests.id, data.requestId))
      .returning();
    if (!updated) throw new Error("HR request not found");
    return updated;
  });

import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../server/db/client.server";
import { invoices, suppliers, type RiskResult } from "../server/db/schema";

const riskInputSchema = z.object({ invoiceId: z.string() });

export const scoreRisk = createServerFn({ method: "POST" })
  .validator((data: unknown) => riskInputSchema.parse(data))
  .handler(async ({ data }) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, data.invoiceId));
    if (!invoice || !invoice.matchResult) throw new Error("Invoice not found or not yet matched");

    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, invoice.supplierId));
    if (!supplier) throw new Error("Supplier not found");

    const hasVariance = invoice.matchResult.some((row) => row.status !== "match");
    const isNewSupplier = supplier.id === "new";

    const reasoning = isNewSupplier
      ? `This is JalinkAI's first reconciliation with ${supplier.name}, so there's no track record to score against. This estimate uses the Steel & Metal Fabrication category benchmark (9% average late-delivery rate across the ASEAN supplier base) instead of observed history.`
      : `${supplier.name} has a 12% late-delivery rate over the last 6 months, and this shipment is late against agreed terms. Quantity and pricing reconcile once phrasing variance is accounted for.`;

    const recommendation = !hasVariance
      ? "Recommend approve — clean match, no discrepancy."
      : isNewSupplier
        ? "Recommend approve, but flag for manual review until a track record builds."
        : "Recommend approve with a note, not block.";

    const result: RiskResult = {
      riskScore: supplier.riskScore,
      riskLabel: supplier.riskLabel,
      basis: supplier.basis,
      onTimeRate: supplier.onTimeRate,
      disputeFrequency: supplier.disputeFrequency,
      priceVariance: supplier.priceVariance,
      reasoning,
      recommendation,
    };

    await db
      .update(invoices)
      .set({ riskResult: result, status: "scored" })
      .where(eq(invoices.id, data.invoiceId));

    return result;
  });

const decisionInputSchema = z.object({
  invoiceId: z.string(),
  decision: z.enum(["approved", "held", "escalated"]),
});

export const recordDecision = createServerFn({ method: "POST" })
  .validator((data: unknown) => decisionInputSchema.parse(data))
  .handler(async ({ data }) => {
    await db
      .update(invoices)
      .set({ status: data.decision, decision: data.decision })
      .where(eq(invoices.id, data.invoiceId));
    return { ok: true as const };
  });

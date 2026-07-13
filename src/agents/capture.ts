import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../server/db/client.server";
import { invoices, type ExtractedFields } from "../server/db/schema";

const captureInputSchema = z.object({
  supplierId: z.enum(["established", "new"]),
});

// Deterministic stand-in for a real OCR/vision-LLM call (e.g. SEA-LION v4).
// It returns the same shaped, confidence-tagged JSON a real extraction would,
// so swapping in an actual model call later only means replacing this
// function's body — the server function boundary and DB write stay the same.
function fakeExtract(supplierId: "established" | "new"): ExtractedFields {
  const supplierName =
    supplierId === "established" ? "Sinar Logam Sdn Bhd" : "Baru Jaya Metalworks";
  return {
    supplier: { value: supplierName, confidence: 0.97 },
    poNumber: { value: "4500-8821", confidence: 0.95 },
    invoiceNumber: { value: "INV-8821-B", confidence: 0.93 },
    quantity: { value: "500 unit", confidence: 0.88 },
    unitPrice: { value: "IDR 285,000", confidence: 0.9 },
    itemDescription: { value: "Steel Rod Grade-A", confidence: 0.88 },
    totalAmount: { value: "IDR 142,500,000", confidence: 0.91 },
    date: { value: "3 Feb 2026 (partly smudged)", confidence: 0.61 },
  };
}

export const captureInvoice = createServerFn({ method: "POST" })
  .validator((data: unknown) => captureInputSchema.parse(data))
  .handler(async ({ data }) => {
    await new Promise((resolve) => setTimeout(resolve, 900)); // simulated extraction latency

    const extracted = fakeExtract(data.supplierId);
    const id = randomUUID();

    // id is app-generated (not DB-generated), so no .returning() is needed to
    // learn it — but returning() confirms the row was actually written.
    await db
      .insert(invoices)
      .values({
        id,
        supplierId: data.supplierId,
        poNumber: extracted.poNumber.value,
        invoiceNumber: extracted.invoiceNumber.value,
        status: "captured",
        extracted,
        createdAt: new Date(),
      })
      .returning({ id: invoices.id });

    return { invoiceId: id, extracted };
  });

import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../server/db/client.server";
import { invoices, type MatchRow } from "../server/db/schema";

// The PO and delivery record this demo reconciles against. In a real system
// these would be their own tables (linked by PO number); this build has
// exactly one demo PO, so they're constants deliberately kept next to the
// rule logic that reads them.
const PURCHASE_ORDER = {
  quantity: "500 pcs",
  quantityCount: 500,
  unitPrice: "IDR 285,000",
  item: "Steel Rod Grade A",
  deliveryTermDays: 14,
};

const DELIVERY_NOTE = {
  quantity: "500 pcs",
  item: "Steel Rod Grade A",
  daysLate: 4,
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s-]/g, "");
}

function parseLeadingNumber(value: string): number | null {
  const match = value.match(/[\d,]+/);
  return match ? Number.parseInt(match[0].replace(/,/g, ""), 10) : null;
}

const matchInputSchema = z.object({ invoiceId: z.string() });

export const matchInvoice = createServerFn({ method: "POST" })
  .validator((data: unknown) => matchInputSchema.parse(data))
  .handler(async ({ data }) => {
    await new Promise((resolve) => setTimeout(resolve, 1300));

    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, data.invoiceId));
    if (!invoice || !invoice.extracted) throw new Error("Invoice not found or not yet captured");
    const extracted = invoice.extracted;

    // Rule 1 — quantity: deterministic numeric comparison, not AI-guessed.
    const invoiceQty = parseLeadingNumber(extracted.quantity.value);
    const quantityRow: MatchRow =
      invoiceQty === PURCHASE_ORDER.quantityCount
        ? normalize(extracted.quantity.value) === normalize(PURCHASE_ORDER.quantity)
          ? {
              field: "Quantity",
              po: PURCHASE_ORDER.quantity,
              delivery: DELIVERY_NOTE.quantity,
              invoice: extracted.quantity.value,
              status: "match",
            }
          : {
              field: "Quantity",
              po: PURCHASE_ORDER.quantity,
              delivery: DELIVERY_NOTE.quantity,
              invoice: extracted.quantity.value,
              status: "fuzzy",
              note: `Matched "${extracted.quantity.value}" to "${PURCHASE_ORDER.quantity}" — same quantity, different phrasing.`,
            }
        : {
            field: "Quantity",
            po: PURCHASE_ORDER.quantity,
            delivery: DELIVERY_NOTE.quantity,
            invoice: extracted.quantity.value,
            status: "variance",
            note: `PO says ${PURCHASE_ORDER.quantityCount}, invoice says ${invoiceQty ?? "unreadable"}.`,
          };

    // Rule 2 — unit price: exact string comparison against the hardcoded PO total.
    const priceRow: MatchRow =
      normalize(extracted.unitPrice.value) === normalize(PURCHASE_ORDER.unitPrice)
        ? {
            field: "Unit price",
            po: PURCHASE_ORDER.unitPrice,
            delivery: "—",
            invoice: extracted.unitPrice.value,
            status: "match",
          }
        : {
            field: "Unit price",
            po: PURCHASE_ORDER.unitPrice,
            delivery: "—",
            invoice: extracted.unitPrice.value,
            status: "variance",
            note: `PO says ${PURCHASE_ORDER.unitPrice}, invoice says ${extracted.unitPrice.value}.`,
          };

    // Rule 3 — item description: normalized comparison (case/hyphen-insensitive).
    const itemRow: MatchRow =
      extracted.itemDescription.value === PURCHASE_ORDER.item
        ? {
            field: "Item description",
            po: PURCHASE_ORDER.item,
            delivery: DELIVERY_NOTE.item,
            invoice: extracted.itemDescription.value,
            status: "match",
          }
        : normalize(extracted.itemDescription.value) === normalize(PURCHASE_ORDER.item)
          ? {
              field: "Item description",
              po: PURCHASE_ORDER.item,
              delivery: DELIVERY_NOTE.item,
              invoice: extracted.itemDescription.value,
              status: "fuzzy",
              note: "Matched casing / hyphen variance — same SKU.",
            }
          : {
              field: "Item description",
              po: PURCHASE_ORDER.item,
              delivery: DELIVERY_NOTE.item,
              invoice: extracted.itemDescription.value,
              status: "variance",
              note: "Item description does not match the PO — needs manual review.",
            };

    // Rule 4 — delivery timing: hardcoded delivery record vs. agreed PO terms.
    const deliveryRow: MatchRow =
      DELIVERY_NOTE.daysLate <= 0
        ? {
            field: "Delivery date",
            po: `Due within ${PURCHASE_ORDER.deliveryTermDays} days`,
            delivery: "Received on time",
            invoice: "—",
            status: "match",
          }
        : {
            field: "Delivery date",
            po: `Due within ${PURCHASE_ORDER.deliveryTermDays} days`,
            delivery: `Received ${DELIVERY_NOTE.daysLate} days late`,
            invoice: "—",
            status: "variance",
            note: "Outside agreed terms — passed to Risk Agent.",
          };

    const rows = [quantityRow, priceRow, itemRow, deliveryRow];
    const hasVariance = rows.some((row) => row.status !== "match");

    await db
      .update(invoices)
      .set({ matchResult: rows, status: "matched" })
      .where(eq(invoices.id, data.invoiceId));

    return { rows, hasVariance, daysLate: DELIVERY_NOTE.daysLate };
  });

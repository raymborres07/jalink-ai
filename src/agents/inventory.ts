import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../server/db/client.server";
import {
  inventoryItems,
  stockMovementReasons,
  stockMovements,
  type InventoryItem,
} from "../server/db/schema";

export type StockLevel = "critical" | "low" | "ok";

export interface InventoryItemWithLevel extends InventoryItem {
  level: StockLevel;
  reorderQty: number;
}

function computeLevel(item: InventoryItem): InventoryItemWithLevel {
  const level: StockLevel =
    item.quantityOnHand <= item.reorderPoint * 0.5
      ? "critical"
      : item.quantityOnHand <= item.reorderPoint
        ? "low"
        : "ok";
  const reorderQty = Math.max(0, item.targetStock - item.quantityOnHand);
  return { ...item, level, reorderQty };
}

export const getInventory = createServerFn({ method: "GET" }).handler(
  async (): Promise<InventoryItemWithLevel[]> => {
    const items = await db.select().from(inventoryItems).orderBy(inventoryItems.name);
    return items.map(computeLevel);
  },
);

const adjustStockInputSchema = z.object({
  itemId: z.string(),
  quantityDelta: z
    .number()
    .int()
    .refine((n) => n !== 0, "Delta must be non-zero"),
  reason: z.enum(stockMovementReasons),
  note: z.string().optional(),
});

export const adjustStock = createServerFn({ method: "POST" })
  .validator((data: unknown) => adjustStockInputSchema.parse(data))
  .handler(async ({ data }): Promise<InventoryItemWithLevel> => {
    const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, data.itemId));
    if (!item) throw new Error("Inventory item not found");

    const nextQuantity = Math.max(0, item.quantityOnHand + data.quantityDelta);

    const [updated] = await db
      .update(inventoryItems)
      .set({ quantityOnHand: nextQuantity, updatedAt: new Date() })
      .where(eq(inventoryItems.id, data.itemId))
      .returning();

    await db.insert(stockMovements).values({
      id: randomUUID(),
      itemId: data.itemId,
      quantityDelta: data.quantityDelta,
      reason: data.reason,
      note: data.note,
      createdAt: new Date(),
    });

    return computeLevel(updated);
  });

export const getStockMovements = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ itemId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    return db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.itemId, data.itemId))
      .orderBy(desc(stockMovements.createdAt))
      .limit(10);
  });

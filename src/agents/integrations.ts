import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../server/db/client.server";
import { connectors } from "../server/db/schema";

export const getConnectors = createServerFn({ method: "GET" }).handler(async () => {
  return db.select().from(connectors).orderBy(connectors.category, connectors.name);
});

const toggleInputSchema = z.object({ connectorId: z.string() });

export const toggleConnector = createServerFn({ method: "POST" })
  .validator((data: unknown) => toggleInputSchema.parse(data))
  .handler(async ({ data }) => {
    const [connector] = await db
      .select()
      .from(connectors)
      .where(eq(connectors.id, data.connectorId));
    if (!connector) throw new Error("Connector not found");

    const nextStatus = connector.status === "connected" ? "disconnected" : "connected";
    const [updated] = await db
      .update(connectors)
      .set({
        status: nextStatus,
        lastSyncAt: nextStatus === "connected" ? new Date() : connector.lastSyncAt,
      })
      .where(eq(connectors.id, data.connectorId))
      .returning();

    return updated;
  });

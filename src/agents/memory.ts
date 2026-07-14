import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "../server/db/client.server";
import { documentCategories, documents } from "../server/db/schema";

export const getDocuments = createServerFn({ method: "GET" }).handler(async () => {
  return db.select().from(documents).orderBy(desc(documents.createdAt));
});

const addDocumentInputSchema = z.object({
  title: z.string().min(1),
  category: z.enum(documentCategories),
  language: z.string().min(1),
  summary: z.string().min(1),
  tags: z.array(z.string()).default([]),
});

export const addDocument = createServerFn({ method: "POST" })
  .validator((data: unknown) => addDocumentInputSchema.parse(data))
  .handler(async ({ data }) => {
    const [doc] = await db
      .insert(documents)
      .values({ id: randomUUID(), ...data, createdAt: new Date() })
      .returning();
    return doc;
  });

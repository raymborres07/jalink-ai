import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../server/db/client.server";
import { complianceChecks, contracts, type ComplianceCheckResult } from "../server/db/schema";

export const getContracts = createServerFn({ method: "GET" }).handler(async () => {
  return db.select().from(contracts).orderBy(contracts.name);
});

// Required clauses for any contract to pass compliance, deterministic —
// mirrors the "MSA v3.2 ASEAN cross-border clause pre-checked" narrative.
const BASE_REQUIRED_CLAUSES = ["Force majeure", "Late delivery penalty ≤5%"];
const CROSS_BORDER_REQUIRED_CLAUSE = "ASEAN cross-border data transfer clause";

const runComplianceInputSchema = z.object({
  contractId: z.string(),
  subject: z.string().min(1),
});

export const runComplianceCheck = createServerFn({ method: "POST" })
  .validator((data: unknown) => runComplianceInputSchema.parse(data))
  .handler(async ({ data }) => {
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, data.contractId));
    if (!contract) throw new Error("Contract not found");

    const isCrossBorder = contract.region.toLowerCase().includes("cross-border");
    const requiredClauses = isCrossBorder
      ? [...BASE_REQUIRED_CLAUSES, CROSS_BORDER_REQUIRED_CLAUSE]
      : BASE_REQUIRED_CLAUSES;

    const matchedClauses = requiredClauses.filter((required) =>
      contract.clauses.some((c) => c.toLowerCase().includes(required.toLowerCase())),
    );
    const missingClauses = requiredClauses.filter((c) => !matchedClauses.includes(c));

    const verdict: ComplianceCheckResult["verdict"] =
      contract.status === "active" && missingClauses.length === 0 ? "pass" : "flag";

    const reasoning =
      contract.status !== "active"
        ? `Contract "${contract.name} ${contract.version}" with ${contract.counterparty} is ${contract.status}, not active — cannot apply to "${data.subject}" without a signed amendment.`
        : missingClauses.length > 0
          ? `Contract "${contract.name} ${contract.version}" is missing required clause(s) for ${contract.region}: ${missingClauses.join(", ")}.`
          : `Contract "${contract.name} ${contract.version}" is active and covers all required clauses for ${contract.region}. Applies cleanly to "${data.subject}".`;

    const result: ComplianceCheckResult = { verdict, reasoning, matchedClauses, missingClauses };

    const id = randomUUID();
    await db.insert(complianceChecks).values({
      id,
      contractId: data.contractId,
      subject: data.subject,
      region: contract.region,
      result,
      createdAt: new Date(),
    });

    return { id, result };
  });

export const getComplianceChecks = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ contractId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    return db
      .select()
      .from(complianceChecks)
      .where(eq(complianceChecks.contractId, data.contractId))
      .orderBy(desc(complianceChecks.createdAt))
      .limit(10);
  });

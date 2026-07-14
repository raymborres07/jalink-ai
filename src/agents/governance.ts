import { createServerFn } from "@tanstack/react-start";
import { db } from "../server/db/client.server";
import {
  complianceChecks,
  contracts,
  deals,
  hrRequests,
  invoices,
  spendRequests,
  suppliers,
} from "../server/db/schema";

export type GovernanceOutcome = "pass" | "flag" | "info";

export interface GovernanceEvent {
  id: string;
  department: string;
  summary: string;
  outcome: GovernanceOutcome;
  createdAt: number;
}

export interface GovernanceSummary {
  totalEvents: number;
  flaggedEvents: number;
  passRate: number;
}

export interface GovernanceLog {
  events: GovernanceEvent[];
  summary: GovernanceSummary;
}

// Real cross-department audit trail: no separate table, this is a read
// aggregation over decisions/verdicts already written by every other
// agent — the same "write back to the dataset" the pitch deck describes,
// surfaced as a single governance view instead of re-derived per page.
export const getGovernanceLog = createServerFn({ method: "GET" }).handler(
  async (): Promise<GovernanceLog> => {
    const [
      allInvoices,
      allSuppliers,
      allComplianceChecks,
      allContracts,
      allSpendRequests,
      allHrRequests,
      allDeals,
    ] = await Promise.all([
      db.select().from(invoices),
      db.select().from(suppliers),
      db.select().from(complianceChecks),
      db.select().from(contracts),
      db.select().from(spendRequests),
      db.select().from(hrRequests),
      db.select().from(deals),
    ]);

    const supplierNameById = new Map(allSuppliers.map((s) => [s.id, s.name]));
    const contractById = new Map(allContracts.map((c) => [c.id, c]));

    const events: GovernanceEvent[] = [];

    for (const invoice of allInvoices) {
      if (!invoice.decision) continue;
      events.push({
        id: `invoice-${invoice.id}`,
        department: "Procurement",
        summary: `${supplierNameById.get(invoice.supplierId) ?? invoice.supplierId} invoice ${invoice.decision}`,
        outcome:
          invoice.decision === "escalated" ? "flag" : invoice.decision === "held" ? "info" : "pass",
        createdAt: invoice.createdAt.getTime(),
      });
    }

    for (const check of allComplianceChecks) {
      const contract = contractById.get(check.contractId);
      events.push({
        id: `compliance-${check.id}`,
        department: "Legal",
        summary: `Compliance check on "${check.subject}" against ${contract?.name ?? "contract"} ${contract?.version ?? ""}: ${check.result.verdict}`,
        outcome: check.result.verdict === "pass" ? "pass" : "flag",
        createdAt: check.createdAt.getTime(),
      });
    }

    for (const spend of allSpendRequests) {
      events.push({
        id: `spend-${spend.id}`,
        department: "Finance",
        summary: `Spend request "${spend.description}": ${spend.status.replace(/_/g, " ")}`,
        outcome: spend.status === "approved" ? "pass" : "flag",
        createdAt: spend.createdAt.getTime(),
      });
    }

    for (const request of allHrRequests) {
      if (request.status === "pending") continue;
      events.push({
        id: `hr-${request.id}`,
        department: "HR",
        summary: `${request.type} request for ${request.roleOrName}: ${request.status}`,
        outcome: request.status === "approved" ? "pass" : "flag",
        createdAt: request.createdAt.getTime(),
      });
    }

    for (const deal of allDeals) {
      if (deal.stage !== "won" && deal.stage !== "lost") continue;
      events.push({
        id: `deal-${deal.id}`,
        department: "Sales",
        summary: `Deal with ${deal.customerName}: ${deal.stage}`,
        outcome: deal.stage === "won" ? "pass" : "flag",
        createdAt: deal.updatedAt.getTime(),
      });
    }

    events.sort((a, b) => b.createdAt - a.createdAt);

    const decisiveEvents = events.filter((e) => e.outcome !== "info");
    const flaggedEvents = decisiveEvents.filter((e) => e.outcome === "flag").length;
    const passRate =
      decisiveEvents.length === 0
        ? 100
        : Math.round(((decisiveEvents.length - flaggedEvents) / decisiveEvents.length) * 100);

    return {
      events: events.slice(0, 30),
      summary: { totalEvents: events.length, flaggedEvents, passRate },
    };
  },
);

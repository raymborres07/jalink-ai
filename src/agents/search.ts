import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "../server/db/client.server";
import {
  budgets,
  connectors,
  contracts,
  deals,
  documents,
  hrRequests,
  inventoryItems,
  invoices,
  suppliers,
} from "../server/db/schema";

export type SearchResultType =
  | "supplier"
  | "invoice"
  | "inventory"
  | "budget"
  | "contract"
  | "deal"
  | "hrRequest"
  | "document"
  | "connector";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  to: string;
}

const TYPE_LABEL: Record<SearchResultType, string> = {
  supplier: "Supplier",
  invoice: "Invoice",
  inventory: "Inventory",
  budget: "Budget",
  contract: "Contract",
  deal: "Deal",
  hrRequest: "HR",
  document: "Document",
  connector: "Connector",
};

const searchInputSchema = z.object({ query: z.string() });

// Real search across every real table in the app — not a mock, and not an
// LLM call either: substring matching over the same rows every department
// page reads/writes, grouped and capped for a quick-jump palette (⌘K).
export const globalSearch = createServerFn({ method: "GET" })
  .validator((data: unknown) => searchInputSchema.parse(data))
  .handler(async ({ data }): Promise<SearchResult[]> => {
    const q = data.query.trim().toLowerCase();
    if (q.length < 2) return [];

    const includes = (value: string | null | undefined) =>
      !!value && value.toLowerCase().includes(q);

    const [
      allSuppliers,
      allInvoices,
      allInventoryItems,
      allBudgets,
      allContracts,
      allDeals,
      allHrRequests,
      allDocuments,
      allConnectors,
    ] = await Promise.all([
      db.select().from(suppliers),
      db.select().from(invoices),
      db.select().from(inventoryItems),
      db.select().from(budgets),
      db.select().from(contracts),
      db.select().from(deals),
      db.select().from(hrRequests),
      db.select().from(documents),
      db.select().from(connectors),
    ]);

    const results: SearchResult[] = [];

    for (const s of allSuppliers) {
      if (includes(s.name)) {
        results.push({
          id: `supplier-${s.id}`,
          type: "supplier",
          title: s.name,
          subtitle: `${TYPE_LABEL.supplier} · ${s.riskLabel}`,
          to: "/procure-to-pay",
        });
      }
    }

    for (const inv of allInvoices) {
      if (includes(inv.poNumber) || includes(inv.invoiceNumber)) {
        results.push({
          id: `invoice-${inv.id}`,
          type: "invoice",
          title: inv.invoiceNumber ?? inv.poNumber ?? inv.id,
          subtitle: `${TYPE_LABEL.invoice} · ${inv.status}`,
          to: "/procure-to-pay",
        });
      }
    }

    for (const item of allInventoryItems) {
      if (includes(item.name) || includes(item.sku)) {
        results.push({
          id: `inventory-${item.id}`,
          type: "inventory",
          title: item.name,
          subtitle: `${TYPE_LABEL.inventory} · ${item.sku}`,
          to: "/inventory",
        });
      }
    }

    for (const b of allBudgets) {
      if (includes(b.department) || includes(b.period)) {
        results.push({
          id: `budget-${b.id}`,
          type: "budget",
          title: `${b.department} ${b.period}`,
          subtitle: `${TYPE_LABEL.budget} · ${b.currency} ${b.utilized.toLocaleString()}`,
          to: "/finance",
        });
      }
    }

    for (const c of allContracts) {
      if (includes(c.name) || includes(c.counterparty)) {
        results.push({
          id: `contract-${c.id}`,
          type: "contract",
          title: `${c.name} ${c.version}`,
          subtitle: `${TYPE_LABEL.contract} · ${c.counterparty}`,
          to: "/legal",
        });
      }
    }

    for (const d of allDeals) {
      if (includes(d.customerName) || includes(d.region)) {
        results.push({
          id: `deal-${d.id}`,
          type: "deal",
          title: d.customerName,
          subtitle: `${TYPE_LABEL.deal} · ${d.stage}`,
          to: "/sales",
        });
      }
    }

    for (const r of allHrRequests) {
      if (includes(r.roleOrName) || includes(r.department)) {
        results.push({
          id: `hr-${r.id}`,
          type: "hrRequest",
          title: r.roleOrName,
          subtitle: `${TYPE_LABEL.hrRequest} · ${r.type} · ${r.status}`,
          to: "/hr",
        });
      }
    }

    for (const doc of allDocuments) {
      if (includes(doc.title) || includes(doc.summary) || doc.tags.some(includes)) {
        results.push({
          id: `document-${doc.id}`,
          type: "document",
          title: doc.title,
          subtitle: `${TYPE_LABEL.document} · ${doc.category}`,
          to: "/memory",
        });
      }
    }

    for (const c of allConnectors) {
      if (includes(c.name) || includes(c.category)) {
        results.push({
          id: `connector-${c.id}`,
          type: "connector",
          title: c.name,
          subtitle: `${TYPE_LABEL.connector} · ${c.status}`,
          to: "/integrations",
        });
      }
    }

    return results.slice(0, 20);
  });

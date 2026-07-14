import { createServerFn } from "@tanstack/react-start";
import { count, desc } from "drizzle-orm";
import { db } from "../server/db/client.server";
import {
  complianceChecks,
  contracts,
  deals,
  hrRequests,
  inventoryItems,
  invoices,
  spendRequests,
  suppliers,
  type InvoiceStatus,
} from "../server/db/schema";

export interface RecentInvoice {
  id: string;
  supplierName: string;
  poNumber: string | null;
  status: InvoiceStatus;
  decision: string | null;
  createdAt: number;
}

export interface DepartmentTaskCounts {
  procurement: number;
  finance: number;
  inventory: number;
  legal: number;
  sales: number;
  hr: number;
}

export interface DashboardStats {
  totalInvoices: number;
  byStatus: Record<InvoiceStatus, number>;
  supplierCount: number;
  recent: RecentInvoice[];
  departmentTaskCounts: DepartmentTaskCounts;
}

export const getDashboardStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardStats> => {
    const [
      allInvoices,
      allSuppliers,
      [inventoryCount],
      [spendCount],
      [complianceCount],
      [dealCount],
      [hrCount],
      [contractCount],
    ] = await Promise.all([
      db.select().from(invoices).orderBy(desc(invoices.createdAt)),
      db.select().from(suppliers),
      db.select({ value: count() }).from(inventoryItems),
      db.select({ value: count() }).from(spendRequests),
      db.select({ value: count() }).from(complianceChecks),
      db.select({ value: count() }).from(deals),
      db.select({ value: count() }).from(hrRequests),
      db.select({ value: count() }).from(contracts),
    ]);

    const supplierNameById = new Map(allSuppliers.map((s) => [s.id, s.name]));

    const byStatus: Record<InvoiceStatus, number> = {
      pending: 0,
      captured: 0,
      matched: 0,
      scored: 0,
      approved: 0,
      held: 0,
      escalated: 0,
    };
    for (const invoice of allInvoices) {
      byStatus[invoice.status] += 1;
    }

    return {
      totalInvoices: allInvoices.length,
      byStatus,
      supplierCount: allSuppliers.length,
      recent: allInvoices.slice(0, 6).map((invoice) => ({
        id: invoice.id,
        supplierName: supplierNameById.get(invoice.supplierId) ?? invoice.supplierId,
        poNumber: invoice.poNumber,
        status: invoice.status,
        decision: invoice.decision,
        createdAt: invoice.createdAt.getTime(),
      })),
      departmentTaskCounts: {
        procurement: allInvoices.length,
        finance: spendCount.value,
        inventory: inventoryCount.value,
        legal: complianceCount.value + contractCount.value,
        sales: dealCount.value,
        hr: hrCount.value,
      },
    };
  },
);

import { createServerFn } from "@tanstack/react-start";
import { desc } from "drizzle-orm";
import { db } from "../server/db/client.server";
import { invoices, suppliers, type InvoiceStatus } from "../server/db/schema";

export interface RecentInvoice {
  id: string;
  supplierName: string;
  poNumber: string | null;
  status: InvoiceStatus;
  decision: string | null;
  createdAt: number;
}

export interface DashboardStats {
  totalInvoices: number;
  byStatus: Record<InvoiceStatus, number>;
  supplierCount: number;
  recent: RecentInvoice[];
}

export const getDashboardStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardStats> => {
    const [allInvoices, allSuppliers] = await Promise.all([
      db.select().from(invoices).orderBy(desc(invoices.createdAt)),
      db.select().from(suppliers),
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
    };
  },
);

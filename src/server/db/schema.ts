import { pgTable, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export interface ExtractedField {
  value: string;
  confidence: number;
}

export interface ExtractedFields {
  supplier: ExtractedField;
  poNumber: ExtractedField;
  invoiceNumber: ExtractedField;
  quantity: ExtractedField;
  unitPrice: ExtractedField;
  itemDescription: ExtractedField;
  totalAmount: ExtractedField;
  date: ExtractedField;
}

export type MatchStatus = "match" | "fuzzy" | "variance";

export interface MatchRow {
  field: string;
  po: string;
  delivery: string;
  invoice: string;
  status: MatchStatus;
  note?: string;
}

export interface RiskResult {
  riskScore: number;
  riskLabel: string;
  basis: string;
  onTimeRate: string;
  disputeFrequency: string;
  priceVariance: string;
  reasoning: string;
  recommendation: string;
}

export const invoiceStatuses = [
  "pending",
  "captured",
  "matched",
  "scored",
  "approved",
  "held",
  "escalated",
] as const;

export type InvoiceStatus = (typeof invoiceStatuses)[number];

// IDs are app-generated (UUID for invoices, semantic string for suppliers),
// not DB-generated — kept as text, not serial, on both Postgres and the prior
// SQLite schema.
export const suppliers = pgTable("suppliers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  riskScore: integer("risk_score").notNull(),
  riskLabel: text("risk_label").notNull(),
  basis: text("basis").notNull(),
  onTimeRate: text("on_time_rate").notNull(),
  disputeFrequency: text("dispute_frequency").notNull(),
  priceVariance: text("price_variance").notNull(),
});

export const invoices = pgTable("invoices", {
  id: text("id").primaryKey(),
  supplierId: text("supplier_id").notNull(),
  poNumber: text("po_number"),
  invoiceNumber: text("invoice_number"),
  status: text("status", { enum: invoiceStatuses }).notNull().default("pending"),
  decision: text("decision"),
  extracted: jsonb("extracted").$type<ExtractedFields>(),
  matchResult: jsonb("match_result").$type<MatchRow[]>(),
  riskResult: jsonb("risk_result").$type<RiskResult>(),
  createdAt: timestamp("created_at").notNull(),
});

export type Supplier = typeof suppliers.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;

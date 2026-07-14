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

// ---------------------------------------------------------------------------
// Inventory Agent — real stock levels + reorder-point tracking, feeding the
// same "Cikarang warehouse below reorder point" narrative the Dashboard's
// illustrative S3 step describes, but backed by an actual table.
// ---------------------------------------------------------------------------

export const inventoryItems = pgTable("inventory_items", {
  id: text("id").primaryKey(),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  warehouse: text("warehouse").notNull(),
  unit: text("unit").notNull(),
  quantityOnHand: integer("quantity_on_hand").notNull(),
  reorderPoint: integer("reorder_point").notNull(),
  targetStock: integer("target_stock").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const stockMovementReasons = ["received", "consumed", "adjustment"] as const;
export type StockMovementReason = (typeof stockMovementReasons)[number];

export const stockMovements = pgTable("stock_movements", {
  id: text("id").primaryKey(),
  itemId: text("item_id").notNull(),
  quantityDelta: integer("quantity_delta").notNull(),
  reason: text("reason", { enum: stockMovementReasons }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull(),
});

export type InventoryItem = typeof inventoryItems.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;

// ---------------------------------------------------------------------------
// Finance Agent — real CAPEX budgets per department/period, and spend
// requests that check against them (the Dashboard's illustrative S4 step:
// "Q1 CAPEX 62% utilized. IDR→MYR hedge recommended above ₨120M.").
// ---------------------------------------------------------------------------

export const budgets = pgTable("budgets", {
  id: text("id").primaryKey(),
  department: text("department").notNull(),
  period: text("period").notNull(),
  currency: text("currency").notNull(),
  capexLimit: integer("capex_limit").notNull(),
  utilized: integer("utilized").notNull(),
  hedgeThreshold: integer("hedge_threshold").notNull(),
});

export const spendRequestStatuses = ["approved", "hedge_recommended", "over_threshold"] as const;
export type SpendRequestStatus = (typeof spendRequestStatuses)[number];

export const spendRequests = pgTable("spend_requests", {
  id: text("id").primaryKey(),
  budgetId: text("budget_id").notNull(),
  description: text("description").notNull(),
  amount: integer("amount").notNull(),
  status: text("status", { enum: spendRequestStatuses }).notNull(),
  reasoning: text("reasoning").notNull(),
  createdAt: timestamp("created_at").notNull(),
});

export type Budget = typeof budgets.$inferSelect;
export type SpendRequest = typeof spendRequests.$inferSelect;

// ---------------------------------------------------------------------------
// Legal Agent — real contract records + a compliance-check pipeline (the
// Dashboard's illustrative S5 step: "MSA v3.2 will be applied. ASEAN
// cross-border clause pre-checked.").
// ---------------------------------------------------------------------------

export const contractStatuses = ["active", "expired", "draft"] as const;
export type ContractStatus = (typeof contractStatuses)[number];

export const contracts = pgTable("contracts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  counterparty: text("counterparty").notNull(),
  region: text("region").notNull(),
  status: text("status", { enum: contractStatuses }).notNull(),
  clauses: jsonb("clauses").$type<string[]>().notNull(),
  effectiveDate: text("effective_date").notNull(),
  expiryDate: text("expiry_date").notNull(),
});

export const complianceVerdicts = ["pass", "flag"] as const;
export type ComplianceVerdict = (typeof complianceVerdicts)[number];

export interface ComplianceCheckResult {
  verdict: ComplianceVerdict;
  reasoning: string;
  matchedClauses: string[];
  missingClauses: string[];
}

export const complianceChecks = pgTable("compliance_checks", {
  id: text("id").primaryKey(),
  contractId: text("contract_id").notNull(),
  subject: text("subject").notNull(),
  region: text("region").notNull(),
  result: jsonb("result").$type<ComplianceCheckResult>().notNull(),
  createdAt: timestamp("created_at").notNull(),
});

export type Contract = typeof contracts.$inferSelect;
export type ComplianceCheck = typeof complianceChecks.$inferSelect;

// ---------------------------------------------------------------------------
// Sales Agent — a real (if minimal) deal pipeline. Not part of the 7-step
// procurement narrative, so this is designed fresh: deterministic
// win-probability scoring, not a mock number.
// ---------------------------------------------------------------------------

export const dealStages = ["lead", "qualified", "proposal", "won", "lost"] as const;
export type DealStage = (typeof dealStages)[number];

export const deals = pgTable("deals", {
  id: text("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  region: text("region").notNull(),
  valueAmount: integer("value_amount").notNull(),
  currency: text("currency").notNull(),
  stage: text("stage", { enum: dealStages }).notNull(),
  winProbability: integer("win_probability").notNull(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export type Deal = typeof deals.$inferSelect;

// ---------------------------------------------------------------------------
// HR Agent — headcount/onboarding requests with a real policy check
// (headcount cap per department), decided the same way Risk Agent decisions
// are recorded for invoices.
// ---------------------------------------------------------------------------

export const hrRequestTypes = ["headcount", "onboarding"] as const;
export type HrRequestType = (typeof hrRequestTypes)[number];

export const hrRequestStatuses = ["pending", "approved", "rejected"] as const;
export type HrRequestStatus = (typeof hrRequestStatuses)[number];

export const hrRequests = pgTable("hr_requests", {
  id: text("id").primaryKey(),
  type: text("type", { enum: hrRequestTypes }).notNull(),
  department: text("department").notNull(),
  roleOrName: text("role_or_name").notNull(),
  justification: text("justification").notNull(),
  status: text("status", { enum: hrRequestStatuses }).notNull(),
  policyNote: text("policy_note"),
  createdAt: timestamp("created_at").notNull(),
});

export type HrRequest = typeof hrRequests.$inferSelect;

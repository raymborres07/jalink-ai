import { db } from "./client.server";
import { budgets, contracts, deals, hrRequests, inventoryItems, suppliers } from "./schema";

async function seed(): Promise<void> {
  await db
    .insert(suppliers)
    .values([
      {
        id: "established",
        name: "Sinar Logam Sdn Bhd",
        riskScore: 22,
        riskLabel: "low risk",
        basis: "Based on 34 past orders",
        onTimeRate: "88%",
        disputeFrequency: "1 / 34 orders",
        priceVariance: "0.4%",
      },
      {
        id: "new",
        name: "Baru Jaya Metalworks",
        riskScore: 45,
        riskLabel: "moderate — unproven",
        basis: "No transaction history — category benchmark only",
        onTimeRate: "—",
        disputeFrequency: "0 / 0 orders",
        priceVariance: "—",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(inventoryItems)
    .values([
      {
        id: "steel-rod-grade-a",
        sku: "SRA-500",
        name: "Steel Rod Grade A",
        warehouse: "Cikarang WH",
        unit: "pcs",
        quantityOnHand: 18,
        reorderPoint: 60,
        targetStock: 240,
        updatedAt: new Date(),
      },
      {
        id: "galvanized-sheet",
        sku: "GVS-120",
        name: "Galvanized Steel Sheet",
        warehouse: "Cikarang WH",
        unit: "sheets",
        quantityOnHand: 340,
        reorderPoint: 150,
        targetStock: 500,
        updatedAt: new Date(),
      },
      {
        id: "copper-wire-coil",
        sku: "CWC-210",
        name: "Copper Wire Coil",
        warehouse: "Cikarang WH",
        unit: "coils",
        quantityOnHand: 42,
        reorderPoint: 40,
        targetStock: 120,
        updatedAt: new Date(),
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(budgets)
    .values([
      {
        id: "procurement-2026-q1",
        department: "Procurement",
        period: "2026-Q1",
        currency: "IDR",
        capexLimit: 200_000_000,
        utilized: 124_000_000,
        hedgeThreshold: 120_000_000,
      },
      {
        id: "finance-2026-q1",
        department: "Finance",
        period: "2026-Q1",
        currency: "IDR",
        capexLimit: 60_000_000,
        utilized: 11_000_000,
        hedgeThreshold: 40_000_000,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(contracts)
    .values([
      {
        id: "msa-sinar-logam-v3-2",
        name: "Master Services Agreement",
        version: "v3.2",
        counterparty: "Sinar Logam Sdn Bhd",
        region: "ASEAN cross-border",
        status: "active",
        clauses: [
          "ASEAN cross-border data transfer clause",
          "Force majeure",
          "Late delivery penalty ≤5%",
          "Cross-border tax withholding",
        ],
        effectiveDate: "2024-01-15",
        expiryDate: "2027-01-14",
      },
      {
        id: "msa-baru-jaya-v1-0",
        name: "Master Services Agreement",
        version: "v1.0",
        counterparty: "Baru Jaya Metalworks",
        region: "Domestic (Indonesia)",
        status: "draft",
        clauses: ["Force majeure", "Late delivery penalty ≤5%"],
        effectiveDate: "2026-02-01",
        expiryDate: "2027-01-31",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(deals)
    .values([
      {
        id: "deal-mahakam-expansion",
        customerName: "PT Mahakam Manufaktur",
        region: "Indonesia",
        valueAmount: 480_000_000,
        currency: "IDR",
        stage: "proposal",
        winProbability: 62,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        id: "deal-sinar-logam-upsell",
        customerName: "Sinar Logam Sdn Bhd",
        region: "Malaysia",
        valueAmount: 95_000_000,
        currency: "IDR",
        stage: "qualified",
        winProbability: 41,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(hrRequests)
    .values([
      {
        id: "hr-req-procurement-analyst",
        type: "headcount",
        department: "Procurement",
        roleOrName: "Procurement Analyst",
        justification:
          "New supplier onboarding volume up 40% QoQ, current team of 2 can't keep up.",
        status: "pending",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        id: "hr-req-onboard-nadia",
        type: "onboarding",
        department: "Procurement",
        roleOrName: "Nadia Rahman",
        justification: "Confirmed start date 2026-07-20, needs SAP MM + Teams access provisioned.",
        status: "approved",
        policyNote: "Standard onboarding checklist — no exceptions needed.",
        createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      },
    ])
    .onConflictDoNothing();

  console.log("Seeded demo data.");
}

seed()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });

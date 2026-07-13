import { db } from "./client.server";
import { suppliers } from "./schema";

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

  console.log("Seeded demo suppliers.");
}

seed()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });

import { createServerFn } from "@tanstack/react-start";
import { db } from "../server/db/client.server";
import {
  budgets,
  complianceChecks,
  deals,
  dealStages,
  inventoryItems,
  type DealStage,
} from "../server/db/schema";

export interface DepartmentBudget {
  department: string;
  utilizationPct: number;
  currency: string;
}

export interface StageValue {
  stage: DealStage;
  totalValue: number;
  count: number;
}

export interface AnalyticsData {
  budgetUtilization: DepartmentBudget[];
  pipelineByStage: StageValue[];
  totalPipelineValue: number;
  dealWinRatePct: number | null;
  inventoryAlertCount: number;
  compliancePass: number;
  complianceFlag: number;
}

// Real cross-department metrics — no new table, this reads the same rows
// the department pages already write, aggregated for a single overview.
export const getAnalytics = createServerFn({ method: "GET" }).handler(
  async (): Promise<AnalyticsData> => {
    const [allBudgets, allDeals, allInventoryItems, allComplianceChecks] = await Promise.all([
      db.select().from(budgets),
      db.select().from(deals),
      db.select().from(inventoryItems),
      db.select().from(complianceChecks),
    ]);

    const budgetUtilization: DepartmentBudget[] = allBudgets.map((b) => ({
      department: b.department,
      utilizationPct: Math.round((b.utilized / b.capexLimit) * 100),
      currency: b.currency,
    }));

    const pipelineByStage: StageValue[] = dealStages.map((stage) => {
      const inStage = allDeals.filter((d) => d.stage === stage);
      return {
        stage,
        totalValue: inStage.reduce((sum, d) => sum + d.valueAmount, 0),
        count: inStage.length,
      };
    });

    const totalPipelineValue = allDeals
      .filter((d) => d.stage !== "lost")
      .reduce((sum, d) => sum + d.valueAmount, 0);

    const won = allDeals.filter((d) => d.stage === "won").length;
    const lost = allDeals.filter((d) => d.stage === "lost").length;
    const decided = won + lost;
    const dealWinRatePct = decided === 0 ? null : Math.round((won / decided) * 100);

    const inventoryAlertCount = allInventoryItems.filter(
      (i) => i.quantityOnHand <= i.reorderPoint,
    ).length;

    const compliancePass = allComplianceChecks.filter((c) => c.result.verdict === "pass").length;
    const complianceFlag = allComplianceChecks.filter((c) => c.result.verdict === "flag").length;

    return {
      budgetUtilization,
      pipelineByStage,
      totalPipelineValue,
      dealWinRatePct,
      inventoryAlertCount,
      compliancePass,
      complianceFlag,
    };
  },
);

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getAnalytics, type AnalyticsData } from "@/agents/analytics";
import { ErrorBanner, PageHeader, SectionCard } from "./shared";
import { LineChart as LineChartIcon } from "lucide-react";

// Same categorical hues already assigned to these departments in
// Dashboard.tsx's `agents` array (hex-equivalent of the oklch tokens) —
// identity stays consistent across the app rather than picking a new
// palette for this one page.
const DEPARTMENT_COLOR: Record<string, string> = {
  Procurement: "#e43157",
  Finance: "#ffa226",
  Inventory: "#349d62",
  Legal: "#396fc8",
  Sales: "#eb7a52",
  HR: "#00747a",
};

const SUCCESS_COLOR = "#1f9d63";
const ROSE_COLOR = "#e43157";

function formatIdr(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(0)}M`;
  return amount.toLocaleString();
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <SectionCard className="p-4 text-center">
      <div className="font-mono text-2xl font-semibold">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </SectionCard>
  );
}

export function AnalyticsDemo() {
  const fetchAnalytics = useServerFn(getAnalytics);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics()
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [fetchAnalytics]);

  const complianceTotal = data ? data.compliancePass + data.complianceFlag : 0;
  const compliancePassPct =
    data === null || complianceTotal === 0
      ? null
      : Math.round((data.compliancePass / complianceTotal) * 100);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHeader agentName="Analytics Agent" tag="business ROI" />
      <div className="mx-auto max-w-[1100px] px-6 py-10">
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-8">
          <div className="grid-paper absolute inset-0 opacity-60" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <LineChartIcon className="h-3.5 w-3.5 text-rose" /> Real cross-department metrics
            </div>
            <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-tight">
              Business <em className="text-rose">ROI</em>, computed live
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Every number and bar below is computed from the same rows the department pages write
              to — nothing here is a static mock.
            </p>
          </div>
        </section>

        {error && (
          <div className="mt-6">
            <ErrorBanner message={error} />
          </div>
        )}

        {data && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label="Pipeline value (IDR)" value={formatIdr(data.totalPipelineValue)} />
              <StatTile
                label="Deal win rate"
                value={data.dealWinRatePct === null ? "—" : `${data.dealWinRatePct}%`}
              />
              <StatTile label="Inventory alerts" value={String(data.inventoryAlertCount)} />
              <StatTile
                label="Compliance pass rate"
                value={compliancePassPct === null ? "—" : `${compliancePassPct}%`}
              />
            </div>

            <SectionCard className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider">
                Budget utilization by department
              </h3>
              <div className="mt-4 h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.budgetUtilization}
                    layout="vertical"
                    margin={{ left: 8, right: 24 }}
                  >
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis
                      type="category"
                      dataKey="department"
                      width={90}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value}%`, "Utilization"]}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar
                      dataKey="utilizationPct"
                      radius={4}
                      barSize={14}
                      label={{ position: "right", fontSize: 11, formatter: (v: number) => `${v}%` }}
                    >
                      {data.budgetUtilization.map((entry) => (
                        <Cell
                          key={entry.department}
                          fill={DEPARTMENT_COLOR[entry.department] ?? "#8a8a86"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {data.budgetUtilization.length === 0 && (
                <p className="text-sm text-muted-foreground">No budgets configured yet.</p>
              )}
            </SectionCard>

            <SectionCard className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider">
                Deal pipeline value by stage
              </h3>
              <div className="mt-4 h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.pipelineByStage} margin={{ top: 16 }}>
                    <XAxis
                      dataKey="stage"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    />
                    <YAxis hide />
                    <Tooltip
                      formatter={(value: number, _name, item) => [
                        `IDR ${formatIdr(value)} · ${item.payload.count} deal(s)`,
                        "Value",
                      ]}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar
                      dataKey="totalValue"
                      fill={ROSE_COLOR}
                      radius={4}
                      barSize={32}
                      label={{
                        position: "top",
                        fontSize: 11,
                        formatter: (v: number) => (v > 0 ? formatIdr(v) : ""),
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard className="mt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider">
                  Compliance checks
                </h3>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: SUCCESS_COLOR }}
                    />
                    pass ({data.compliancePass})
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: ROSE_COLOR }}
                    />
                    flag ({data.complianceFlag})
                  </span>
                </div>
              </div>
              {complianceTotal === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No compliance checks run yet.</p>
              ) : (
                <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full"
                    style={{
                      width: `${(data.compliancePass / complianceTotal) * 100}%`,
                      backgroundColor: SUCCESS_COLOR,
                    }}
                  />
                  <div
                    className="h-full"
                    style={{
                      width: `${(data.complianceFlag / complianceTotal) * 100}%`,
                      backgroundColor: ROSE_COLOR,
                    }}
                  />
                </div>
              )}
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
}

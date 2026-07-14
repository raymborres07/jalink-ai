import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardStats, type DashboardStats, type DepartmentTaskCounts } from "@/agents/stats";
import { ErrorBanner, PageHeader, SectionCard } from "./shared";
import { Bot, ChevronRight } from "lucide-react";

const AGENTS: {
  name: string;
  key: keyof DepartmentTaskCounts;
  to: string;
  description: string;
  tone: string;
}[] = [
  {
    name: "Procurement",
    key: "procurement",
    to: "/procure-to-pay",
    description: "Capture → Match → Risk invoice reconciliation.",
    tone: "bg-[oklch(0.606_0.213_15)]",
  },
  {
    name: "Finance",
    key: "finance",
    to: "/finance",
    description: "CAPEX budgets and FX hedge threshold checks.",
    tone: "bg-[oklch(0.79_0.166_66)]",
  },
  {
    name: "Inventory",
    key: "inventory",
    to: "/inventory",
    description: "Stock levels and reorder-point tracking.",
    tone: "bg-[oklch(0.62_0.13_155)]",
  },
  {
    name: "Legal",
    key: "legal",
    to: "/legal",
    description: "Contract records and compliance checks.",
    tone: "bg-[oklch(0.55_0.15_260)]",
  },
  {
    name: "Sales",
    key: "sales",
    to: "/sales",
    description: "Deal pipeline with deterministic win probability.",
    tone: "bg-[oklch(0.7_0.15_40)]",
  },
  {
    name: "HR",
    key: "hr",
    to: "/hr",
    description: "Headcount and onboarding requests.",
    tone: "bg-[oklch(0.5_0.1_200)]",
  },
];

export function AgentsOverviewDemo() {
  const fetchStats = useServerFn(getDashboardStats);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [fetchStats]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHeader agentName="Agent Library" tag="all agents" />
      <div className="mx-auto max-w-[1100px] px-6 py-10">
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-8">
          <div className="grid-paper absolute inset-0 opacity-60" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Bot className="h-3.5 w-3.5 text-rose" /> Six specialized agents
            </div>
            <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-tight">
              Every <em className="text-rose">agent</em>, one place
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Task counts below are real — the same numbers shown in the Orchestrator's Agent
              library card.
            </p>
          </div>
        </section>

        {error && (
          <div className="mt-6">
            <ErrorBanner message={error} />
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {AGENTS.map((agent) => {
            const tasks = stats ? stats.departmentTaskCounts[agent.key] : null;
            const load = tasks === null ? 0 : Math.min(95, 15 + tasks * 8);
            return (
              <Link key={agent.name} to={agent.to} className="block">
                <SectionCard className="p-5 transition hover:border-ink/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                      <span className="font-serif text-lg">{agent.name} Agent</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{agent.description}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-mono">{tasks === null ? "…" : `${tasks} tasks`}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={`h-full ${agent.tone}`} style={{ width: `${load}%` }} />
                  </div>
                </SectionCard>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

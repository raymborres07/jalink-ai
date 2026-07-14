import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardStats, type DashboardStats } from "@/agents/stats";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bell,
  Bot,
  Boxes,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Command,
  FileText,
  Filter,
  GitBranch,
  Layers,
  LineChart,
  Loader2,
  Network,
  Play,
  Plug,
  Scale,
  Search,
  Settings,
  Shield,
  Sparkles,
  Users,
  Workflow,
  Zap,
} from "lucide-react";

type StepStatus = "done" | "active" | "pending" | "review";

type Step = {
  id: string;
  agent: string;
  role: string;
  status: StepStatus;
  confidence?: number;
  duration?: string;
  note: string;
  system?: string;
  icon: React.ComponentType<{ className?: string }>;
};

const steps: Step[] = [
  {
    id: "S1",
    agent: "Intake",
    role: "Request captured",
    status: "done",
    duration: "0.4s",
    note: "Parsed request from Nadia Rahman · PT Mahakam Manufaktur.",
    system: "Microsoft Teams",
    icon: Users,
  },
  {
    id: "S2",
    agent: "Procurement Agent",
    role: "Supplier selection",
    status: "done",
    confidence: 0.94,
    duration: "3.1s",
    note: "Selected Sinar Logam Sdn Bhd — 3-year track record, on-time 98%.",
    system: "SAP MM",
    icon: Boxes,
  },
  {
    id: "S3",
    agent: "Inventory Agent",
    role: "Stock verification",
    status: "done",
    confidence: 0.99,
    duration: "1.2s",
    note: "Cikarang warehouse below reorder point (18 → target 240).",
    system: "Oracle NetSuite",
    icon: Layers,
  },
  {
    id: "S4",
    agent: "Finance Agent",
    role: "Budget & FX check",
    status: "active",
    confidence: 0.87,
    duration: "…",
    note: "Q1 CAPEX 62% utilized. IDR→MYR hedge recommended above ₨120M.",
    system: "SAP FI",
    icon: CircleDollarSign,
  },
  {
    id: "S5",
    agent: "Legal Agent",
    role: "Contract & compliance",
    status: "pending",
    note: "MSA v3.2 will be applied. ASEAN cross-border clause pre-checked.",
    system: "Contract Vault",
    icon: Scale,
  },
  {
    id: "S6",
    agent: "Manager Approval",
    role: "Human decision required",
    status: "review",
    note: "Amount ₨ 148,200,000 exceeds L2 threshold. Route to Dir. Operations.",
    system: "Approval Chain",
    icon: Shield,
  },
  {
    id: "S7",
    agent: "ERP Sync",
    role: "PO issuance",
    status: "pending",
    note: "Will create PO #4500-8821 and notify supplier via EDI.",
    system: "SAP MM",
    icon: GitBranch,
  },
];

const agents = [
  {
    name: "Procurement",
    to: "/procure-to-pay",
    key: "procurement" as const,
    tone: "bg-[oklch(0.606_0.213_15)]",
  },
  { name: "Finance", to: "/finance", key: "finance" as const, tone: "bg-[oklch(0.79_0.166_66)]" },
  {
    name: "Inventory",
    to: "/inventory",
    key: "inventory" as const,
    tone: "bg-[oklch(0.62_0.13_155)]",
  },
  { name: "Legal", to: "/legal", key: "legal" as const, tone: "bg-[oklch(0.55_0.15_260)]" },
  { name: "Sales", to: "/sales", key: "sales" as const, tone: "bg-[oklch(0.7_0.15_40)]" },
  { name: "HR", to: "/hr", key: "hr" as const, tone: "bg-[oklch(0.5_0.1_200)]" },
];

const integrations = [
  "WhatsApp Business",
  "Xero",
  "QuickBooks",
  "Slack",
  "Teams",
  "Microsoft 365",
  "SAP S/4HANA",
  "Oracle NetSuite",
];

function StatusDot({ status }: { status: StepStatus }) {
  const map = {
    done: "bg-[var(--success)]",
    active: "bg-[var(--rose)] animate-pulse",
    pending: "bg-muted-foreground/30",
    review: "bg-[var(--amber)]",
  } as const;
  return <span className={`inline-block h-2 w-2 rounded-full ${map[status]}`} />;
}

function Chip({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "rose" | "amber" | "success" | "muted";
}) {
  const tones = {
    default: "bg-ink text-paper",
    rose: "bg-rose text-paper",
    amber: "bg-amber text-ink",
    success: "bg-[var(--success)] text-paper",
    muted: "bg-muted text-muted-foreground border border-border",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function formatTimeAgo(epochMs: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - epochMs) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

function activityTag(
  status: string,
  decision: string | null,
): "human" | "policy" | "advisory" | "auto" {
  if (decision) return "human";
  if (status === "scored") return "policy";
  if (status === "matched") return "advisory";
  return "auto";
}

function activityText(status: string, decision: string | null): string {
  if (decision) return `reconciliation ${decision}`;
  if (status === "scored") return "risk-scored, awaiting human decision";
  if (status === "matched") return "matched against PO — variance found";
  if (status === "captured") return "invoice captured, matching now";
  return "reconciliation started";
}

export function Dashboard() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const fetchStats = useServerFn(getDashboardStats);
  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, [fetchStats]);

  const active = useMemo(() => steps.find((s) => s.status === "active"), []);
  const liveAgents = useMemo(
    () =>
      agents.map((a) => {
        const tasks = stats ? stats.departmentTaskCounts[a.key] : 0;
        // Deterministic load bar from real task count — not a mock number,
        // but not a real "load" metric either until there's a concept of
        // agent capacity; scales visually so the bar isn't empty at 1 task.
        const load = Math.min(95, 15 + tasks * 8);
        return { ...a, tasks, load };
      }),
    [stats],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-6">
          <div className="flex items-center gap-2">
            <LogoMark />
            <span className="font-serif text-xl leading-none">JalinkAI</span>
            <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              v2.4 · sea-1
            </span>
          </div>
          <div className="mx-6 hidden h-6 w-px bg-border md:block" />
          <nav className="hidden items-center gap-1 text-sm md:flex">
            {["Orchestrator", "Workflows", "Agents", "Memory", "Governance", "Analytics"].map(
              (n, i) => (
                <button
                  key={n}
                  className={`rounded-md px-3 py-1.5 transition ${i === 0 ? "bg-ink text-paper" : "text-muted-foreground hover:bg-muted"}`}
                >
                  {n}
                </button>
              ),
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Ask the Orchestrator…  ⌘K"
                className="h-9 w-80 rounded-md border border-border bg-card pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ink"
              />
            </div>
            <button className="relative flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card hover:bg-muted">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose" />
            </button>
            <div className="flex items-center gap-2 rounded-md border border-border bg-card py-1 pl-1 pr-3">
              <div className="grid h-7 w-7 place-items-center rounded bg-ink text-[11px] font-semibold text-paper">
                NR
              </div>
              <div className="hidden text-left leading-tight md:block">
                <div className="text-xs font-medium">Nadia Rahman</div>
                <div className="text-[10px] text-muted-foreground">PT Mahakam · Jakarta</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] grid-cols-12 gap-6 px-6 py-6">
        {/* Left rail */}
        <aside className="col-span-12 lg:col-span-2">
          <SectionLabel>Workspace</SectionLabel>
          <div className="mt-2 space-y-0.5 text-sm">
            {[
              { icon: Command, label: "Orchestrator", active: true, badge: "7" },
              { icon: Workflow, label: "Workflows", badge: "34", to: "/procure-to-pay" },
              { icon: Bot, label: "Agents", badge: "12" },
              {
                icon: Shield,
                label: "Approvals",
                badge: stats ? String(stats.byStatus.scored) : "…",
              },
              { icon: FileText, label: "Enterprise Memory" },
              { icon: Plug, label: "Integrations" },
              { icon: LineChart, label: "Business ROI" },
              { icon: Settings, label: "Governance" },
            ].map((it) => {
              const className = `flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition ${
                it.active ? "bg-ink text-paper" : "hover:bg-muted"
              }`;
              const content = (
                <>
                  <it.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{it.label}</span>
                  {it.badge && (
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${it.active ? "bg-paper/20 text-paper" : "bg-muted text-muted-foreground"}`}
                    >
                      {it.badge}
                    </span>
                  )}
                </>
              );
              return it.to ? (
                <Link key={it.label} to={it.to} className={className}>
                  {content}
                </Link>
              ) : (
                <button key={it.label} className={className}>
                  {content}
                </button>
              );
            })}
          </div>

          <DepartmentSidebar />
        </aside>

        {/* Main column */}
        <main className="col-span-12 space-y-6 lg:col-span-7">
          {/* Hero row */}
          <section className="relative overflow-hidden rounded-2xl border border-border bg-card">
            <div className="grid-paper absolute inset-0 opacity-60" />
            <div className="relative grid grid-cols-1 gap-6 p-6 md:grid-cols-5">
              <div className="md:col-span-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-rose" />
                  Live workflow · updated {now.toLocaleTimeString()}
                </div>
                <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-tight md:text-5xl">
                  Procurement <em className="text-rose">Purchase Request</em> <br />
                  PR-2041 · Steel Coil Cold-Rolled
                </h1>
                <p className="mt-3 max-w-lg text-sm text-muted-foreground">
                  Six specialized agents are collaborating on this request. The Orchestrator will
                  route to a human only when policy thresholds require it.
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Chip tone="rose">
                    <Activity className="h-3 w-3" /> Running
                  </Chip>
                  <Chip tone="muted">
                    <Building2 className="h-3 w-3" /> PT Mahakam Manufaktur
                  </Chip>
                  <Chip tone="muted">
                    <Clock className="h-3 w-3" /> ETA 4m 12s
                  </Chip>
                  <Chip tone="amber">
                    <AlertCircle className="h-3 w-3" /> 1 human review
                  </Chip>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <button className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink/90">
                    <Play className="h-3.5 w-3.5" /> Resume orchestration
                  </button>
                  <InspectReasoningToggle />
                  <Link
                    to="/procure-to-pay"
                    className="inline-flex items-center gap-2 rounded-md border border-rose bg-rose/10 px-4 py-2 text-sm font-medium text-rose hover:bg-rose/20"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Open procure-to-pay demo
                  </Link>
                </div>
              </div>

              <div className="md:col-span-2">
                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Estimated business impact</span>
                    <Chip tone="success">
                      <Check className="h-3 w-3" /> validated
                    </Chip>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="font-serif text-4xl">₨ 148.2M</span>
                    <span className="text-xs text-muted-foreground">IDR · line total</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                    <Metric label="Time saved" value="82%" />
                    <Metric label="Manual steps" value="14 → 2" />
                    <Metric label="Confidence" value="0.91" />
                  </div>
                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-[58%] rounded-full bg-gradient-to-r from-rose to-amber" />
                  </div>
                  <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                    <span>4 of 7 steps complete</span>
                    <span className="font-mono">58%</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Workflow pipeline */}
          <section className="rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-rose" />
                <h2 className="text-sm font-semibold uppercase tracking-wider">
                  Agent orchestration
                </h2>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--success)]" /> done
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose" /> active
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber" /> review
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/30" /> pending
                </span>
              </div>
            </div>

            <ol className="relative divide-y divide-border">
              {steps.map((s, i) => {
                const Icon = s.icon;
                return (
                  <li key={s.id} className="grid grid-cols-12 items-center gap-4 px-6 py-4">
                    <div className="col-span-1 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                      <StatusDot status={s.status} />
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="col-span-4 flex items-center gap-3">
                      <div
                        className={`grid h-9 w-9 place-items-center rounded-md border border-border ${s.status === "active" ? "bg-rose text-paper" : s.status === "review" ? "bg-amber text-ink" : "bg-background text-foreground"}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{s.agent}</div>
                        <div className="text-xs text-muted-foreground">{s.role}</div>
                      </div>
                    </div>
                    <div className="col-span-5 text-sm text-muted-foreground">{s.note}</div>
                    <div className="col-span-2 flex items-center justify-end gap-2 text-right">
                      {s.confidence !== undefined && (
                        <span className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px]">
                          {s.confidence.toFixed(2)}
                        </span>
                      )}
                      {s.system && (
                        <span className="hidden rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground md:inline">
                          {s.system}
                        </span>
                      )}
                      {s.status === "active" && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-rose" />
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

            {/* Active reasoning panel */}
            {active && (
              <div className="border-t border-border bg-background/50 px-6 py-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <Zap className="h-3.5 w-3.5 text-rose" /> Reasoning · {active.agent}
                </div>
                <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <ReasonCard
                    title="Evidence"
                    body="Q1 CAPEX ledger, FX rate feed (Bloomberg), supplier quote #Q-8821, hedge policy §4.2."
                  />
                  <ReasonCard
                    title="Recommendation"
                    body="Approve at current rate; execute forward hedge for 60% of exposure via treasury desk."
                  />
                  <ReasonCard
                    title="Alternatives"
                    body="Split order across Q1/Q2 to stay under CAPEX threshold — adds 6 days lead time."
                  />
                </div>
              </div>
            )}
          </section>

          {/* Agent load + integrations */}
          <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider">Agent library</h3>
                <span className="text-xs text-muted-foreground">last 24h</span>
              </div>
              <div className="mt-4 space-y-3">
                {liveAgents.map((a) => (
                  <Link key={a.name} to={a.to} className="block rounded-md -m-1 p-1 hover:bg-muted">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                        {a.name} Agent
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {a.tasks} tasks
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className={`h-full ${a.tone}`} style={{ width: `${a.load}%` }} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider">
                  Enterprise connectors
                </h3>
                <button className="text-xs text-muted-foreground hover:text-foreground">
                  manage →
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {integrations.map((n) => (
                  <div
                    key={n}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <span className="grid h-6 w-6 place-items-center rounded bg-ink font-mono text-[10px] font-bold text-paper">
                      {n
                        .split(" ")
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <span className="truncate">{n}</span>
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                Native to the tools SMEs already run —{" "}
                <span className="font-medium text-foreground">WhatsApp, Xero, QuickBooks</span> —
                with SAP and Oracle connectors available for the rare customer who's already
                outgrown them.
              </div>
            </div>
          </section>
        </main>

        {/* Right rail */}
        <aside className="col-span-12 space-y-6 lg:col-span-3">
          {/* Approval card */}
          <ApprovalCard />

          {/* Activity */}
          <div className="rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <span className="text-sm font-semibold">Live activity</span>
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose" /> streaming
              </span>
            </div>
            {stats === null ? (
              <div className="space-y-2 p-5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-4 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : stats.recent.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-muted-foreground">
                No invoices reconciled yet.{" "}
                <Link to="/procure-to-pay" className="text-rose hover:underline">
                  Run the procure-to-pay demo
                </Link>{" "}
                to see activity here.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {stats.recent.map((inv) => {
                  const tag = activityTag(inv.status, inv.decision);
                  return (
                    <li key={inv.id} className="flex gap-3 px-5 py-3 text-sm">
                      <span className="w-8 shrink-0 pt-0.5 font-mono text-[11px] text-muted-foreground">
                        {formatTimeAgo(inv.createdAt)}
                      </span>
                      <div className="flex-1">
                        <div className="leading-snug">
                          <span className="font-medium">{inv.supplierName}</span>{" "}
                          <span className="text-muted-foreground">
                            {inv.poNumber ?? "invoice"} — {activityText(inv.status, inv.decision)}
                          </span>
                        </div>
                        <div className="mt-1">
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                              tag === "human"
                                ? "bg-amber/20 text-ink"
                                : tag === "policy"
                                  ? "bg-rose/15 text-rose"
                                  : tag === "advisory"
                                    ? "bg-muted text-muted-foreground"
                                    : "bg-[var(--success)]/15 text-[var(--success)]"
                            }`}
                          >
                            {tag}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Memory */}
          <div className="rounded-2xl border border-border bg-ink p-5 text-paper">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-paper/60">
              <FileText className="h-3.5 w-3.5" /> Enterprise memory
            </div>
            <div className="mt-2 font-serif text-2xl leading-tight">12,481 documents indexed</div>
            <p className="mt-2 text-xs text-paper/70">
              Policies, SOPs, contracts and past decisions shared across every agent — in Bahasa,
              English, Vietnamese & Thai.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {["ISO 27001", "SOC 2", "GDPR", "PDPA", "ASEAN DPF"].map((b) => (
                <span key={b} className="rounded border border-paper/20 px-2 py-0.5 text-[10px]">
                  {b}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-6 py-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <LogoMark small /> JalinkAI · The AI Workflow Orchestrator for ASEAN Enterprises
          </div>
          <div className="flex items-center gap-4">
            <span>Region: SEA-1 (Singapore)</span>
            <span>Latency 42ms</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" /> All systems normal
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground ${className}`}
    >
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-2 py-2">
      <div className="font-mono text-sm font-semibold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

const REASONING_LOG_LINES = [
  "[Match Agent] Validated PO-2041 against Delivery Note DN-7734 — quantities reconciled.",
  "[Risk Agent] Evaluated supplier history for Sinar Logam Sdn Bhd. Score: Low Risk (0.12).",
  "[Finance Agent] Checked Q1 CAPEX utilization (62%) against approval threshold.",
];

function InspectReasoningToggle() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm transition hover:bg-muted"
      >
        <Filter className="h-3.5 w-3.5" /> Inspect reasoning
      </button>
      <div
        className={`w-full overflow-hidden transition-all duration-300 ease-out ${
          isExpanded ? "mt-1 max-h-40 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="rounded-md border border-border bg-background p-3 font-mono text-xs leading-relaxed text-muted-foreground">
          {REASONING_LOG_LINES.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      </div>
    </>
  );
}

const DEPARTMENTS = [
  { name: "Procurement", to: "/procure-to-pay" as const },
  { name: "Finance", to: "/finance" as const },
  { name: "Supply Chain", to: "/inventory" as const },
  { name: "Legal", to: "/legal" as const },
  { name: "Sales", to: "/sales" as const },
  { name: "HR", to: "/hr" as const },
];

function DepartmentSidebar() {
  return (
    <>
      <SectionLabel className="mt-6">Departments</SectionLabel>
      <div className="mt-2 space-y-1 text-sm">
        {DEPARTMENTS.map((d) => (
          <Link
            key={d.name}
            to={d.to}
            className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <span className="flex items-center gap-1.5">{d.name}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ))}
      </div>
    </>
  );
}

function ApprovalCard() {
  const [isApproved, setIsApproved] = useState(false);

  return (
    <div
      className={`rounded-2xl border-2 bg-card transition-colors duration-300 ${
        isApproved ? "border-[var(--success)]" : "border-amber"
      }`}
    >
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        {isApproved ? (
          <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
        ) : (
          <Shield className="h-4 w-4 text-amber" />
        )}
        <span className="text-sm font-semibold">
          {isApproved ? "Approval recorded" : "Human approval required"}
        </span>
      </div>
      <div className="px-5 py-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Step 06 · Manager approval
        </div>
        <div className="mt-1 font-serif text-2xl leading-tight">
          {isApproved ? (
            "Approval recorded by Manager"
          ) : (
            <>
              Approve PO
              <br />₨ 148.2M
            </>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {isApproved
            ? "Orchestrator will proceed to ERP sync and notify the supplier via EDI."
            : "Exceeds L2 threshold (₨ 100M). Orchestrator recommends approval with 0.91 confidence."}
        </p>

        <div className="mt-4 space-y-2 rounded-md bg-background p-3 text-xs">
          <Row k="Supplier" v="Sinar Logam Sdn Bhd" />
          <Row k="Delivery" v="Cikarang WH · 14 days" />
          <Row k="Policy match" v="MSA v3.2 · ASEAN" />
          <Row k="Risk score" v="Low (0.12)" />
        </div>

        <div
          className={`grid transition-all duration-300 ease-out ${
            isApproved ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="flex items-center gap-2 overflow-hidden rounded-md bg-[var(--success)]/10 px-3 py-2.5 text-sm text-[var(--success)]">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Logged to the audit trail · ERP sync queued
          </div>
        </div>

        {!isApproved && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setIsApproved(true)}
              className="rounded-md bg-ink py-2 text-sm font-medium text-paper transition hover:bg-ink/90"
            >
              Approve
            </button>
            <button className="rounded-md border border-border bg-background py-2 text-sm transition hover:bg-muted">
              Return
            </button>
          </div>
        )}
        <button className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          View full reasoning trace <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function ReasonCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <p className="mt-1 text-sm leading-snug">{body}</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

function LogoMark({ small = false }: { small?: boolean }) {
  const s = small ? "h-5 w-5" : "h-7 w-7";
  return (
    <div className={`${s} relative grid place-items-center rounded-md bg-ink text-paper`}>
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="2.2" fill="currentColor" />
        <circle cx="4" cy="6" r="1.6" fill="currentColor" />
        <circle cx="4" cy="18" r="1.6" fill="currentColor" />
        <circle cx="20" cy="6" r="1.6" fill="currentColor" />
        <circle cx="20" cy="18" r="1.6" fill="currentColor" />
        <path d="M5.2 6.6L10.5 11M5.2 17.4L10.5 13M18.8 6.6L13.5 11M18.8 17.4L13.5 13" />
      </svg>
      <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-rose" />
    </div>
  );
}

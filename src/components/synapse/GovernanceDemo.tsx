import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getGovernanceLog, type GovernanceLog, type GovernanceOutcome } from "@/agents/governance";
import { EmptyState, ErrorBanner, PageHeader, Pill, SectionCard, type Tone } from "./shared";
import { Loader2, ShieldCheck } from "lucide-react";

const OUTCOME_TONE: Record<GovernanceOutcome, Tone> = {
  pass: "success",
  flag: "rose",
  info: "muted",
};

function formatTimeAgo(epochMs: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - epochMs) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function GovernanceDemo() {
  const fetchLog = useServerFn(getGovernanceLog);
  const [log, setLog] = useState<GovernanceLog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function load() {
    setLoading(true);
    fetchLog()
      .then(setLog)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [fetchLog]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHeader agentName="Governance Agent" tag="audit trail" />
      <div className="mx-auto max-w-[1100px] px-6 py-10">
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-8">
          <div className="grid-paper absolute inset-0 opacity-60" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-rose" /> Real audit trail · aggregated across
              every department
            </div>
            <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-tight">
              Every <em className="text-rose">decision</em>, in one trail
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Not a separate log — every event here is read live from the same rows Procurement,
              Finance, Legal, Sales, and HR already wrote when a human made a call.
            </p>
          </div>
        </section>

        {log && (
          <div className="mt-6 grid grid-cols-3 gap-3">
            <SectionCard className="p-4 text-center">
              <div className="font-mono text-2xl font-semibold">{log.summary.totalEvents}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Total events
              </div>
            </SectionCard>
            <SectionCard className="p-4 text-center">
              <div className="font-mono text-2xl font-semibold text-rose">
                {log.summary.flaggedEvents}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Flagged
              </div>
            </SectionCard>
            <SectionCard className="p-4 text-center">
              <div className="font-mono text-2xl font-semibold">{log.summary.passRate}%</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Pass rate
              </div>
            </SectionCard>
          </div>
        )}

        {error && (
          <div className="mt-6">
            <ErrorBanner message={error} />
          </div>
        )}

        <SectionCard className="mt-6 p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <span className="text-sm font-semibold">Audit trail</span>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {loading && <Loader2 className="h-3 w-3 animate-spin" />}
              Refresh
            </button>
          </div>
          {log === null ? (
            <div className="space-y-2 p-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-4 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : log.events.length === 0 ? (
            <div className="p-5">
              <EmptyState>
                No decisions recorded yet — run one of the department demos and come back.
              </EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {log.events.map((event) => (
                <li key={event.id} className="flex gap-3 px-5 py-3 text-sm">
                  <span className="w-16 shrink-0 pt-0.5 font-mono text-[11px] text-muted-foreground">
                    {formatTimeAgo(event.createdAt)}
                  </span>
                  <div className="flex-1">
                    <div className="leading-snug">{event.summary}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {event.department}
                      </span>
                      <Pill tone={OUTCOME_TONE[event.outcome]}>{event.outcome}</Pill>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

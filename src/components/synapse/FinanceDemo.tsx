import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getBudgets, submitSpendRequest, type BudgetWithUtilization } from "@/agents/finance";
import type { SpendRequestStatus } from "@/server/db/schema";
import { EmptyState, ErrorBanner, PageHeader, Pill, SectionCard, type Tone } from "./shared";
import { CircleDollarSign, Loader2 } from "lucide-react";

const STATUS_TONE: Record<SpendRequestStatus, Tone> = {
  approved: "success",
  hedge_recommended: "amber",
  over_threshold: "rose",
};

const STATUS_LABEL: Record<SpendRequestStatus, string> = {
  approved: "Approved",
  hedge_recommended: "Hedge recommended",
  over_threshold: "Over threshold",
};

interface DraftRequest {
  description: string;
  amount: string;
}

interface LastResult {
  status: SpendRequestStatus;
  reasoning: string;
}

export function FinanceDemo() {
  const fetchBudgets = useServerFn(getBudgets);
  const submitFn = useServerFn(submitSpendRequest);

  const [budgets, setBudgets] = useState<BudgetWithUtilization[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyBudgetId, setBusyBudgetId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftRequest>>({});
  const [lastResults, setLastResults] = useState<Record<string, LastResult>>({});

  useEffect(() => {
    fetchBudgets()
      .then(setBudgets)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [fetchBudgets]);

  function draftFor(budgetId: string): DraftRequest {
    return drafts[budgetId] ?? { description: "", amount: "" };
  }

  async function handleSubmit(budgetId: string) {
    const draft = draftFor(budgetId);
    const amount = Number.parseInt(draft.amount, 10);
    if (!draft.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Enter a description and a positive amount.");
      return;
    }
    setBusyBudgetId(budgetId);
    setError(null);
    try {
      const result = await submitFn({
        data: { budgetId, description: draft.description, amount },
      });
      setBudgets((prev) => prev?.map((b) => (b.id === budgetId ? result.budget : b)) ?? null);
      setLastResults((prev) => ({
        ...prev,
        [budgetId]: { status: result.status, reasoning: result.reasoning },
      }));
      setDrafts((prev) => ({ ...prev, [budgetId]: { description: "", amount: "" } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit spend request");
    } finally {
      setBusyBudgetId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHeader agentName="Finance Agent" tag="budget & FX check" />
      <div className="mx-auto max-w-[1100px] px-6 py-10">
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-8">
          <div className="grid-paper absolute inset-0 opacity-60" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CircleDollarSign className="h-3.5 w-3.5 text-rose" /> Real CAPEX budgets ·
              Postgres-backed
            </div>
            <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-tight">
              Budget &amp; <em className="text-rose">FX threshold</em> checks
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Submitting a spend request runs a real deterministic check against each
              department&apos;s CAPEX limit and hedge threshold, then writes the result back to the
              budget.
            </p>
          </div>
        </section>

        {error && (
          <div className="mt-6">
            <ErrorBanner message={error} />
          </div>
        )}

        <div className="mt-6 space-y-4">
          {budgets === null ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : budgets.length === 0 ? (
            <EmptyState>No budgets configured yet.</EmptyState>
          ) : (
            budgets.map((budget) => {
              const draft = draftFor(budget.id);
              const lastResult = lastResults[budget.id];
              return (
                <SectionCard key={budget.id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-serif text-xl">{budget.department}</div>
                      <div className="text-xs text-muted-foreground">{budget.period}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-lg font-semibold">
                        {budget.utilizationPct}%
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {budget.currency} {budget.utilized.toLocaleString()} /{" "}
                        {budget.capexLimit.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-rose to-amber"
                      style={{ width: `${Math.min(100, budget.utilizationPct)}%` }}
                    />
                  </div>

                  {lastResult && (
                    <div className="mt-4 rounded-md border border-border bg-background p-3 text-xs">
                      <Pill tone={STATUS_TONE[lastResult.status]}>
                        {STATUS_LABEL[lastResult.status]}
                      </Pill>
                      <p className="mt-2 text-muted-foreground">{lastResult.reasoning}</p>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-end gap-2">
                    <div className="min-w-[180px] flex-1">
                      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Description
                      </label>
                      <input
                        type="text"
                        value={draft.description}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [budget.id]: { ...draft, description: e.target.value },
                          }))
                        }
                        placeholder="e.g. Steel coil PO-4501"
                        className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-ink"
                      />
                    </div>
                    <div className="w-40">
                      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Amount ({budget.currency})
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={draft.amount}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [budget.id]: { ...draft, amount: e.target.value },
                          }))
                        }
                        placeholder="0"
                        className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-ink"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={busyBudgetId === budget.id}
                      onClick={() => handleSubmit(budget.id)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md bg-ink px-4 text-sm font-medium text-paper hover:bg-ink/90 disabled:opacity-50"
                    >
                      {busyBudgetId === budget.id && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      )}
                      Check &amp; submit
                    </button>
                  </div>
                </SectionCard>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

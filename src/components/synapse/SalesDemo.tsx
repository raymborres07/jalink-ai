import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { advanceDealStage, createDeal, getDeals } from "@/agents/sales";
import type { Deal, DealStage } from "@/server/db/schema";
import { EmptyState, ErrorBanner, PageHeader, Pill, SectionCard, type Tone } from "./shared";
import { Loader2, TrendingUp } from "lucide-react";

const STAGE_TONE: Record<DealStage, Tone> = {
  lead: "muted",
  qualified: "amber",
  proposal: "rose",
  won: "success",
  lost: "muted",
};

const NEXT_STAGE: Record<DealStage, DealStage | null> = {
  lead: "qualified",
  qualified: "proposal",
  proposal: "won",
  won: null,
  lost: null,
};

interface NewDealDraft {
  customerName: string;
  region: string;
  valueAmount: string;
  currency: string;
}

const EMPTY_DRAFT: NewDealDraft = {
  customerName: "",
  region: "",
  valueAmount: "",
  currency: "IDR",
};

export function SalesDemo() {
  const fetchDeals = useServerFn(getDeals);
  const createFn = useServerFn(createDeal);
  const advanceFn = useServerFn(advanceDealStage);

  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyDealId, setBusyDealId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<NewDealDraft>(EMPTY_DRAFT);

  useEffect(() => {
    fetchDeals()
      .then(setDeals)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [fetchDeals]);

  async function handleCreate() {
    const valueAmount = Number.parseInt(draft.valueAmount, 10);
    if (
      !draft.customerName.trim() ||
      !draft.region.trim() ||
      !Number.isFinite(valueAmount) ||
      valueAmount <= 0
    ) {
      setError("Fill in customer, region, and a positive deal value.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const deal = await createFn({
        data: {
          customerName: draft.customerName,
          region: draft.region,
          valueAmount,
          currency: draft.currency,
        },
      });
      setDeals((prev) => [deal, ...(prev ?? [])]);
      setDraft(EMPTY_DRAFT);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create deal");
    } finally {
      setCreating(false);
    }
  }

  async function handleAdvance(dealId: string, stage: DealStage) {
    setBusyDealId(dealId);
    setError(null);
    try {
      const updated = await advanceFn({ data: { dealId, stage } });
      setDeals((prev) => prev?.map((d) => (d.id === dealId ? updated : d)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to advance deal");
    } finally {
      setBusyDealId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHeader agentName="Sales Agent" tag="deal pipeline" />
      <div className="mx-auto max-w-[1100px] px-6 py-10">
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-8">
          <div className="grid-paper absolute inset-0 opacity-60" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-rose" /> Real deal pipeline · Postgres-backed
            </div>
            <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-tight">
              Deal <em className="text-rose">pipeline</em> &amp; win probability
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Win probability is computed deterministically from stage and deal size — not a guess —
              and recalculates every time a deal moves.
            </p>
          </div>
        </section>

        <SectionCard className="mt-6">
          <div className="font-serif text-lg">New deal</div>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
            <input
              type="text"
              value={draft.customerName}
              onChange={(e) => setDraft((prev) => ({ ...prev, customerName: e.target.value }))}
              placeholder="Customer"
              className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-ink"
            />
            <input
              type="text"
              value={draft.region}
              onChange={(e) => setDraft((prev) => ({ ...prev, region: e.target.value }))}
              placeholder="Region"
              className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-ink"
            />
            <input
              type="number"
              min={1}
              value={draft.valueAmount}
              onChange={(e) => setDraft((prev) => ({ ...prev, valueAmount: e.target.value }))}
              placeholder="Value (IDR)"
              className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-ink"
            />
            <button
              type="button"
              disabled={creating}
              onClick={handleCreate}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-ink text-sm font-medium text-paper hover:bg-ink/90 disabled:opacity-50"
            >
              {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Add deal
            </button>
          </div>
        </SectionCard>

        {error && (
          <div className="mt-6">
            <ErrorBanner message={error} />
          </div>
        )}

        <div className="mt-6 space-y-3">
          {deals === null ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : deals.length === 0 ? (
            <EmptyState>No deals in the pipeline yet.</EmptyState>
          ) : (
            deals.map((deal) => {
              const next = NEXT_STAGE[deal.stage];
              return (
                <SectionCard key={deal.id} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-serif text-lg">{deal.customerName}</span>
                        <Pill tone={STAGE_TONE[deal.stage]}>{deal.stage}</Pill>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{deal.region}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-lg font-semibold">
                        {deal.currency} {deal.valueAmount.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {deal.winProbability}% win probability
                      </div>
                    </div>
                  </div>
                  {(next || deal.stage !== "lost") && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {next && (
                        <button
                          type="button"
                          disabled={busyDealId === deal.id}
                          onClick={() => handleAdvance(deal.id, next)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-paper hover:bg-ink/90 disabled:opacity-50"
                        >
                          {busyDealId === deal.id && <Loader2 className="h-3 w-3 animate-spin" />}
                          Advance to {next}
                        </button>
                      )}
                      {deal.stage !== "won" && deal.stage !== "lost" && (
                        <button
                          type="button"
                          disabled={busyDealId === deal.id}
                          onClick={() => handleAdvance(deal.id, "lost")}
                          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
                        >
                          Mark lost
                        </button>
                      )}
                    </div>
                  )}
                </SectionCard>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

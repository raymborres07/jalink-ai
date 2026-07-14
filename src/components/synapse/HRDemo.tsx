import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { decideHrRequest, getHrRequests, submitHrRequest } from "@/agents/hr";
import type { HrRequest, HrRequestStatus, HrRequestType } from "@/server/db/schema";
import { EmptyState, ErrorBanner, PageHeader, Pill, SectionCard, type Tone } from "./shared";
import { Loader2, Users } from "lucide-react";

// Client-safe copy of schema.ts's hrRequestTypes — that's a runtime value
// under src/server/**, which this project's Vite config denies importing
// from client code (see handme.md "Gotchas"). Only type-only imports from
// server/** are exempt (erased at compile time), which is why every other
// department page imports `type X` from schema.ts but not a runtime array.
const HR_REQUEST_TYPES: HrRequestType[] = ["headcount", "onboarding"];

const STATUS_TONE: Record<HrRequestStatus, Tone> = {
  pending: "amber",
  approved: "success",
  rejected: "rose",
};

interface NewRequestDraft {
  type: HrRequestType;
  department: string;
  roleOrName: string;
  justification: string;
}

const EMPTY_DRAFT: NewRequestDraft = {
  type: "headcount",
  department: "",
  roleOrName: "",
  justification: "",
};

export function HRDemo() {
  const fetchRequests = useServerFn(getHrRequests);
  const submitFn = useServerFn(submitHrRequest);
  const decideFn = useServerFn(decideHrRequest);

  const [requests, setRequests] = useState<HrRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState<NewRequestDraft>(EMPTY_DRAFT);

  useEffect(() => {
    fetchRequests()
      .then(setRequests)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [fetchRequests]);

  async function handleSubmit() {
    if (!draft.department.trim() || !draft.roleOrName.trim() || !draft.justification.trim()) {
      setError("Fill in department, role/name, and justification.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const request = await submitFn({ data: draft });
      setRequests((prev) => [request, ...(prev ?? [])]);
      setDraft(EMPTY_DRAFT);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecide(requestId: string, decision: "approved" | "rejected") {
    setBusyId(requestId);
    setError(null);
    try {
      const updated = await decideFn({ data: { requestId, decision } });
      setRequests((prev) => prev?.map((r) => (r.id === requestId ? updated : r)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record decision");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHeader agentName="HR Agent" tag="headcount & onboarding" />
      <div className="mx-auto max-w-[1100px] px-6 py-10">
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-8">
          <div className="grid-paper absolute inset-0 opacity-60" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5 text-rose" /> Real requests · Postgres-backed
            </div>
            <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-tight">
              Headcount &amp; <em className="text-rose">onboarding</em> requests
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Headcount requests are checked live against the requesting department&apos;s CAPEX
              budget (Finance Agent data) — a real cross-department read, not a canned note.
            </p>
          </div>
        </section>

        <SectionCard className="mt-6">
          <div className="font-serif text-lg">New request</div>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <select
              value={draft.type}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, type: e.target.value as HrRequestType }))
              }
              className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-ink"
            >
              {HR_REQUEST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={draft.department}
              onChange={(e) => setDraft((prev) => ({ ...prev, department: e.target.value }))}
              placeholder="Department (e.g. Procurement)"
              className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-ink"
            />
            <input
              type="text"
              value={draft.roleOrName}
              onChange={(e) => setDraft((prev) => ({ ...prev, roleOrName: e.target.value }))}
              placeholder="Role or employee name"
              className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-ink"
            />
            <input
              type="text"
              value={draft.justification}
              onChange={(e) => setDraft((prev) => ({ ...prev, justification: e.target.value }))}
              placeholder="Justification"
              className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-ink"
            />
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md bg-ink px-4 text-sm font-medium text-paper hover:bg-ink/90 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Submit request
          </button>
        </SectionCard>

        {error && (
          <div className="mt-6">
            <ErrorBanner message={error} />
          </div>
        )}

        <div className="mt-6 space-y-3">
          {requests === null ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <EmptyState>No HR requests yet.</EmptyState>
          ) : (
            requests.map((request) => (
              <SectionCard key={request.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-lg">{request.roleOrName}</span>
                      <Pill tone={STATUS_TONE[request.status]}>{request.status}</Pill>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {request.type} · {request.department}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{request.justification}</p>
                {request.policyNote && (
                  <p className="mt-2 rounded-md border border-border bg-background p-2 text-xs text-amber">
                    {request.policyNote}
                  </p>
                )}
                {request.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === request.id}
                      onClick={() => handleDecide(request.id, "approved")}
                      className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-paper hover:bg-ink/90 disabled:opacity-50"
                    >
                      {busyId === request.id && <Loader2 className="h-3 w-3 animate-spin" />}
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === request.id}
                      onClick={() => handleDecide(request.id, "rejected")}
                      className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </SectionCard>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

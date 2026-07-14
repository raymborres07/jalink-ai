import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getContracts, runComplianceCheck } from "@/agents/legal";
import type { ComplianceCheckResult, Contract, ContractStatus } from "@/server/db/schema";
import { EmptyState, ErrorBanner, PageHeader, Pill, SectionCard, type Tone } from "./shared";
import { Loader2, Scale } from "lucide-react";

const CONTRACT_STATUS_TONE: Record<ContractStatus, Tone> = {
  active: "success",
  draft: "amber",
  expired: "rose",
};

export function LegalDemo() {
  const fetchContracts = useServerFn(getContracts);
  const checkFn = useServerFn(runComplianceCheck);

  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyContractId, setBusyContractId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, ComplianceCheckResult>>({});

  useEffect(() => {
    fetchContracts()
      .then(setContracts)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [fetchContracts]);

  async function handleCheck(contractId: string) {
    const subject = subjects[contractId]?.trim();
    if (!subject) {
      setError("Enter what this check applies to (e.g. a PO number).");
      return;
    }
    setBusyContractId(contractId);
    setError(null);
    try {
      const { result } = await checkFn({ data: { contractId, subject } });
      setResults((prev) => ({ ...prev, [contractId]: result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run compliance check");
    } finally {
      setBusyContractId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHeader agentName="Legal Agent" tag="contract & compliance" />
      <div className="mx-auto max-w-[1100px] px-6 py-10">
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-8">
          <div className="grid-paper absolute inset-0 opacity-60" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Scale className="h-3.5 w-3.5 text-rose" /> Real contract records · Postgres-backed
            </div>
            <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-tight">
              Contract <em className="text-rose">compliance</em> checks
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              A compliance check validates a contract&apos;s status and required clauses (including
              the ASEAN cross-border clause where applicable) and writes the verdict back to the
              record.
            </p>
          </div>
        </section>

        {error && (
          <div className="mt-6">
            <ErrorBanner message={error} />
          </div>
        )}

        <div className="mt-6 space-y-4">
          {contracts === null ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-52 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : contracts.length === 0 ? (
            <EmptyState>No contracts on file yet.</EmptyState>
          ) : (
            contracts.map((contract) => {
              const result = results[contract.id];
              return (
                <SectionCard key={contract.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-serif text-xl">
                        {contract.name} {contract.version}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {contract.counterparty} · {contract.region}
                      </div>
                    </div>
                    <Pill tone={CONTRACT_STATUS_TONE[contract.status]}>{contract.status}</Pill>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {contract.clauses.map((clause) => (
                      <span
                        key={clause}
                        className="rounded border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {clause}
                      </span>
                    ))}
                  </div>

                  <div className="mt-2 text-[11px] text-muted-foreground">
                    Effective {contract.effectiveDate} → {contract.expiryDate}
                  </div>

                  {result && (
                    <div className="mt-4 rounded-md border border-border bg-background p-3 text-xs">
                      <Pill tone={result.verdict === "pass" ? "success" : "amber"}>
                        {result.verdict}
                      </Pill>
                      <p className="mt-2 text-muted-foreground">{result.reasoning}</p>
                      {result.missingClauses.length > 0 && (
                        <p className="mt-1 text-rose">
                          Missing: {result.missingClauses.join(", ")}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-end gap-2">
                    <div className="min-w-[220px] flex-1">
                      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Apply to (PO / invoice reference)
                      </label>
                      <input
                        type="text"
                        value={subjects[contract.id] ?? ""}
                        onChange={(e) =>
                          setSubjects((prev) => ({ ...prev, [contract.id]: e.target.value }))
                        }
                        placeholder="e.g. PO-4500-8821"
                        className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-ink"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={busyContractId === contract.id}
                      onClick={() => handleCheck(contract.id)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md bg-ink px-4 text-sm font-medium text-paper hover:bg-ink/90 disabled:opacity-50"
                    >
                      {busyContractId === contract.id && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      )}
                      Run compliance check
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

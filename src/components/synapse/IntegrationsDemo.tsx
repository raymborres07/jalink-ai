import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getConnectors, toggleConnector } from "@/agents/integrations";
import type { Connector, ConnectorStatus } from "@/server/db/schema";
import { EmptyState, ErrorBanner, PageHeader, Pill, SectionCard, type Tone } from "./shared";
import { Loader2, Plug } from "lucide-react";

const STATUS_TONE: Record<ConnectorStatus, Tone> = {
  connected: "success",
  disconnected: "muted",
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
}

function formatSync(date: Date | null): string {
  if (!date) return "never synced";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "synced just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `synced ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `synced ${hours}h ago`;
}

export function IntegrationsDemo() {
  const fetchConnectors = useServerFn(getConnectors);
  const toggleFn = useServerFn(toggleConnector);

  const [connectors, setConnectors] = useState<Connector[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetchConnectors()
      .then(setConnectors)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [fetchConnectors]);

  async function handleToggle(connectorId: string) {
    setBusyId(connectorId);
    setError(null);
    try {
      const updated = await toggleFn({ data: { connectorId } });
      setConnectors((prev) => prev?.map((c) => (c.id === connectorId ? updated : c)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle connector");
    } finally {
      setBusyId(null);
    }
  }

  const connectedCount = connectors?.filter((c) => c.status === "connected").length ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHeader agentName="Integrations Agent" tag="enterprise connectors" />
      <div className="mx-auto max-w-[1100px] px-6 py-10">
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-8">
          <div className="grid-paper absolute inset-0 opacity-60" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Plug className="h-3.5 w-3.5 text-rose" /> Real connector state · Postgres-backed
            </div>
            <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-tight">
              {connectedCount} of {connectors?.length ?? "—"} connectors{" "}
              <em className="text-rose">connected</em>
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Connect/disconnect writes a real status change to the database — this is what the
              Dashboard's static green dots now reflect.
            </p>
          </div>
        </section>

        {error && (
          <div className="mt-6">
            <ErrorBanner message={error} />
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          {connectors === null ? (
            [0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))
          ) : connectors.length === 0 ? (
            <EmptyState>No connectors configured yet.</EmptyState>
          ) : (
            connectors.map((c) => (
              <SectionCard key={c.id} className="p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-ink font-mono text-[11px] font-bold text-paper">
                    {initials(c.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground">{c.category}</div>
                  </div>
                  <Pill tone={STATUS_TONE[c.status]}>{c.status}</Pill>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {formatSync(c.lastSyncAt)}
                  </span>
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => handleToggle(c.id)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                      c.status === "connected"
                        ? "border border-border bg-background hover:bg-muted"
                        : "bg-ink text-paper hover:bg-ink/90"
                    }`}
                  >
                    {busyId === c.id && <Loader2 className="h-3 w-3 animate-spin" />}
                    {c.status === "connected" ? "Disconnect" : "Connect"}
                  </button>
                </div>
              </SectionCard>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

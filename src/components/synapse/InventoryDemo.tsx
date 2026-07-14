import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adjustStock, getInventory, type InventoryItemWithLevel } from "@/agents/inventory";
import type { StockMovementReason } from "@/server/db/schema";
import { EmptyState, ErrorBanner, PageHeader, Pill, SectionCard, type Tone } from "./shared";
import { Boxes, Loader2, Minus, Plus } from "lucide-react";

const LEVEL_TONE: Record<InventoryItemWithLevel["level"], Tone> = {
  critical: "rose",
  low: "amber",
  ok: "success",
};

export function InventoryDemo() {
  const fetchInventory = useServerFn(getInventory);
  const adjustFn = useServerFn(adjustStock);

  const [items, setItems] = useState<InventoryItemWithLevel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [pendingQty, setPendingQty] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchInventory()
      .then(setItems)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [fetchInventory]);

  async function handleAdjust(itemId: string, reason: StockMovementReason) {
    const qty = pendingQty[itemId] ?? 10;
    const delta = reason === "consumed" ? -Math.abs(qty) : Math.abs(qty);
    setBusyItemId(itemId);
    setError(null);
    try {
      const updated = await adjustFn({ data: { itemId, quantityDelta: delta, reason } });
      setItems((prev) => prev?.map((i) => (i.id === itemId ? updated : i)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to adjust stock");
    } finally {
      setBusyItemId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHeader agentName="Inventory Agent" tag="stock & reorder" />
      <div className="mx-auto max-w-[1100px] px-6 py-10">
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-8">
          <div className="grid-paper absolute inset-0 opacity-60" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Boxes className="h-3.5 w-3.5 text-rose" /> Real stock levels · Cikarang WH
            </div>
            <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-tight">
              Stock <em className="text-rose">levels</em> &amp; reorder points
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Every quantity below is a real row in Postgres. Receiving or consuming stock writes a
              movement record and recomputes the reorder recommendation live.
            </p>
          </div>
        </section>

        {error && (
          <div className="mt-6">
            <ErrorBanner message={error} />
          </div>
        )}

        <div className="mt-6 space-y-4">
          {items === null ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState>No inventory items yet.</EmptyState>
          ) : (
            items.map((item) => (
              <SectionCard key={item.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-lg">{item.name}</span>
                      <Pill tone={LEVEL_TONE[item.level]}>{item.level}</Pill>
                    </div>
                    <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      {item.sku} · {item.warehouse}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <div className="font-mono text-lg font-semibold">
                        {item.quantityOnHand} {item.unit}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        reorder at {item.reorderPoint} · target {item.targetStock}
                      </div>
                    </div>
                  </div>
                </div>

                {item.level !== "ok" && (
                  <p className="mt-3 text-xs text-amber">
                    Recommend reordering {item.reorderQty} {item.unit} to reach target stock.
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={pendingQty[item.id] ?? 10}
                    onChange={(e) =>
                      setPendingQty((prev) => ({
                        ...prev,
                        [item.id]: Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                      }))
                    }
                    className="h-8 w-20 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-ink"
                  />
                  <button
                    type="button"
                    disabled={busyItemId === item.id}
                    onClick={() => handleAdjust(item.id, "received")}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                  >
                    {busyItemId === item.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    Receive
                  </button>
                  <button
                    type="button"
                    disabled={busyItemId === item.id || item.quantityOnHand === 0}
                    onClick={() => handleAdjust(item.id, "consumed")}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                  >
                    <Minus className="h-3 w-3" />
                    Consume
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

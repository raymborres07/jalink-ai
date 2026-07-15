import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  MessageCircle,
  FileImage,
  Check,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  ThumbsUp,
  PauseCircle,
  Flag,
  RotateCcw,
  Sparkles,
  Clock,
  Bot,
  Network,
  LayoutDashboard,
  Smartphone,
  CheckCheck,
} from "lucide-react";
import { captureInvoice } from "@/agents/capture";
import { matchInvoice } from "@/agents/match";
import { recordDecision, scoreRisk } from "@/agents/risk";
import type { ExtractedFields, MatchRow, MatchStatus, RiskResult } from "@/server/db/schema";

type Stage = "idle" | "capturing" | "captured" | "matching" | "matched" | "scoring" | "scored";
type Decision = "approved" | "held" | "escalated" | null;
type ViewMode = "office" | "whatsapp";
type SupplierId = "established" | "new";

const SUPPLIER_NAMES: Record<SupplierId, string> = {
  established: "Sinar Logam Sdn Bhd",
  new: "Baru Jaya Metalworks",
};

interface DisplayField {
  label: string;
  value: string;
  confidence: number;
}

function toDisplayFields(extracted: ExtractedFields): DisplayField[] {
  return [
    { label: "Supplier", ...extracted.supplier },
    { label: "PO number", ...extracted.poNumber },
    { label: "Invoice number", ...extracted.invoiceNumber },
    {
      label: "Line item",
      value: `${extracted.quantity.value} ${extracted.itemDescription.value}`,
      confidence: Math.min(extracted.quantity.confidence, extracted.itemDescription.confidence),
    },
    { label: "Total amount", ...extracted.totalAmount },
    { label: "Date", ...extracted.date },
  ];
}

function confidenceTone(confidence: number): string {
  if (confidence >= 0.85)
    return "text-[var(--success)] border-[var(--success)]/30 bg-[var(--success)]/10";
  if (confidence >= 0.75) return "text-amber border-amber/30 bg-amber/10";
  return "text-rose border-rose/30 bg-rose/10";
}

function matchTone(status: MatchStatus): string {
  if (status === "match") return "text-[var(--success)]";
  if (status === "fuzzy") return "text-amber";
  return "text-rose";
}

interface StageLabelProps {
  n: number;
  label: string;
  done: boolean;
  active: boolean;
}

function StageLabel({ n, label, done, active }: StageLabelProps) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-xs ${
          done
            ? "bg-[var(--success)] text-paper"
            : active
              ? "bg-rose text-paper"
              : "border border-border text-muted-foreground"
        }`}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : n}
      </span>
      <span
        className={`text-sm font-semibold ${done || active ? "text-foreground" : "text-muted-foreground"}`}
      >
        {label}
      </span>
      {active && <Loader2 className="h-3.5 w-3.5 animate-spin text-rose" />}
    </div>
  );
}

function decisionCopy(decision: Decision, supplierName: string): string {
  if (decision === "approved")
    return `Approved with note — released to payment queue. Written back to the supplier dataset: this decision updates ${supplierName}'s reliability score for every future reconciliation, for every SME on the platform.`;
  if (decision === "held")
    return `Held — Nadia will follow up with ${supplierName} before release. Written back to the supplier dataset.`;
  return `Escalated — routed to Dir. Operations for a second review. Written back to the supplier dataset.`;
}

export function ReconciliationDemo() {
  const [stage, setStage] = useState<Stage>("idle");
  const [decision, setDecision] = useState<Decision>(null);
  const [view, setView] = useState<ViewMode>("office");
  const [supplierId, setSupplierId] = useState<SupplierId>("established");
  const [reviewed, setReviewed] = useState<boolean>(false);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedFields | null>(null);
  const [matchRows, setMatchRows] = useState<MatchRow[] | null>(null);
  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const captureFn = useServerFn(captureInvoice);
  const matchFn = useServerFn(matchInvoice);
  const riskFn = useServerFn(scoreRisk);
  const decisionFn = useServerFn(recordDecision);

  const isRunning = stage === "capturing" || stage === "matching" || stage === "scoring";
  const supplierName = extracted?.supplier.value ?? SUPPLIER_NAMES[supplierId];
  const displayFields = extracted ? toDisplayFields(extracted) : [];

  async function runReconciliation(): Promise<void> {
    setDecision(null);
    setReviewed(false);
    setExtracted(null);
    setMatchRows(null);
    setRiskResult(null);
    setInvoiceId(null);
    setError(null);

    try {
      setStage("capturing");
      const captureResult = await captureFn({ data: { supplierId } });
      setInvoiceId(captureResult.invoiceId);
      setExtracted(captureResult.extracted);
      setStage("captured");

      setStage("matching");
      const matchResult = await matchFn({ data: { invoiceId: captureResult.invoiceId } });
      setMatchRows(matchResult.rows);
      setStage("matched");

      setStage("scoring");
      const risk = await riskFn({ data: { invoiceId: captureResult.invoiceId } });
      setRiskResult(risk);
      setStage("scored");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Reconciliation failed — check the server log.",
      );
      setStage("idle");
    }
  }

  async function handleDecision(next: NonNullable<Decision>): Promise<void> {
    if (!invoiceId) return;
    setDecision(next);
    try {
      await decisionFn({ data: { invoiceId, decision: next } });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Could not save the decision — check the server log.",
      );
    }
  }

  function reset(): void {
    setStage("idle");
    setDecision(null);
    setReviewed(false);
    setExtracted(null);
    setMatchRows(null);
    setRiskResult(null);
    setInvoiceId(null);
    setError(null);
  }

  function changeSupplier(id: SupplierId): void {
    setSupplierId(id);
    reset();
  }

  const captureVisible = stage !== "idle";
  const captureDone = extracted !== null;
  const matchVisible = captureDone;
  const matchDone = matchRows !== null;
  const riskVisible = matchDone;
  const riskDone = riskResult !== null;
  const canDecide = riskDone && reviewed && !decision;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center gap-4 px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Orchestrator
          </Link>
          <div className="h-5 w-px bg-border" />
          <span className="font-serif text-lg leading-none">Procurement Agent</span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            procure-to-pay wedge
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-[1100px] px-6 py-10">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid-paper absolute inset-0 opacity-60" />
          <div className="relative flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-rose" /> Live demo · one invoice, three
                agents, real database
              </div>
              <h1 className="mt-3 font-serif text-3xl leading-tight tracking-tight md:text-4xl">
                Capture <span className="text-rose">→</span> Match{" "}
                <span className="text-rose">→</span> Risk
              </h1>
              <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                A photographed invoice sent over WhatsApp to PT Mahakam Manufaktur, reconciled end
                to end — no ERP required. SambungAI lives where the supplier already messages you;
                the back office is the drill-down, not the required front door.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-2">
              <div className="flex gap-2">
                {stage !== "idle" && (
                  <button
                    onClick={reset}
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </button>
                )}
                <button
                  onClick={runReconciliation}
                  disabled={isRunning}
                  className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink/90 disabled:opacity-50"
                >
                  {isRunning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Bot className="h-3.5 w-3.5" />
                  )}
                  {stage === "idle"
                    ? "Run reconciliation"
                    : isRunning
                      ? "Processing…"
                      : "Run again"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {/* Controls: view + supplier */}
        <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
            <button
              onClick={() => setView("office")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                view === "office" ? "bg-ink text-paper" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" /> Back office
            </button>
            <button
              onClick={() => setView("whatsapp")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                view === "whatsapp" ? "bg-ink text-paper" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" /> WhatsApp thread
            </button>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
            <button
              onClick={() => changeSupplier("established")}
              disabled={isRunning}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                supplierId === "established"
                  ? "bg-ink text-paper"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Established supplier
            </button>
            <button
              onClick={() => changeSupplier("new")}
              disabled={isRunning}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                supplierId === "new" ? "bg-ink text-paper" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              New supplier (cold start)
            </button>
          </div>
        </section>

        {view === "office" ? (
          <OfficeView
            supplierName={supplierName}
            displayFields={displayFields}
            matchRows={matchRows}
            riskResult={riskResult}
            captureVisible={captureVisible}
            captureDone={captureDone}
            capturing={stage === "capturing"}
            matchVisible={matchVisible}
            matchDone={matchDone}
            matching={stage === "matching"}
            riskVisible={riskVisible}
            riskDone={riskDone}
            scoring={stage === "scoring"}
            reviewed={reviewed}
            setReviewed={setReviewed}
            canDecide={canDecide}
            decision={decision}
            onDecide={handleDecision}
          />
        ) : (
          <WhatsAppView
            supplierName={supplierName}
            displayFields={displayFields}
            matchRows={matchRows}
            riskResult={riskResult}
            stage={stage}
            reviewed={reviewed}
            setReviewed={setReviewed}
            canDecide={canDecide}
            decision={decision}
            onDecide={handleDecision}
          />
        )}

        {stage === "idle" && (
          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Press "Run reconciliation" to watch the three agents
            hand off in real time.
          </div>
        )}
      </div>
    </div>
  );
}

interface OfficeViewProps {
  supplierName: string;
  displayFields: DisplayField[];
  matchRows: MatchRow[] | null;
  riskResult: RiskResult | null;
  captureVisible: boolean;
  captureDone: boolean;
  capturing: boolean;
  matchVisible: boolean;
  matchDone: boolean;
  matching: boolean;
  riskVisible: boolean;
  riskDone: boolean;
  scoring: boolean;
  reviewed: boolean;
  setReviewed: (v: boolean) => void;
  canDecide: boolean;
  decision: Decision;
  onDecide: (d: NonNullable<Decision>) => void;
}

function OfficeView({
  supplierName,
  displayFields,
  matchRows,
  riskResult,
  captureVisible,
  captureDone,
  capturing,
  matchVisible,
  matchDone,
  matching,
  riskVisible,
  riskDone,
  scoring,
  reviewed,
  setReviewed,
  canDecide,
  decision,
  onDecide,
}: OfficeViewProps) {
  return (
    <>
      {/* Source message */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <MessageCircle className="h-3.5 w-3.5" /> Incoming · WhatsApp Business
        </div>
        <div className="mt-3 flex items-start gap-3 rounded-xl bg-muted p-4">
          <FileImage className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground" />
          <div className="text-sm leading-relaxed">
            <p className="font-medium">{supplierName}</p>
            <p className="mt-1 text-muted-foreground">
              "Selamat pagi Bu Nadia, ini invoice utk PO 4500-8821 — INV-8821-B, 500 unit Steel Rod
              Grade-A @ IDR 285.000, total IDR 142.500.000. Sudah sampai Cikarang kemarin. Terima
              kasih 🙏"
            </p>
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              1 image attached · mixed Bahasa / English
            </p>
          </div>
        </div>
      </section>

      {/* Capture Agent */}
      {captureVisible && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-6">
          <StageLabel
            n={1}
            label="Capture Agent — structuring the message"
            done={captureDone}
            active={capturing}
          />
          {captureDone && (
            <div className="mt-5">
              <p className="text-sm text-muted-foreground">
                Parsed with SEA-LION v4 (text + image, single pass). Every field carries a
                confidence score; low-confidence fields are flagged for a human before they move
                downstream.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                {displayFields.map((f) => (
                  <div key={f.label} className="rounded-lg border border-border bg-background p-3">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {f.label}
                    </div>
                    <div className="mt-1 text-sm font-medium">{f.value}</div>
                    <div
                      className={`mt-2 inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] ${confidenceTone(f.confidence)}`}
                    >
                      {f.confidence.toFixed(2)} confidence
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-xs text-rose">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Date field below 0.70 confidence — routed for human confirmation alongside the
                review queue.
              </div>
            </div>
          )}
        </section>
      )}

      {/* Match Agent */}
      {matchVisible && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-6">
          <StageLabel
            n={2}
            label="Match Agent — PO ↔ delivery ↔ invoice"
            done={matchDone}
            active={matching}
          />
          {matchDone && matchRows && (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-4">Field</th>
                    <th className="pb-2 pr-4">Purchase order</th>
                    <th className="pb-2 pr-4">Delivery note</th>
                    <th className="pb-2 pr-4">Invoice</th>
                    <th className="pb-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {matchRows.map((r) => (
                    <tr key={r.field} className="border-t border-border">
                      <td className="py-2.5 pr-4 font-medium">{r.field}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{r.po}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{r.delivery}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{r.invoice}</td>
                      <td className={`py-2.5 font-mono text-xs ${matchTone(r.status)}`}>
                        {r.status === "match"
                          ? "✓ rule match"
                          : r.status === "fuzzy"
                            ? "~ AI fuzzy match"
                            : "⚠ variance"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 space-y-2">
                {matchRows
                  .filter((r) => r.note)
                  .map((r) => (
                    <p key={r.field} className="text-xs text-muted-foreground">
                      <span className={`font-mono ${matchTone(r.status)}`}>{r.field}</span> —{" "}
                      {r.note}
                    </p>
                  ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Risk Agent */}
      {riskVisible && (
        <section className="mt-6 rounded-2xl border-2 border-amber bg-card p-6">
          <StageLabel
            n={3}
            label="Risk Agent — score, reason, recommend"
            done={riskDone}
            active={scoring}
          />
          {riskDone && riskResult && (
            <div className="mt-5 grid gap-6 md:grid-cols-[1fr_1.4fr]">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-5xl">{riskResult.riskScore}</span>
                  <span className="text-sm text-muted-foreground">
                    / 100 · {riskResult.riskLabel}
                  </span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${riskResult.riskScore >= 40 ? "bg-amber" : "bg-[var(--success)]"}`}
                    style={{ width: `${riskResult.riskScore}%` }}
                  />
                </div>
                <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {riskResult.basis}
                </div>
                <dl className="mt-5 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">On-time delivery (6mo)</dt>
                    <dd className="font-mono">{riskResult.onTimeRate}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Dispute frequency</dt>
                    <dd className="font-mono">{riskResult.disputeFrequency}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Avg. price variance</dt>
                    <dd className="font-mono">{riskResult.priceVariance}</dd>
                  </div>
                </dl>
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <Network className="h-3.5 w-3.5 text-rose" /> Reasoning
                </div>
                <p className="mt-2 text-sm leading-relaxed">
                  {riskResult.reasoning}{" "}
                  <span className="font-medium">{riskResult.recommendation}</span>
                </p>

                {!decision ? (
                  <div className="mt-5">
                    <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={reviewed}
                        onChange={(e) => setReviewed(e.target.checked)}
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      />
                      I've reviewed the evidence above. SambungAI is advisory only — it never
                      executes payment; a human decision is required every time.
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => onDecide("approved")}
                        disabled={!canDecide}
                        className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" /> Approve with note
                      </button>
                      <button
                        onClick={() => onDecide("held")}
                        disabled={!canDecide}
                        className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <PauseCircle className="h-3.5 w-3.5" /> Hold
                      </button>
                      <button
                        onClick={() => onDecide("escalated")}
                        disabled={!canDecide}
                        className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Flag className="h-3.5 w-3.5" /> Escalate
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 flex items-start gap-2 rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/10 px-3 py-2.5 text-sm text-[var(--success)]">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{decisionCopy(decision, supplierName)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}

interface WhatsAppViewProps {
  supplierName: string;
  displayFields: DisplayField[];
  matchRows: MatchRow[] | null;
  riskResult: RiskResult | null;
  stage: Stage;
  reviewed: boolean;
  setReviewed: (v: boolean) => void;
  canDecide: boolean;
  decision: Decision;
  onDecide: (d: NonNullable<Decision>) => void;
}

function Bubble({
  children,
  tone = "bot",
}: {
  children: React.ReactNode;
  tone?: "bot" | "system";
}) {
  return (
    <div
      className={`max-w-[85%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-[13px] leading-snug shadow-sm ${
        tone === "bot"
          ? "bg-[#ffffff] text-ink"
          : "mx-auto max-w-[90%] rounded-full bg-black/5 px-3 py-1 text-center text-[11px] text-muted-foreground"
      }`}
    >
      {children}
    </div>
  );
}

function WhatsAppView({
  supplierName,
  displayFields,
  matchRows,
  riskResult,
  stage,
  reviewed,
  setReviewed,
  canDecide,
  decision,
  onDecide,
}: WhatsAppViewProps) {
  const captureDone = displayFields.length > 0;
  const matchDone = matchRows !== null;
  const riskDone = riskResult !== null;
  const lineItem = displayFields.find((f) => f.label === "Line item")?.value ?? "the line item";
  const varianceRows = matchRows?.filter((r) => r.status !== "match") ?? [];

  return (
    <section className="mt-6 flex justify-center rounded-2xl border border-border bg-card p-6">
      <div className="w-full max-w-[380px] overflow-hidden rounded-[28px] border border-border bg-[#e5ddd3] shadow-lg">
        <div className="flex items-center gap-2 bg-[#075e54] px-4 py-3 text-paper">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-white/20 font-mono text-xs">
            JA
          </div>
          <div>
            <div className="text-sm font-medium leading-tight">SambungAI Bot</div>
            <div className="text-[10px] opacity-80">procurement · PT Mahakam Manufaktur</div>
          </div>
        </div>

        <div className="flex min-h-[420px] flex-col gap-2.5 px-3 py-4">
          {/* Incoming from supplier */}
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[#dcf8c6] px-3.5 py-2.5 text-[13px] leading-snug shadow-sm">
              <p className="font-medium">{supplierName}</p>
              <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                <FileImage className="h-3.5 w-3.5 shrink-0" /> invoice.jpg
              </p>
              <p className="mt-1">
                "ini invoice utk PO 4500-8821 — INV-8821-B, 500 unit Steel Rod Grade-A @ IDR
                285.000, total IDR 142.500.000. Sudah sampai Cikarang kemarin 🙏"
              </p>
            </div>
          </div>

          {stage === "idle" && (
            <Bubble tone="system">
              Press "Run reconciliation" above to see SambungAI reply in-thread.
            </Bubble>
          )}

          {stage === "capturing" && (
            <Bubble>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> reading invoice…
              </span>
            </Bubble>
          )}

          {captureDone && (
            <Bubble>
              Got it ✅ Read as: <strong>{lineItem}</strong>, checking against your PO and delivery
              note now…
            </Bubble>
          )}

          {stage === "matching" && (
            <Bubble>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> matching PO ↔ delivery ↔ invoice…
              </span>
            </Bubble>
          )}

          {matchDone && (
            <Bubble>
              {varianceRows.length === 0
                ? "Everything matches ✓ — no discrepancies found."
                : `Matched ${matchRows!.length - varianceRows.length}/${matchRows!.length} fields cleanly. ${varianceRows.map((r) => r.note ?? `${r.field} needs a look.`).join(" ")}`}
            </Bubble>
          )}

          {stage === "scoring" && (
            <Bubble>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> checking {supplierName}'s track record…
              </span>
            </Bubble>
          )}

          {riskDone && riskResult && (
            <>
              <Bubble>
                <span className="font-mono text-xs">
                  Risk score: {riskResult.riskScore}/100 ({riskResult.riskLabel})
                </span>
                <br />
                {riskResult.reasoning} {riskResult.recommendation}
              </Bubble>

              {!reviewed && (
                <div className="flex justify-start">
                  <button
                    onClick={() => setReviewed(true)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#075e54]/30 bg-white px-3 py-1.5 text-xs font-medium text-[#075e54] shadow-sm"
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Mark reasoning as reviewed
                  </button>
                </div>
              )}

              {reviewed && !decision && (
                <Bubble tone="system">
                  Reviewed — SambungAI never releases payment on its own. Choose an action below.
                </Bubble>
              )}

              {!decision && (
                <div className="flex flex-wrap justify-start gap-2">
                  <button
                    onClick={() => onDecide("approved")}
                    disabled={!canDecide}
                    className="rounded-full border border-[#075e54]/30 bg-white px-3 py-1.5 text-xs font-medium text-[#075e54] shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    👍 Approve with note
                  </button>
                  <button
                    onClick={() => onDecide("held")}
                    disabled={!canDecide}
                    className="rounded-full border border-[#075e54]/30 bg-white px-3 py-1.5 text-xs font-medium text-[#075e54] shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ⏸️ Hold
                  </button>
                  <button
                    onClick={() => onDecide("escalated")}
                    disabled={!canDecide}
                    className="rounded-full border border-[#075e54]/30 bg-white px-3 py-1.5 text-xs font-medium text-[#075e54] shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    🚩 Escalate
                  </button>
                </div>
              )}

              {decision && (
                <Bubble>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-[#075e54]" />
                    {decisionCopy(decision, supplierName)}
                  </span>
                </Bubble>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

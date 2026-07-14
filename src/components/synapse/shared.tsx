import { Link } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft } from "lucide-react";

export type Tone = "ink" | "rose" | "amber" | "success" | "muted";

const TONE_CLASSES: Record<Tone, string> = {
  ink: "bg-ink text-paper",
  rose: "bg-rose text-paper",
  amber: "bg-amber text-ink",
  success: "bg-[var(--success)] text-paper",
  muted: "bg-muted text-muted-foreground border border-border",
};

export function Pill({ children, tone = "muted" }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

export function PageHeader({ agentName, tag }: { agentName: string; tag: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1100px] items-center gap-4 px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Orchestrator
        </Link>
        <div className="h-5 w-px bg-border" />
        <span className="font-serif text-lg leading-none">{agentName}</span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {tag}
        </span>
      </div>
    </header>
  );
}

export function SectionCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-6 ${className}`}>
      {children}
    </section>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose">
      <AlertCircle className="h-4 w-4 shrink-0" /> {message}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

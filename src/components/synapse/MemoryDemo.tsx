import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { addDocument, getDocuments } from "@/agents/memory";
import type { Document, DocumentCategory } from "@/server/db/schema";
import { EmptyState, ErrorBanner, PageHeader, Pill, SectionCard, type Tone } from "./shared";
import { FileText, Loader2, Search } from "lucide-react";

// Client-safe copy of schema.ts's documentCategories — see HRDemo.tsx for
// why a runtime value can't be imported from src/server/** on the client.
const DOCUMENT_CATEGORIES: DocumentCategory[] = ["policy", "sop", "contract", "decision"];

const CATEGORY_TONE: Record<DocumentCategory, Tone> = {
  policy: "amber",
  sop: "muted",
  contract: "rose",
  decision: "success",
};

interface NewDocDraft {
  title: string;
  category: DocumentCategory;
  language: string;
  summary: string;
  tags: string;
}

const EMPTY_DRAFT: NewDocDraft = {
  title: "",
  category: "policy",
  language: "",
  summary: "",
  tags: "",
};

export function MemoryDemo() {
  const fetchDocuments = useServerFn(getDocuments);
  const addFn = useServerFn(addDocument);

  const [docs, setDocs] = useState<Document[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | "all">("all");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<NewDocDraft>(EMPTY_DRAFT);

  useEffect(() => {
    fetchDocuments()
      .then(setDocs)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [fetchDocuments]);

  const filtered = useMemo(() => {
    if (!docs) return null;
    const q = query.trim().toLowerCase();
    return docs.filter((d) => {
      if (categoryFilter !== "all" && d.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.summary.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [docs, query, categoryFilter]);

  async function handleAdd() {
    if (!draft.title.trim() || !draft.language.trim() || !draft.summary.trim()) {
      setError("Fill in title, language, and summary.");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const doc = await addFn({
        data: {
          title: draft.title,
          category: draft.category,
          language: draft.language,
          summary: draft.summary,
          tags: draft.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      });
      setDocs((prev) => [doc, ...(prev ?? [])]);
      setDraft(EMPTY_DRAFT);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add document");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHeader agentName="Memory Agent" tag="enterprise memory" />
      <div className="mx-auto max-w-[1100px] px-6 py-10">
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-8">
          <div className="grid-paper absolute inset-0 opacity-60" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5 text-rose" /> Real document index · Postgres-backed
            </div>
            <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-tight">
              {docs === null ? "—" : docs.length} <em className="text-rose">documents</em> indexed
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Policies, SOPs, contract templates, and decision logs shared across every agent —
              searched below, not summarized by an LLM.
            </p>
          </div>
        </section>

        <SectionCard className="mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title, summary, tags…"
                className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-ink"
              />
            </div>
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${categoryFilter === "all" ? "bg-ink text-paper" : "border border-border bg-background hover:bg-muted"}`}
            >
              All
            </button>
            {DOCUMENT_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategoryFilter(c)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${categoryFilter === c ? "bg-ink text-paper" : "border border-border bg-background hover:bg-muted"}`}
              >
                {c}
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard className="mt-6">
          <div className="font-serif text-lg">Add document</div>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Title"
              className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-ink"
            />
            <select
              value={draft.category}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, category: e.target.value as DocumentCategory }))
              }
              className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-ink"
            >
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={draft.language}
              onChange={(e) => setDraft((prev) => ({ ...prev, language: e.target.value }))}
              placeholder="Language"
              className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-ink"
            />
            <input
              type="text"
              value={draft.tags}
              onChange={(e) => setDraft((prev) => ({ ...prev, tags: e.target.value }))}
              placeholder="Tags (comma-separated)"
              className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-ink"
            />
            <input
              type="text"
              value={draft.summary}
              onChange={(e) => setDraft((prev) => ({ ...prev, summary: e.target.value }))}
              placeholder="Summary"
              className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-ink md:col-span-2"
            />
          </div>
          <button
            type="button"
            disabled={adding}
            onClick={handleAdd}
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md bg-ink px-4 text-sm font-medium text-paper hover:bg-ink/90 disabled:opacity-50"
          >
            {adding && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Add document
          </button>
        </SectionCard>

        {error && (
          <div className="mt-6">
            <ErrorBanner message={error} />
          </div>
        )}

        <div className="mt-6 space-y-3">
          {filtered === null ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState>No documents match.</EmptyState>
          ) : (
            filtered.map((doc) => (
              <SectionCard key={doc.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-lg">{doc.title}</span>
                      <Pill tone={CATEGORY_TONE[doc.category]}>{doc.category}</Pill>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{doc.language}</div>
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{doc.summary}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {doc.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </SectionCard>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

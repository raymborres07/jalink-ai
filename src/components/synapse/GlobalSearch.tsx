import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { globalSearch, type SearchResult } from "@/agents/search";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const DEBOUNCE_MS = 150;
const MIN_QUERY_LENGTH = 2;

// Dashboard's visible "Ask the Orchestrator ⌘K" box dispatches this to open
// the same palette the ⌘K/Ctrl+K shortcut opens, without prop-drilling state
// through the app shell.
export const OPEN_SEARCH_EVENT = "jalinkai:open-search";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const searchFn = useServerFn(globalSearch);
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    function onOpenRequest() {
      setOpen(true);
    }
    window.addEventListener(OPEN_SEARCH_EVENT, onOpenRequest);
    return () => window.removeEventListener(OPEN_SEARCH_EVENT, onOpenRequest);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(() => {
      searchFn({ data: { query } })
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query, open, searchFn]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setResults([]);
    }
  }

  function handleSelect(to: string) {
    handleOpenChange(false);
    navigate({ to });
  }

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput
        placeholder="Search suppliers, invoices, deals, contracts, documents…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {query.trim().length < MIN_QUERY_LENGTH ? (
          <CommandEmpty>Type at least 2 characters to search real JalinkAI data.</CommandEmpty>
        ) : loading ? (
          <CommandEmpty>Searching…</CommandEmpty>
        ) : results.length === 0 ? (
          <CommandEmpty>No results for &quot;{query}&quot;.</CommandEmpty>
        ) : (
          <CommandGroup heading="Results">
            {results.map((r) => (
              <CommandItem
                key={r.id}
                value={`${r.title} ${r.subtitle}`.toLowerCase()}
                onSelect={() => handleSelect(r.to)}
              >
                <div className="flex flex-col">
                  <span>{r.title}</span>
                  <span className="text-xs text-muted-foreground">{r.subtitle}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

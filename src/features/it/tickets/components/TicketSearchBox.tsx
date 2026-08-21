import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import { useTicketSearch } from "@/features/it/tickets/hooks";
import { Input } from "@/components/ui/input";
import { TicketPriorityBadge, TicketStatusBadge } from "@/components/shared/TicketBadges";

// Debounced quick-jump search for the Ticketing dashboard: type a ticket
// number or subject, get a short dropdown of matches, click straight into
// one. Built for "I need to find one specific ticket among hundreds"
// without leaving the dashboard or waiting for the full list page to load.
export function TicketSearchBox({ companyId, companySlug }: { companyId: string | undefined; companySlug: string }) {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(input), 250);
    return () => clearTimeout(t);
  }, [input]);

  const { data: results, isFetching } = useTicketSearch(companyId, debounced);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      navigate(`/c/${companySlug}/it/tickets?search=${encodeURIComponent(input.trim())}`);
      setOpen(false);
    }
  };

  const showDropdown = open && debounced.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Find a ticket by number or subject…"
            className="pl-8"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setOpen(true)}
          />
          {isFetching && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </form>

      {showDropdown && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
          {!results || results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              {isFetching ? "Searching…" : "No matching tickets"}
            </p>
          ) : (
            <>
              <ul className="max-h-80 overflow-y-auto py-1">
                {results.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => {
                        navigate(`/c/${companySlug}/it/tickets/${t.id}`);
                        setOpen(false);
                        setInput("");
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">{t.ticket_number}</span>
                      <span className="flex-1 truncate">{t.subject}</span>
                      <TicketPriorityBadge priority={t.priority} />
                      <TicketStatusBadge status={t.status} />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleSubmit}
                className="block w-full border-t border-border px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                See all results in Tickets →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

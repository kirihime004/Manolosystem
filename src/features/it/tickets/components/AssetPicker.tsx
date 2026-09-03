import { useEffect, useState } from "react";
import { X, Search } from "lucide-react";
import { searchAssetsForTicket } from "@/features/it/tickets/ticketApi";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface MiniAsset {
  id: string;
  asset_code: string;
  name: string;
}

export function AssetPicker({
  companyId,
  value,
  onChange,
  initialAsset,
}: {
  companyId: string | undefined;
  value: string | null;
  onChange: (assetId: string | null) => void;
  // Seeds the picker with an already-linked asset's display info (code +
  // name) so re-opening it on an existing link shows that, not a bare
  // asset_id -- the picker otherwise only ever learns an asset's name from
  // an in-session search pick.
  initialAsset?: MiniAsset | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MiniAsset[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<MiniAsset | null>(initialAsset ?? null);

  useEffect(() => {
    if (!companyId || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      searchAssetsForTicket(companyId, query).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timeout);
  }, [companyId, query]);

  if (selected || (value && !selected)) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
        <span className="font-mono text-xs">{selected?.asset_code ?? value}</span>
        {selected && <span className="text-muted-foreground">— {selected.name}</span>}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          onClick={() => {
            setSelected(null);
            onChange(null);
          }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search asset ID or name…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-1" align="start">
        {results.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            {query.trim().length < 2 ? "Type at least 2 characters" : "No matching assets"}
          </p>
        ) : (
          <div className="max-h-56 space-y-0.5 overflow-y-auto">
            {results.map((a) => (
              <button
                key={a.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() => {
                  setSelected(a);
                  onChange(a.id);
                  setOpen(false);
                }}
              >
                <span className="font-mono text-xs">{a.asset_code}</span>
                <span className="truncate text-muted-foreground">{a.name}</span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

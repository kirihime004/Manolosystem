import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus, TrendingUp } from "lucide-react";
import { useCurrencies, useExchangeRates, useExchangeRateMutations } from "@/features/it/procurement/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { CurrencySelect } from "@/components/shared/CurrencySelect";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function ExchangeRatesPage() {
  const { data: currencies } = useCurrencies();
  const { data: rates, isLoading } = useExchangeRates();
  const { create, setActive } = useExchangeRateMutations();

  const [open, setOpen] = useState(false);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [rate, setRate] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState("");

  const codeFor = (id: string) => currencies?.find((c) => c.id === id)?.code ?? "—";

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({ fromCurrencyId: fromId, toCurrencyId: toId, rate: Number(rate), effectiveDate, source: source || null });
      toast.success("Exchange rate added");
      setOpen(false);
      setRate(""); setSource("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add exchange rate");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Exchange Rates</h1>
          <p className="text-sm text-muted-foreground">Shared across every company. New rates never overwrite history — finalized transactions keep the rate they were recorded with.</p>
        </div>
        <Can permission={PERMISSIONS.IT_CURRENCY_UPDATE_RATES}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" />New rate</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add exchange rate</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>From</Label><CurrencySelect value={fromId} onChange={setFromId} /></div>
                  <div className="space-y-1.5"><Label>To</Label><CurrencySelect value={toId} onChange={setToId} /></div>
                </div>
                <div className="space-y-1.5"><Label>Rate (1 From = ? To)</Label><Input type="number" step="0.000001" required value={rate} onChange={(e) => setRate(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Effective date</Label><Input type="date" required value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Source</Label><Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Central bank, manual entry" /></div>
                <DialogFooter><Button type="submit" disabled={create.isPending || !fromId || !toId}>{create.isPending ? "Saving…" : "Add rate"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !rates || rates.length === 0 ? (
          <EmptyState icon={TrendingUp} title="No exchange rates yet" />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Rate</TableHead><TableHead>Effective Date</TableHead><TableHead>Source</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
            <TableBody>
              {rates.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{codeFor(r.from_currency_id)}</TableCell>
                  <TableCell className="font-medium">{codeFor(r.to_currency_id)}</TableCell>
                  <TableCell>{r.rate}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(r.effective_date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-muted-foreground">{r.source ?? "—"}</TableCell>
                  <TableCell>
                    <Can permission={PERMISSIONS.IT_CURRENCY_UPDATE_RATES} fallback={<span className="text-xs text-muted-foreground">{r.is_active ? "Yes" : "No"}</span>}>
                      <Switch checked={r.is_active} onCheckedChange={(checked) => setActive.mutate({ id: r.id, isActive: checked })} />
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

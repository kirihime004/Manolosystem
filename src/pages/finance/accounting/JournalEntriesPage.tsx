import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { BookText, Plus } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useJournalEntries, useJournalEntryMutations } from "@/features/finance/hooks";
import { useCompanyCurrencySettings } from "@/features/it/procurement/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { FinanceStatusBadge } from "@/components/shared/FinanceBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

const STATUS_FILTERS = ["", "DRAFT", "PENDING_APPROVAL", "APPROVED", "POSTED", "REVERSED", "VOID"];

export default function JournalEntriesPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const [status, setStatus] = useState("");
  const { data: entries, isLoading } = useJournalEntries(company?.id, status ? { status } : {});
  const { data: currencySettings } = useCompanyCurrencySettings(company?.id);
  const { create } = useJournalEntryMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!company || !currencySettings) return;
    try {
      const je = await create.mutateAsync({
        companyId: company.id, date, description: description.trim(),
        currencyId: currencySettings.base_currency_id, baseCurrencyId: currencySettings.base_currency_id,
      });
      toast.success(`${je.journal_number} created`);
      setOpen(false);
      setDescription("");
      window.location.href = `/c/${companySlug}/finance/accounting/journals/${je.id}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create journal entry");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Journal Entries</h1>
          <p className="text-sm text-muted-foreground">{entries?.length ?? 0} entries</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status || "ALL"} onValueChange={(v) => setStatus(v === "ALL" ? "" : v)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {STATUS_FILTERS.filter(Boolean).map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Can permission={PERMISSIONS.FINANCE_JOURNALS_CREATE}>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4" />New journal entry</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New journal entry</DialogTitle></DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-1.5"><Label>Date</Label><Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Description</Label><Textarea required rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                  <DialogFooter><Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create draft"}</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </Can>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !entries || entries.length === 0 ? (
          <EmptyState icon={BookText} title="No journal entries yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Journal #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Debit</TableHead>
                <TableHead>Credit</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((je) => (
                <TableRow key={je.id} className="cursor-pointer" onClick={() => (window.location.href = `/c/${companySlug}/finance/accounting/journals/${je.id}`)}>
                  <TableCell><Link to={`/c/${companySlug}/finance/accounting/journals/${je.id}`} className="font-medium text-foreground hover:underline">{je.journal_number}</Link></TableCell>
                  <TableCell className="text-muted-foreground">{je.date}</TableCell>
                  <TableCell className="max-w-md truncate">{je.description}</TableCell>
                  <TableCell><Money amount={je.total_debit} currencyId={je.base_currency_id} /></TableCell>
                  <TableCell><Money amount={je.total_credit} currencyId={je.base_currency_id} /></TableCell>
                  <TableCell><FinanceStatusBadge status={je.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

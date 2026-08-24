import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { BookOpen, Plus, Archive, Pencil } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useChartOfAccounts, useChartOfAccountsMutations } from "@/features/finance/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { FinanceStatusBadge } from "@/components/shared/FinanceBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE", "COGS"];

export default function ChartOfAccountsPage() {
  const { company } = useCompany();
  const { data: accounts, isLoading } = useChartOfAccounts(company?.id);
  const { create, update, archive } = useChartOfAccountsMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState("EXPENSE");
  const [parentAccountId, setParentAccountId] = useState<string>("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editParentAccountId, setEditParentAccountId] = useState("");

  const headers = (accounts ?? []).filter((a) => a.is_header);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    try {
      await create.mutateAsync({
        companyId: company.id, code: code.trim(), name: name.trim(), accountType,
        parentAccountId: parentAccountId || null,
      });
      toast.success(`Account ${code} created`);
      setOpen(false);
      setCode(""); setName(""); setParentAccountId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create account");
    }
  };

  const startEdit = (a: { id: string; name: string; description: string | null; parent_account_id: string | null; is_header: boolean }) => {
    setEditingId(a.id);
    setEditName(a.name);
    setEditDescription(a.description ?? "");
    setEditParentAccountId(a.parent_account_id ?? "");
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      await update.mutateAsync({
        id: editingId,
        patch: { name: editName, description: editDescription || null, parentAccountId: editParentAccountId || null },
      });
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update account");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Chart of Accounts</h1>
          <p className="text-sm text-muted-foreground">{accounts?.length ?? 0} accounts</p>
        </div>
        <Can permission={PERMISSIONS.FINANCE_ACCOUNTS_CREATE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" />New account</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New account</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Code</Label><Input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 6910" /></div>
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select value={accountType} onValueChange={setAccountType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ACCOUNT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Parent account (optional)</Label>
                  <Select value={parentAccountId || "none"} onValueChange={(v) => setParentAccountId(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {headers.map((h) => <SelectItem key={h.id} value={h.id}>{h.code} {h.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create account"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !accounts || accounts.length === 0 ? (
          <EmptyState icon={BookOpen} title="No accounts yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{a.code}</TableCell>
                  <TableCell className={a.is_header ? "font-semibold text-foreground" : a.parent_account_id ? "pl-6" : ""}>{a.name}</TableCell>
                  <TableCell className="text-muted-foreground">{a.account_type}</TableCell>
                  <TableCell><FinanceStatusBadge status={a.status} /></TableCell>
                  <TableCell className="flex gap-1">
                    <Can permission={PERMISSIONS.FINANCE_ACCOUNTS_UPDATE}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                    </Can>
                    {!a.is_system && a.status === "ACTIVE" && (
                      <Can permission={PERMISSIONS.FINANCE_ACCOUNTS_ARCHIVE}>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><Archive className="h-3.5 w-3.5" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Archive {a.code} {a.name}?</AlertDialogTitle>
                              <AlertDialogDescription>Archived accounts stay in historical reports but can no longer be posted to.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => archive.mutate(a.id)}>Archive</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </Can>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!editingId} onOpenChange={(v) => !v && setEditingId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit account</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-1.5"><Label>Name</Label><Input required value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Parent account (optional)</Label>
              <Select value={editParentAccountId || "none"} onValueChange={(v) => setEditParentAccountId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {headers.filter((h) => h.id !== editingId).map((h) => <SelectItem key={h.id} value={h.id}>{h.code} {h.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter><Button type="submit" disabled={update.isPending}>{update.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

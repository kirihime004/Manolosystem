import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Landmark, Plus, Pencil } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useCashAccounts, useCashBankMutations, useChartOfAccounts } from "@/features/finance/hooks";
import { useCompanyCurrencySettings } from "@/features/it/procurement/hooks";
import { CurrencySelect } from "@/components/shared/CurrencySelect";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { FinanceStatusBadge } from "@/components/shared/FinanceBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

const ACCOUNT_TYPES = ["BANK", "CASH", "PETTY_CASH", "CREDIT_CARD", "OTHER"];

export default function CashAccountsPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { data: accounts, isLoading } = useCashAccounts(company?.id);
  const { data: currencySettings } = useCompanyCurrencySettings(company?.id);
  const { data: chartAccounts } = useChartOfAccounts(company?.id);
  const { createAccount, updateAccount } = useCashBankMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState("BANK");
  const [bankName, setBankName] = useState("");
  const [accountNumberMasked, setAccountNumberMasked] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [glAccountId, setGlAccountId] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBankName, setEditBankName] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");

  const cashGlAccounts = (chartAccounts ?? []).filter((a) => !a.is_header && a.account_type === "ASSET");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    try {
      const acc = await createAccount.mutateAsync({
        companyId: company.id, name, accountType, bankName: bankName || null,
        accountNumberMasked: accountNumberMasked || null,
        currencyId: currencyId || currencySettings!.base_currency_id, glAccountId, openingBalance: Number(openingBalance),
      });
      toast.success(`${acc.name} created`);
      setOpen(false);
      setName(""); setBankName(""); setAccountNumberMasked(""); setOpeningBalance("0");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create account");
    }
  };

  const startEdit = (a: { id: string; name: string; bank_name: string | null; status: string }) => {
    setEditingId(a.id);
    setEditName(a.name);
    setEditBankName(a.bank_name ?? "");
    setEditStatus(a.status);
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      await updateAccount.mutateAsync({ id: editingId, patch: { name: editName, bankName: editBankName || null, status: editStatus } });
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update account");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Cash & Bank</h1>
          <p className="text-sm text-muted-foreground">{accounts?.length ?? 0} accounts</p>
        </div>
        <Can permission={PERMISSIONS.FINANCE_BANK_CREATE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" />New account</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New cash/bank account</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select value={accountType} onValueChange={setAccountType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ACCOUNT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                {accountType === "BANK" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Bank name</Label><Input value={bankName} onChange={(e) => setBankName(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Account # (masked)</Label><Input placeholder="****1234" value={accountNumberMasked} onChange={(e) => setAccountNumberMasked(e.target.value)} /></div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Currency</Label>
                    <CurrencySelect value={currencyId || currencySettings?.base_currency_id || ""} onChange={setCurrencyId} />
                  </div>
                  <div className="space-y-1.5"><Label>Opening balance</Label><Input type="number" step="0.01" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} /></div>
                </div>
                <div className="space-y-1.5">
                  <Label>GL account</Label>
                  <Select value={glAccountId} onValueChange={setGlAccountId}>
                    <SelectTrigger><SelectValue placeholder="Select GL account" /></SelectTrigger>
                    <SelectContent>{cashGlAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} {a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <DialogFooter><Button type="submit" disabled={!glAccountId || createAccount.isPending}>{createAccount.isPending ? "Creating…" : "Create account"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !accounts || accounts.length === 0 ? (
          <EmptyState icon={Landmark} title="No cash or bank accounts yet" />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Bank</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id} className="cursor-pointer" onClick={() => (window.location.href = `/c/${companySlug}/finance/cash-bank/${a.id}`)}>
                  <TableCell><Link to={`/c/${companySlug}/finance/cash-bank/${a.id}`} className="font-medium text-foreground hover:underline">{a.name}</Link></TableCell>
                  <TableCell className="text-muted-foreground">{a.account_type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{a.bank_name ?? "—"} {a.account_number_masked}</TableCell>
                  <TableCell className="font-medium"><Money amount={a.current_balance} currencyId={a.currency_id} /></TableCell>
                  <TableCell><FinanceStatusBadge status={a.status} /></TableCell>
                  <TableCell>
                    <Can permission={PERMISSIONS.FINANCE_BANK_CREATE}>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); startEdit(a); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!editingId} onOpenChange={(v) => !v && setEditingId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit cash/bank account</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-1.5"><Label>Name</Label><Input required value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Bank name</Label><Input value={editBankName} onChange={(e) => setEditBankName(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter><Button type="submit" disabled={updateAccount.isPending}>{updateAccount.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

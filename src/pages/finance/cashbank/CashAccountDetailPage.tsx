import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useCashAccounts, useBankTransactions, useBankReconciliations, useCashBankMutations } from "@/features/finance/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { FinanceStatusBadge } from "@/components/shared/FinanceBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { Landmark } from "lucide-react";

const TX_TYPES = ["DEPOSIT", "WITHDRAWAL", "TRANSFER", "BANK_FEE", "INTEREST", "ADJUSTMENT"];

export default function CashAccountDetailPage() {
  const { cashAccountId } = useParams<{ cashAccountId: string }>();
  const { company } = useCompany();
  const { data: accounts } = useCashAccounts(company?.id);
  const account = (accounts ?? []).find((a) => a.id === cashAccountId);
  const { data: transactions } = useBankTransactions(cashAccountId);
  const { data: reconciliations } = useBankReconciliations(cashAccountId);
  const { recordTransaction, createReconciliation, markReconciled, completeReconciliation } = useCashBankMutations(company?.id);

  const [txOpen, setTxOpen] = useState(false);
  const [txType, setTxType] = useState("DEPOSIT");
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const [reconOpen, setReconOpen] = useState(false);
  const [statementDate, setStatementDate] = useState(new Date().toISOString().slice(0, 10));
  const [statementBalance, setStatementBalance] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (!account) return <EmptyState icon={Landmark} title="Loading…" />;

  const handleAddTx = async (e: FormEvent) => {
    e.preventDefault();
    if (!cashAccountId || !company) return;
    try {
      await recordTransaction.mutateAsync({
        companyId: company.id, cashAccountId, transactionDate: new Date().toISOString().slice(0, 10),
        transactionType: txType, direction, amount: Number(amount), currencyId: account.currency_id, description,
      });
      setTxOpen(false);
      setAmount(""); setDescription("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record transaction");
    }
  };

  const handleReconcile = async () => {
    if (!cashAccountId || !company) return;
    try {
      const recon = await createReconciliation.mutateAsync({
        companyId: company.id, cashAccountId, statementDate, statementBalance: Number(statementBalance), systemBalance: account.current_balance,
      });
      if (selected.size > 0) {
        await markReconciled.mutateAsync({ transactionIds: [...selected], reconciliationId: recon.id, cashAccountId });
      }
      await completeReconciliation.mutateAsync({ id: recon.id, cashAccountId });
      toast.success("Reconciliation completed");
      setReconOpen(false);
      setSelected(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reconcile");
    }
  };

  const difference = Number(statementBalance || 0) - account.current_balance;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">{account.name}</h1>
            <FinanceStatusBadge status={account.status} />
          </div>
          <p className="text-sm text-muted-foreground">{account.bank_name} {account.account_number_masked}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Current balance</p>
          <p className="text-2xl font-semibold text-foreground"><Money amount={account.current_balance} currencyId={account.currency_id} /></p>
        </div>
      </div>

      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4 pt-4">
          <Can permission={PERMISSIONS.FINANCE_BANK_CREATE}>
            <Dialog open={txOpen} onOpenChange={setTxOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5" />Record transaction</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Record transaction</DialogTitle></DialogHeader>
                <form onSubmit={handleAddTx} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Type</Label>
                      <Select value={txType} onValueChange={setTxType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{TX_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Direction</Label>
                      <Select value={direction} onValueChange={(v) => setDirection(v as "IN" | "OUT")}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="IN">In</SelectItem><SelectItem value="OUT">Out</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5"><Label>Amount</Label><Input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                  <DialogFooter><Button type="submit" disabled={recordTransaction.isPending}>{recordTransaction.isPending ? "Recording…" : "Record"}</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </Can>

          {!transactions || transactions.length === 0 ? (
            <EmptyState icon={Landmark} title="No transactions yet" />
          ) : (
            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader><TableRow><TableHead className="w-8" /><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead>In</TableHead><TableHead>Out</TableHead><TableHead>Reconciled</TableHead></TableRow></TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        {!t.reconciled && (
                          <Checkbox
                            checked={selected.has(t.id)}
                            onCheckedChange={(v) => setSelected((s) => { const next = new Set(s); if (v) next.add(t.id); else next.delete(t.id); return next; })}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{t.transaction_date}</TableCell>
                      <TableCell>{t.transaction_type.replace(/_/g, " ")}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">{t.description}</TableCell>
                      <TableCell>{t.direction === "IN" && <Money amount={t.amount} currencyId={t.currency_id} />}</TableCell>
                      <TableCell>{t.direction === "OUT" && <Money amount={t.amount} currencyId={t.currency_id} />}</TableCell>
                      <TableCell>{t.reconciled ? "Yes" : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="reconciliation" className="space-y-4 pt-4">
          <Can permission={PERMISSIONS.FINANCE_BANK_RECONCILE}>
            <Dialog open={reconOpen} onOpenChange={setReconOpen}>
              <DialogTrigger asChild><Button size="sm">New reconciliation</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Reconcile {account.name}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Statement date</Label><Input type="date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Statement balance</Label><Input type="number" step="0.01" value={statementBalance} onChange={(e) => setStatementBalance(e.target.value)} /></div>
                  </div>
                  <div className="rounded-md border border-border p-3 text-sm">
                    <p>System balance: <Money amount={account.current_balance} currencyId={account.currency_id} /></p>
                    <p>Difference: <Money amount={difference} currencyId={account.currency_id} /></p>
                    <p className="mt-1 text-xs text-muted-foreground">{selected.size} transaction(s) selected to mark reconciled.</p>
                  </div>
                  <DialogFooter><Button disabled={!statementBalance} onClick={handleReconcile}>Complete reconciliation</Button></DialogFooter>
                </div>
              </DialogContent>
            </Dialog>
          </Can>

          {!reconciliations || reconciliations.length === 0 ? (
            <EmptyState icon={Landmark} title="No reconciliations yet" />
          ) : (
            <Card>
              <CardHeader><CardTitle className="text-base">History</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Statement date</TableHead><TableHead>Statement balance</TableHead><TableHead>System balance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {reconciliations.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.statement_date}</TableCell>
                        <TableCell><Money amount={r.statement_balance} currencyId={account.currency_id} /></TableCell>
                        <TableCell><Money amount={r.system_balance} currencyId={account.currency_id} /></TableCell>
                        <TableCell><FinanceStatusBadge status={r.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

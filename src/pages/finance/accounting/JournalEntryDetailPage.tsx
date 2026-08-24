import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import {
  useJournalEntry, useJournalEntryLines, useJournalApprovals, useJournalEntryMutations, useChartOfAccounts,
} from "@/features/finance/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/shared/Money";
import { FinanceStatusBadge } from "@/components/shared/FinanceBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function JournalEntryDetailPage() {
  const { journalEntryId } = useParams<{ journalEntryId: string }>();
  const { company, hasPermission } = useCompany();
  const { data: je, isLoading } = useJournalEntry(journalEntryId);
  const { data: lines } = useJournalEntryLines(journalEntryId);
  const { data: approvals } = useJournalApprovals(journalEntryId);
  const { data: accounts } = useChartOfAccounts(company?.id);
  const { addLine, deleteLine, submitForApproval, post, voidEntry, reverse, decideApproval } = useJournalEntryMutations(company?.id);

  const [lineOpen, setLineOpen] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [lineDescription, setLineDescription] = useState("");
  const [side, setSide] = useState<"debit" | "credit">("debit");
  const [amount, setAmount] = useState("");
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reverseReason, setReverseReason] = useState("");

  if (isLoading || !je) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  }

  const postableAccounts = (accounts ?? []).filter((a) => !a.is_header && a.status === "ACTIVE");
  const isBalanced = Math.abs(je.total_debit - je.total_credit) < 0.01;
  const isDraft = je.status === "DRAFT";

  const handleAddLine = async (e: FormEvent) => {
    e.preventDefault();
    if (!journalEntryId) return;
    try {
      await addLine.mutateAsync({
        journalEntryId, lineNumber: (lines?.length ?? 0) + 1, accountId, description: lineDescription || null,
        debit: side === "debit" ? Number(amount) : 0, credit: side === "credit" ? Number(amount) : 0,
      });
      setLineOpen(false);
      setAccountId(""); setLineDescription(""); setAmount("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add line");
    }
  };

  const runAction = async (fn: () => Promise<unknown>, successMsg: string) => {
    try {
      await fn();
      toast.success(successMsg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">{je.journal_number}</h1>
            <FinanceStatusBadge status={je.status} />
          </div>
          <p className="text-sm text-muted-foreground">{je.description}</p>
        </div>
        <div className="flex gap-2">
          {isDraft && (
            <Can permission={PERMISSIONS.FINANCE_JOURNALS_CREATE}>
              <Button variant="outline" onClick={() => runAction(() => submitForApproval.mutateAsync(je.id), "Submitted for approval")}>
                Submit for approval
              </Button>
            </Can>
          )}
          {(je.status === "DRAFT" || je.status === "APPROVED") && (
            <Can permission={PERMISSIONS.FINANCE_JOURNALS_POST}>
              <Button disabled={!isBalanced} onClick={() => runAction(() => post.mutateAsync(je.id), "Journal entry posted")}>
                Post
              </Button>
            </Can>
          )}
          {["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(je.status) && (
            <Can permission={PERMISSIONS.FINANCE_JOURNALS_UPDATE}>
              <Button variant="ghost" onClick={() => runAction(() => voidEntry.mutateAsync({ id: je.id }), "Voided")}>
                Void
              </Button>
            </Can>
          )}
          {je.status === "POSTED" && (
            <Can permission={PERMISSIONS.FINANCE_JOURNALS_REVERSE}>
              <Dialog open={reverseOpen} onOpenChange={setReverseOpen}>
                <DialogTrigger asChild><Button variant="outline">Reverse</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Reverse {je.journal_number}</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-1.5"><Label>Reason</Label><Input required value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} /></div>
                    <DialogFooter>
                      <Button
                        onClick={() =>
                          runAction(async () => {
                            await reverse.mutateAsync({ id: je.id, reason: reverseReason });
                            setReverseOpen(false);
                          }, "Reversal posted")
                        }
                      >
                        Reverse
                      </Button>
                    </DialogFooter>
                  </div>
                </DialogContent>
              </Dialog>
            </Can>
          )}
        </div>
      </div>

      {!isBalanced && isDraft && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
          Not balanced yet: debits <Money amount={je.total_debit} currencyId={je.base_currency_id} />, credits <Money amount={je.total_credit} currencyId={je.base_currency_id} />
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Lines</CardTitle>
          {isDraft && (
            <Can permission={PERMISSIONS.FINANCE_JOURNALS_CREATE}>
              <Dialog open={lineOpen} onOpenChange={setLineOpen}>
                <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5" />Add line</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add line</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddLine} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Account</Label>
                      <Select value={accountId} onValueChange={setAccountId}>
                        <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                        <SelectContent>{postableAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} {a.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label>Description</Label><Input value={lineDescription} onChange={(e) => setLineDescription(e.target.value)} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Side</Label>
                        <Select value={side} onValueChange={(v) => setSide(v as "debit" | "credit")}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="debit">Debit</SelectItem><SelectItem value="credit">Credit</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5"><Label>Amount</Label><Input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                    </div>
                    <DialogFooter><Button type="submit" disabled={!accountId || addLine.isPending}>{addLine.isPending ? "Adding…" : "Add line"}</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </Can>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Account</TableHead><TableHead>Description</TableHead><TableHead>Debit</TableHead><TableHead>Credit</TableHead><TableHead className="w-10" /></TableRow>
            </TableHeader>
            <TableBody>
              {(lines ?? []).map((l) => {
                const account = (accounts ?? []).find((a) => a.id === l.account_id);
                return (
                  <TableRow key={l.id}>
                    <TableCell>{account ? `${account.code} ${account.name}` : l.account_id}</TableCell>
                    <TableCell className="text-muted-foreground">{l.description}</TableCell>
                    <TableCell>{l.debit > 0 && <Money amount={l.debit} currencyId={je.currency_id} />}</TableCell>
                    <TableCell>{l.credit > 0 && <Money amount={l.credit} currencyId={je.currency_id} />}</TableCell>
                    <TableCell>
                      {isDraft && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteLine.mutate({ id: l.id, journalEntryId: je.id })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {approvals && approvals.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Approvals</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Level</TableHead><TableHead>Required permission</TableHead><TableHead>Decision</TableHead><TableHead className="w-32" /></TableRow></TableHeader>
              <TableBody>
                {approvals.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.sequence}</TableCell>
                    <TableCell className="text-muted-foreground">{a.required_permission}</TableCell>
                    <TableCell><FinanceStatusBadge status={a.decision} /></TableCell>
                    <TableCell>
                      {a.decision === "PENDING" && hasPermission(a.required_permission) && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => decideApproval.mutate({ approvalId: a.id, journalEntryId: je.id, decision: "APPROVED" })}>Approve</Button>
                          <Button size="sm" variant="ghost" onClick={() => decideApproval.mutate({ approvalId: a.id, journalEntryId: je.id, decision: "REJECTED" })}>Reject</Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

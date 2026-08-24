import { useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { usePayrollRun, usePayrollItems, usePayrollMutations, useCashAccounts } from "@/features/finance/hooks";
import { useEmployees } from "@/features/hr/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/shared/Money";
import { FinanceStatusBadge } from "@/components/shared/FinanceBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function PayrollRunDetailPage() {
  const { payrollRunId } = useParams<{ payrollRunId: string }>();
  const { company } = useCompany();
  const { data: run, isLoading } = usePayrollRun(payrollRunId);
  const { data: items } = usePayrollItems(payrollRunId);
  const { data: employees } = useEmployees(company?.id);
  const { data: cashAccounts } = useCashAccounts(company?.id);
  const { updateItem, calculateItem, approve, pay } = usePayrollMutations(company?.id);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [overtimePay, setOvertimePay] = useState("");
  const [bonuses, setBonuses] = useState("");
  const [otherDeductions, setOtherDeductions] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [cashAccountId, setCashAccountId] = useState("");

  if (isLoading || !run) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  }

  const runAction = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast.success(msg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  const saveItem = async (id: string) => {
    try {
      await updateItem.mutateAsync({
        id, runId: run.id,
        patch: { overtimePay: Number(overtimePay), bonuses: Number(bonuses), otherDeductions: Number(otherDeductions) },
      });
      await calculateItem.mutateAsync({ id, runId: run.id });
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update line");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">Payroll Run</h1>
            <FinanceStatusBadge status={run.status} />
          </div>
          <p className="text-sm text-muted-foreground">{run.run_type === "THIRTEENTH_MONTH" ? "13th Month Pay" : "Regular"}</p>
        </div>
        <div className="flex gap-2">
          {(run.status === "PROCESSING" || run.status === "REVIEW") && (
            <Can permission={PERMISSIONS.FINANCE_PAYROLL_APPROVE}>
              <Button onClick={() => runAction(() => approve.mutateAsync(run.id), "Payroll approved")}>Approve</Button>
            </Can>
          )}
          {run.status === "APPROVED" && (
            <Can permission={PERMISSIONS.FINANCE_PAYROLL_PAY}>
              <Dialog open={payOpen} onOpenChange={setPayOpen}>
                <DialogTrigger asChild><Button>Pay</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Pay payroll</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <Select value={cashAccountId} onValueChange={setCashAccountId}>
                      <SelectTrigger><SelectValue placeholder="Select cash/bank account" /></SelectTrigger>
                      <SelectContent>{(cashAccounts ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <DialogFooter>
                      <Button
                        disabled={!cashAccountId || pay.isPending}
                        onClick={() => runAction(async () => { await pay.mutateAsync({ id: run.id, cashAccountId }); setPayOpen(false); }, "Payroll paid")}
                      >
                        {pay.isPending ? "Paying…" : "Pay"}
                      </Button>
                    </DialogFooter>
                  </div>
                </DialogContent>
              </Dialog>
            </Can>
          )}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Employees</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead><TableHead>Basic</TableHead><TableHead>Allowances</TableHead>
                <TableHead>OT hours</TableHead><TableHead>OT pay</TableHead><TableHead>Bonuses</TableHead>
                <TableHead>Deductions</TableHead><TableHead>Net pay</TableHead><TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(items ?? []).map((it) => {
                const emp = (employees ?? []).find((e) => e.id === it.employee_id);
                const isEditing = editingId === it.id;
                return (
                  <TableRow key={it.id}>
                    <TableCell>{emp ? `${emp.first_name} ${emp.last_name}` : it.employee_id}</TableCell>
                    <TableCell><Money amount={it.basic_salary} currencyId={run.currency_id} /></TableCell>
                    <TableCell><Money amount={it.allowances} currencyId={run.currency_id} /></TableCell>
                    <TableCell className="text-muted-foreground">{it.overtime_hours}</TableCell>
                    <TableCell>{isEditing ? <Input className="h-7 w-24" type="number" value={overtimePay} onChange={(e) => setOvertimePay(e.target.value)} /> : <Money amount={it.overtime_pay} currencyId={run.currency_id} />}</TableCell>
                    <TableCell>{isEditing ? <Input className="h-7 w-24" type="number" value={bonuses} onChange={(e) => setBonuses(e.target.value)} /> : <Money amount={it.bonuses} currencyId={run.currency_id} />}</TableCell>
                    <TableCell>{isEditing ? <Input className="h-7 w-24" type="number" value={otherDeductions} onChange={(e) => setOtherDeductions(e.target.value)} /> : <Money amount={it.total_deductions} currencyId={run.currency_id} />}</TableCell>
                    <TableCell className="font-medium"><Money amount={it.net_pay} currencyId={run.currency_id} /></TableCell>
                    <TableCell>
                      {run.status === "PROCESSING" || run.status === "REVIEW" ? (
                        isEditing ? (
                          <Button size="sm" onClick={() => saveItem(it.id)}>Save</Button>
                        ) : (
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => { setEditingId(it.id); setOvertimePay(String(it.overtime_pay)); setBonuses(String(it.bonuses)); setOtherDeductions(String(it.other_deductions)); }}
                          >
                            Edit
                          </Button>
                        )
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell colSpan={6} />
                <TableCell className="font-semibold"><Money amount={run.total_net_pay} currencyId={run.currency_id} /></TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

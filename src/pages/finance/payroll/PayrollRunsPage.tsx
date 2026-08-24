import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Wallet, Plus } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { usePayrollRuns, usePayrollMutations } from "@/features/finance/hooks";
import { usePayrollPeriods } from "@/features/hr/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { FinanceStatusBadge } from "@/components/shared/FinanceBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function PayrollRunsPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { data: runs, isLoading } = usePayrollRuns(company?.id);
  const { data: periods } = usePayrollPeriods(company?.id);
  const { generate } = usePayrollMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [periodId, setPeriodId] = useState("");
  const [runType, setRunType] = useState<"REGULAR" | "THIRTEENTH_MONTH">("REGULAR");

  const handleGenerate = async () => {
    try {
      const runId = await generate.mutateAsync({ payrollPeriodId: periodId, runType });
      toast.success("Payroll run generated");
      setOpen(false);
      window.location.href = `/c/${companySlug}/finance/payroll/${runId}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate payroll run");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Payroll</h1>
          <p className="text-sm text-muted-foreground">{runs?.length ?? 0} payroll runs</p>
        </div>
        <Can permission={PERMISSIONS.FINANCE_PAYROLL_PROCESS}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" />Generate payroll run</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Generate payroll run</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Select value={periodId} onValueChange={setPeriodId}>
                  <SelectTrigger><SelectValue placeholder="Select payroll period" /></SelectTrigger>
                  <SelectContent>{(periods ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.period_name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={runType} onValueChange={(v) => setRunType(v as "REGULAR" | "THIRTEENTH_MONTH")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="REGULAR">Regular</SelectItem><SelectItem value="THIRTEENTH_MONTH">13th Month Pay</SelectItem></SelectContent>
                </Select>
                <DialogFooter><Button disabled={!periodId || generate.isPending} onClick={handleGenerate}>{generate.isPending ? "Generating…" : "Generate"}</Button></DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !runs || runs.length === 0 ? (
          <EmptyState icon={Wallet} title="No payroll runs yet" />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Type</TableHead><TableHead>Gross pay</TableHead><TableHead>Net pay</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {runs.map((r) => {
                const period = (periods ?? []).find((p) => p.id === r.payroll_period_id);
                return (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => (window.location.href = `/c/${companySlug}/finance/payroll/${r.id}`)}>
                    <TableCell><Link to={`/c/${companySlug}/finance/payroll/${r.id}`} className="font-medium text-foreground hover:underline">{period?.period_name ?? r.payroll_period_id}</Link></TableCell>
                    <TableCell className="text-muted-foreground">{r.run_type === "THIRTEENTH_MONTH" ? "13th Month" : "Regular"}</TableCell>
                    <TableCell><Money amount={r.total_gross_pay} currencyId={r.currency_id} /></TableCell>
                    <TableCell className="font-medium"><Money amount={r.total_net_pay} currencyId={r.currency_id} /></TableCell>
                    <TableCell><FinanceStatusBadge status={r.status} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { usePayrollPeriods, usePayrollPeriodMutations } from "@/features/hr/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PayrollPeriodStatusBadge } from "@/components/shared/HrBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

const NEXT_STATUS: Record<string, string | null> = {
  DRAFT: "OPEN", OPEN: "PROCESSING", PROCESSING: "REVIEW", REVIEW: "APPROVED", APPROVED: "PAID", PAID: "CLOSED", CLOSED: null,
};

export default function PayrollPeriodsPage() {
  const { company } = useCompany();
  const { data: periods, isLoading } = usePayrollPeriods(company?.id);
  const { create, setStatus } = usePayrollPeriodMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [periodName, setPeriodName] = useState("");
  const [frequency, setFrequency] = useState("MONTHLY");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [payDate, setPayDate] = useState("");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    try {
      await create.mutateAsync({ companyId: company.id, periodName, frequency: frequency as never, startDate, endDate, payDate: payDate || null });
      toast.success("Payroll period created");
      setOpen(false); setPeriodName(""); setStartDate(""); setEndDate(""); setPayDate("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create payroll period");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Payroll</h1>
          <p className="text-sm text-muted-foreground">Payroll preparation only -- full processing is a Finance-phase integration point</p>
        </div>
        <Can permission={PERMISSIONS.HR_PAYROLL_CREATE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>+ New period</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New payroll period</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1.5"><Label>Period name</Label><Input required value={periodName} onChange={(e) => setPeriodName(e.target.value)} placeholder="e.g. August 2026" /></div>
                <div className="space-y-1.5">
                  <Label>Frequency</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["MONTHLY", "BIWEEKLY", "WEEKLY"].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Start date</Label><Input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>End date</Label><Input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
                </div>
                <div className="space-y-1.5"><Label>Pay date</Label><Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !periods || periods.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No data available.</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Frequency</TableHead><TableHead>Dates</TableHead><TableHead>Pay Date</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {periods.map((p) => {
                const next = NEXT_STATUS[p.status];
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.period_name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.frequency}</TableCell>
                    <TableCell className="text-muted-foreground">{p.start_date} → {p.end_date}</TableCell>
                    <TableCell className="text-muted-foreground">{p.pay_date ?? "—"}</TableCell>
                    <TableCell><PayrollPeriodStatusBadge status={p.status} /></TableCell>
                    <TableCell>
                      {next && (
                        <Can permission={[PERMISSIONS.HR_PAYROLL_UPDATE, PERMISSIONS.HR_PAYROLL_APPROVE]}>
                          <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: p.id, status: next as never })}>Move to {next}</Button>
                        </Can>
                      )}
                    </TableCell>
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

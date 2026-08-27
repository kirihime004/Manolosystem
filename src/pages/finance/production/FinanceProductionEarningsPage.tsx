import { useState } from "react";
import { toast } from "sonner";
import { Banknote } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useEmployees } from "@/features/hr/hooks";
import { useTasks, useAllWorkEarnings, useProductionWorkMutations } from "@/features/production/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { ProductionStatusBadge } from "@/components/shared/ProductionBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { getErrorMessage } from "@/lib/errors";

// Every company-wide approved work item Finance can act on. PAYABLE is
// the "ready to send to Finance" queue; SENT_TO_FINANCE/IN_PAYROLL/PAID
// are read-only history here -- pulling SENT_TO_FINANCE items into a
// specific payroll run's line happens from that run's own detail page
// (Payroll > a run > Add production earnings), since the action needs a
// payroll item to attach to, not just a company-wide list.
export default function FinanceProductionEarningsPage() {
  const { company } = useCompany();
  const { data: employees } = useEmployees(company?.id);
  const { data: tasks } = useTasks(company?.id);
  const { data: earnings, isLoading } = useAllWorkEarnings(company?.id, ["PAYABLE", "SENT_TO_FINANCE", "IN_PAYROLL", "PAID"]);
  const { sendToFinance } = useProductionWorkMutations(company?.id);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const employeeMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));
  const taskMap = new Map((tasks ?? []).map((t) => [t.id, t.name]));

  const byStatus = (statuses: string[]) => (earnings ?? []).filter((e) => statuses.includes(e.status));

  const toggle = (id: string) => setSelected((s) => { const next = new Set(s); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const handleSend = async () => {
    try {
      await sendToFinance.mutateAsync([...selected]);
      toast.success(`${selected.size} item(s) sent to Finance`);
      setSelected(new Set());
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to send to Finance"));
    }
  };

  const renderTable = (rows: typeof earnings, selectable: boolean) => (
    <div className="rounded-lg border border-border bg-card">
      {isLoading ? (
        <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : !rows || rows.length === 0 ? (
        <EmptyState icon={Banknote} title="Nothing here" description="No production earnings in this status." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && <TableHead className="w-10" />}
              <TableHead>Employee</TableHead><TableHead>Task</TableHead><TableHead>Quantity</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Approved</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.id}>
                {selectable && <TableCell><Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggle(e.id)} /></TableCell>}
                <TableCell className="font-medium">{employeeMap.get(e.employee_id) ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{taskMap.get(e.task_id) ?? "—"}</TableCell>
                <TableCell>{e.approved_quantity ?? e.requested_quantity}</TableCell>
                <TableCell><Money amount={e.approved_amount ?? e.requested_amount} currencyId={e.currency_id} /></TableCell>
                <TableCell><ProductionStatusBadge status={e.status} /></TableCell>
                <TableCell className="text-muted-foreground text-xs">{e.approved_at ? new Date(e.approved_at).toLocaleDateString() : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Production Earnings</h1>
        <p className="text-sm text-muted-foreground">Approved production work, ready for payroll</p>
      </div>

      <Tabs defaultValue="payable">
        <TabsList>
          <TabsTrigger value="payable">Payable</TabsTrigger>
          <TabsTrigger value="sent">Sent to Finance</TabsTrigger>
          <TabsTrigger value="in-payroll">In Payroll</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
        </TabsList>

        <TabsContent value="payable" className="space-y-3 pt-4">
          <Can permission={PERMISSIONS.FINANCE_PAYROLL_PROCESS}>
            <div className="flex justify-end">
              <Button size="sm" disabled={selected.size === 0 || sendToFinance.isPending} onClick={handleSend}>
                {sendToFinance.isPending ? "Sending…" : `Send ${selected.size || ""} to Finance`}
              </Button>
            </div>
          </Can>
          {renderTable(byStatus(["PAYABLE"]), true)}
        </TabsContent>
        <TabsContent value="sent" className="pt-4">{renderTable(byStatus(["SENT_TO_FINANCE"]), false)}</TabsContent>
        <TabsContent value="in-payroll" className="pt-4">{renderTable(byStatus(["IN_PAYROLL"]), false)}</TabsContent>
        <TabsContent value="paid" className="pt-4">{renderTable(byStatus(["PAID"]), false)}</TabsContent>
      </Tabs>
    </div>
  );
}

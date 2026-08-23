import { Link, useParams } from "react-router-dom";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAllDeductions } from "@/features/hr/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/shared/Money";

export default function DeductionsPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { data: deductions, isLoading } = useAllDeductions(company?.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Deductions</h1>
        <p className="text-sm text-muted-foreground">{deductions?.length ?? 0} deduction records. HR-side reference data -- payroll calculation is a Finance-phase integration point.</p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !deductions || deductions.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No data available.</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {deductions.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <Link to={`/c/${companySlug}/hr/employees/${d.employee_id}`} className="font-medium hover:underline">
                      {d.employees.first_name} {d.employees.last_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{d.deduction_type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{d.description ?? "—"}</TableCell>
                  <TableCell>{d.currency_id ? <Money amount={d.amount} currencyId={d.currency_id} /> : d.amount}</TableCell>
                  <TableCell className="text-muted-foreground">{d.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

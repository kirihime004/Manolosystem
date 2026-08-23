import { Link, useParams } from "react-router-dom";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAllBenefits } from "@/features/hr/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/shared/Money";

export default function BenefitsPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { data: benefits, isLoading } = useAllBenefits(company?.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Benefits</h1>
        <p className="text-sm text-muted-foreground">{benefits?.length ?? 0} benefit enrollments. Manage per employee from their profile.</p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !benefits || benefits.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No data available.</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Type</TableHead><TableHead>Provider</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {benefits.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link to={`/c/${companySlug}/hr/employees/${b.employee_id}`} className="font-medium hover:underline">
                      {b.employees.first_name} {b.employees.last_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{b.benefit_type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{b.provider ?? "—"}</TableCell>
                  <TableCell>{b.amount != null && b.currency_id ? <Money amount={b.amount} currencyId={b.currency_id} /> : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{b.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

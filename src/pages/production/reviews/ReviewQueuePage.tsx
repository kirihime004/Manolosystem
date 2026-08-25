import { Link, useParams } from "react-router-dom";
import { GitBranch } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { usePendingReviewVersions, useProjects } from "@/features/production/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";

// A single company-wide "what needs my eyes" queue -- every version still
// PENDING_REVIEW, whether attached to a shot or an asset. Each row links
// straight to the shot/asset detail page where the review decision
// itself is made, rather than duplicating that UI here.
export default function ReviewQueuePage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { data: versions, isLoading } = usePendingReviewVersions(company?.id);
  const { data: projects } = useProjects(company?.id);
  const projectMap = new Map((projects ?? []).map((p) => [p.id, p.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Review Queue</h1>
        <p className="text-sm text-muted-foreground">Versions awaiting a review decision</p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !versions || versions.length === 0 ? (
          <EmptyState icon={GitBranch} title="Nothing pending" description="Every submitted version has been reviewed." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Project</TableHead><TableHead>Version</TableHead><TableHead>Submitted</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {versions.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="text-muted-foreground">{projectMap.get(v.project_id) ?? "—"}</TableCell>
                  <TableCell className="font-medium">v{v.version_number} {v.name ? `— ${v.name}` : ""}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(v.submitted_at).toLocaleString()}</TableCell>
                  <TableCell>
                    {v.shot_id && <Link className="text-sm text-primary hover:underline" to={`/c/${companySlug}/production/shots/${v.shot_id}`}>Open shot</Link>}
                    {v.asset_id && <Link className="text-sm text-primary hover:underline" to={`/c/${companySlug}/production/assets/${v.asset_id}`}>Open asset</Link>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

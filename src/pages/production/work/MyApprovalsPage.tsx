import { useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, Clock, AlertCircle, ClipboardCheck } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useMyEmployeeRecord } from "@/features/hr/hooks";
import { useMyReviews, useVersionsByIds, useMyReviewDecision, useProjects } from "@/features/production/hooks";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProductionStatusBadge } from "@/components/shared/ProductionBadges";

const FILTERS = [
  { key: "__all__", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "CHANGES_REQUESTED", label: "Changes Requested" },
  { key: "APPROVED", label: "Approved" },
] as const;

export default function MyApprovalsPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { user } = useAuth();
  const { data: myEmployee } = useMyEmployeeRecord(company?.id, user?.id);
  const { data: reviews, isLoading } = useMyReviews(myEmployee?.id);
  const versionIds = [...new Set((reviews ?? []).map((r) => r.version_id))];
  const { data: versions } = useVersionsByIds(versionIds);
  const versionMap = new Map((versions ?? []).map((v) => [v.id, v]));
  const { data: projects } = useProjects(company?.id);
  const projectMap = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const decide = useMyReviewDecision(myEmployee?.id);

  const [statusFilter, setStatusFilter] = useState<(typeof FILTERS)[number]["key"]>("__all__");
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const counts = {
    pending: (reviews ?? []).filter((r) => r.decision === "PENDING").length,
    approved: (reviews ?? []).filter((r) => r.decision === "APPROVED").length,
    changes: (reviews ?? []).filter((r) => r.decision === "CHANGES_REQUESTED").length,
    total: reviews?.length ?? 0,
  };
  const filtered = (reviews ?? []).filter((r) => statusFilter === "__all__" || r.decision === statusFilter);
  const effectiveSelectedId = selectedReviewId ?? filtered[0]?.id ?? null;
  const selectedReview = (reviews ?? []).find((r) => r.id === effectiveSelectedId) ?? null;
  const selectedVersion = selectedReview ? versionMap.get(selectedReview.version_id) : null;

  const handleDecide = async (decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED") => {
    if (!selectedReview) return;
    try {
      await decide.mutateAsync({ id: selectedReview.id, decision, comment: comment || null });
      toast.success(decision === "APPROVED" ? "Approved" : decision === "REJECTED" ? "Rejected" : "Changes requested");
      setComment("");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to record decision"); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">My Approvals</h1>
        <p className="text-sm text-muted-foreground">Review and approve work submitted to you across every project</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Pending Review</CardDescription><Clock className="h-4 w-4 text-amber-500" /></CardHeader>
          <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{counts.pending}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Approved</CardDescription><CheckCircle2 className="h-4 w-4 text-emerald-500" /></CardHeader>
          <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{counts.approved}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Changes Requested</CardDescription><AlertCircle className="h-4 w-4 text-blue-500" /></CardHeader>
          <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{counts.changes}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Total</CardDescription><ClipboardCheck className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{counts.total}</div></CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button key={f.key} size="sm" variant={statusFilter === f.key ? "default" : "outline"} onClick={() => setStatusFilter(f.key)}>{f.label}</Button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nothing to review" description="Versions submitted to you for review across any project will show up here." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-card lg:col-span-2">
            <Table>
              <TableHeader><TableRow><TableHead>Version</TableHead><TableHead>Project</TableHead><TableHead>Submitted</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const v = versionMap.get(r.version_id);
                  return (
                    <TableRow key={r.id} className={`cursor-pointer ${effectiveSelectedId === r.id ? "bg-muted/50" : ""}`} onClick={() => { setSelectedReviewId(r.id); setComment(""); }}>
                      <TableCell className="font-medium text-foreground">{v ? `v${v.version_number}${v.name ? ` — ${v.name}` : ""}` : "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{v ? projectMap.get(v.project_id) ?? "—" : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{v ? new Date(v.submitted_at).toLocaleDateString() : "—"}</TableCell>
                      <TableCell><ProductionStatusBadge status={r.decision} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <Card className="h-fit lg:sticky lg:top-4">
            <CardContent className="space-y-3 pt-6">
              {!selectedReview || !selectedVersion ? (
                <p className="text-xs text-muted-foreground">Select an item to review.</p>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-semibold text-foreground">v{selectedVersion.version_number}{selectedVersion.name ? ` — ${selectedVersion.name}` : ""}</p>
                    <p className="text-xs text-muted-foreground">{projectMap.get(selectedVersion.project_id) ?? "—"}</p>
                  </div>
                  <ProductionStatusBadge status={selectedReview.decision} />
                  {selectedVersion.description && <p className="text-xs text-muted-foreground">{selectedVersion.description}</p>}
                  {selectedReview.decision === "PENDING" ? (
                    <>
                      <Textarea placeholder="Add a comment (optional)" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
                      <div className="grid grid-cols-2 gap-2">
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleDecide("APPROVED")} disabled={decide.isPending}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => handleDecide("CHANGES_REQUESTED")} disabled={decide.isPending}>Request Changes</Button>
                      </div>
                      <Button size="sm" variant="ghost" className="w-full text-red-600 dark:text-red-400" onClick={() => handleDecide("REJECTED")} disabled={decide.isPending}>Reject</Button>
                    </>
                  ) : (
                    selectedReview.comment && (
                      <div className="border-t border-border pt-3">
                        <p className="text-xs font-semibold text-foreground">Comment</p>
                        <p className="text-xs text-muted-foreground">{selectedReview.comment}</p>
                      </div>
                    )
                  )}
                  {(selectedVersion.shot_id || selectedVersion.asset_id) && (
                    <Button variant="ghost" size="sm" className="w-full" asChild>
                      <a href={`/c/${companySlug}/production/${selectedVersion.shot_id ? `shots/${selectedVersion.shot_id}` : `assets/${selectedVersion.asset_id}`}`}>Open in context</a>
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

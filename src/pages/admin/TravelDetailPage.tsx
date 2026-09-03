import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { useTravelRequest, useTravelDocuments, useTravelApprovals, useTravelRequestMutations } from "@/features/admin/hooks";
import { getAdminDocumentUrl } from "@/features/admin/adminDocumentsApi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { EmptyState } from "@/components/shared/EmptyState";
import { AdminStatusBadge } from "@/components/shared/AdminBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

const NEXT_LABEL: Record<string, string> = {
  SUBMITTED: "Manager approve", MANAGER_APPROVED: "Admin review", ADMIN_REVIEW: "Finance review", FINANCE_REVIEW: "Give final approval",
};

export default function TravelDetailPage() {
  const { travelRequestId } = useParams<{ travelRequestId: string }>();
  const { data: request, isLoading } = useTravelRequest(travelRequestId);
  const { data: documents } = useTravelDocuments(travelRequestId);
  const { data: approvals } = useTravelApprovals(travelRequestId);
  const mutations = useTravelRequestMutations(request?.company_id, travelRequestId);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!request) return <ErrorScreen title="Travel request not found" description="This request does not exist or you do not have access." />;

  const runAction = async (fn: () => Promise<unknown>, successMsg: string) => {
    try {
      await fn();
      toast.success(successMsg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  const handleDownload = async (path: string) => {
    try {
      const url = await getAdminDocumentUrl(path);
      window.open(url, "_blank");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open document");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{request.request_number}</h1>
          <p className="text-sm text-muted-foreground">{request.destination} · {request.departure_date} – {request.return_date}</p>
        </div>
        <AdminStatusBadge status={request.status} />
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-6 text-sm sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Purpose</p><p className="font-medium text-foreground">{request.purpose}</p></div>
          <div><p className="text-xs text-muted-foreground">Type</p><p className="font-medium text-foreground">{request.travel_type}</p></div>
          <div><p className="text-xs text-muted-foreground">Estimated cost</p><p className="font-medium text-foreground">{request.estimated_cost ?? "—"}</p></div>
          {request.flight_details && <div><p className="text-xs text-muted-foreground">Flight</p><p className="font-medium text-foreground">{request.flight_details}</p></div>}
          {request.hotel_details && <div><p className="text-xs text-muted-foreground">Hotel</p><p className="font-medium text-foreground">{request.hotel_details}</p></div>}
          {request.transportation_details && <div><p className="text-xs text-muted-foreground">Transportation</p><p className="font-medium text-foreground">{request.transportation_details}</p></div>}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Can permission={PERMISSIONS.ADMIN_TRAVEL_APPROVE}>
          {NEXT_LABEL[request.status] && (
            <Button size="sm" onClick={() => runAction(() => mutations.advance.mutateAsync(request.id), "Advanced")}>{NEXT_LABEL[request.status]}</Button>
          )}
          {["SUBMITTED", "MANAGER_APPROVED", "ADMIN_REVIEW", "FINANCE_REVIEW"].includes(request.status) && (
            <Button size="sm" variant="ghost" onClick={() => runAction(() => mutations.reject.mutateAsync({ id: request.id }), "Rejected")}>Reject</Button>
          )}
        </Can>
        <Can permission={PERMISSIONS.ADMIN_TRAVEL_MANAGE}>
          {request.status === "APPROVED" && (
            <Button size="sm" variant="outline" onClick={() => runAction(() => mutations.book.mutateAsync({ id: request.id, details: {} }), "Marked booked")}>Mark booked</Button>
          )}
          {request.status === "BOOKED" && (
            <Button size="sm" variant="outline" onClick={() => runAction(() => mutations.start.mutateAsync(request.id), "Travel started")}>Start travel</Button>
          )}
          {request.status === "IN_PROGRESS" && (
            <Button size="sm" variant="outline" onClick={() => runAction(() => mutations.complete.mutateAsync(request.id), "Travel completed")}>Complete travel</Button>
          )}
          {!["COMPLETED", "CANCELLED", "REJECTED"].includes(request.status) && (
            <Button size="sm" variant="ghost" onClick={() => runAction(() => mutations.cancel.mutateAsync(request.id), "Cancelled")}>Cancel</Button>
          )}
        </Can>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Approvals</h3>
        <div className="rounded-lg border border-border bg-card">
          {!approvals || approvals.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No approval chain on record.</p>
          ) : (
            <ul className="divide-y divide-border">
              {approvals.map((a) => (
                <li key={a.id} className="flex items-center justify-between p-3 text-sm">
                  <span className="text-muted-foreground">{a.required_permission}</span>
                  <div className="flex items-center gap-2">
                    <AdminStatusBadge status={a.decision} />
                    {a.decided_at && <span className="text-xs text-muted-foreground">{new Date(a.decided_at).toLocaleDateString()}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Documents</h3>
        <div className="rounded-lg border border-border bg-card">
          {!documents || documents.length === 0 ? (
            <EmptyState icon={FileText} title="No documents yet" />
          ) : (
            <ul className="divide-y divide-border">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{d.title}</p>
                    <p className="text-xs text-muted-foreground">{d.document_type.replace(/_/g, " ")}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(d.storage_path)}>Download</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { useHrRequest, useHrRequestComments, useHrRequestMutations, useEmployee } from "@/features/hr/hooks";
import { useCompany } from "@/lib/tenant/useCompany";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { HrRequestStatusBadge } from "@/components/shared/HrBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function HrRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const { company } = useCompany();
  const { data: request, isLoading } = useHrRequest(requestId);
  const { data: comments } = useHrRequestComments(requestId);
  const { data: employee } = useEmployee(request?.employee_id);
  const { transition, addComment } = useHrRequestMutations(company?.id);

  const [comment, setComment] = useState("");

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!request) return <ErrorScreen title="Request not found" description="This HR request does not exist or you do not have access." />;

  const handleComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    try {
      await addComment.mutateAsync({ id: request.id, comment });
      setComment("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add comment");
    }
  };

  const doTransition = async (newStatus: typeof request.status) => {
    try {
      await transition.mutateAsync({ id: request.id, newStatus });
      toast.success(`Request ${newStatus.toLowerCase()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update request");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{request.request_number}</p>
          <h1 className="text-xl font-semibold text-foreground">{request.subject}</h1>
          <p className="text-sm text-muted-foreground">{employee ? `${employee.first_name} ${employee.last_name}` : "—"} · {request.request_type.replace(/_/g, " ")}</p>
        </div>
        <HrRequestStatusBadge status={request.status} />
      </div>

      {request.description && <Card><CardContent className="pt-6 text-sm text-foreground">{request.description}</CardContent></Card>}

      <Can permission={[PERMISSIONS.HR_REQUESTS_APPROVE, PERMISSIONS.HR_REQUESTS_REJECT]}>
        <div className="flex gap-2">
          {request.status === "SUBMITTED" && <Button size="sm" variant="outline" onClick={() => doTransition("UNDER_REVIEW")}>Start review</Button>}
          {(request.status === "SUBMITTED" || request.status === "UNDER_REVIEW") && (
            <>
              <Button size="sm" onClick={() => doTransition("APPROVED")}>Approve</Button>
              <Button size="sm" variant="ghost" onClick={() => doTransition("REJECTED")}>Reject</Button>
            </>
          )}
          {request.status === "APPROVED" && <Button size="sm" onClick={() => doTransition("COMPLETED")}>Mark completed</Button>}
        </div>
      </Can>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Comments</h3>
          {!comments || comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="rounded-md border border-border p-3 text-sm">
                  <p>{c.comment}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleComment} className="flex gap-2">
            <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…" />
            <Button type="submit" disabled={addComment.isPending}>Post</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

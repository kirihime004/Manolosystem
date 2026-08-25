import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useEmployee } from "@/features/hr/hooks";
import { useCompanyUsersList } from "@/features/company/settings/useCompanyUsers";
import {
  useAdminRequest, useAdminRequestComments, useAdminRequestApprovals, useAdminRequestHistory,
  useAdminRequestMutations, useAdminRequestCategories,
} from "@/features/admin/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { AdminStatusBadge, AdminPriorityBadge } from "@/components/shared/AdminBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function AdminRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const { company } = useCompany();
  const { user } = useAuth();
  const { data: request, isLoading } = useAdminRequest(requestId);
  const { data: comments } = useAdminRequestComments(requestId);
  const { data: approvals } = useAdminRequestApprovals(requestId);
  const { data: history } = useAdminRequestHistory(requestId);
  const { data: categories } = useAdminRequestCategories(company?.id);
  const { data: requester } = useEmployee(request?.requester_id);
  const { data: companyUsers } = useCompanyUsersList(company?.id);
  const mutations = useAdminRequestMutations(company?.id, requestId);

  const [comment, setComment] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!request) return <ErrorScreen title="Request not found" description="This request does not exist or you do not have access." />;

  const categoryName = request.category_id ? categories?.find((c) => c.id === request.category_id)?.name : null;
  const userMap = new Map((companyUsers ?? []).map((u) => [u.userId, `${u.profile?.first_name ?? ""} ${u.profile?.last_name ?? ""}`.trim() || u.email || "—"]));
  const assigneeName = request.assigned_to ? userMap.get(request.assigned_to) ?? "—" : null;

  const run = async (fn: () => Promise<unknown>, successMsg: string) => {
    try {
      await fn();
      toast.success(successMsg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  const handleComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !user) return;
    try {
      await mutations.addComment.mutateAsync({ companyId: company!.id, requestId: request.id, authorId: user.id, comment });
      setComment("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add comment");
    }
  };

  const handleAssign = async (e: FormEvent) => {
    e.preventDefault();
    if (!assigneeId) return;
    await run(() => mutations.assign.mutateAsync({ id: request.id, assignedTo: assigneeId }), "Request assigned");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{request.request_number}</p>
          <h1 className="text-xl font-semibold text-foreground">{request.subject}</h1>
          <p className="text-sm text-muted-foreground">
            {requester ? `${requester.first_name} ${requester.last_name}` : "—"}
            {categoryName ? ` · ${categoryName}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <AdminStatusBadge status={request.status} />
          <AdminPriorityBadge priority={request.priority} />
        </div>
      </div>

      {request.description && <Card><CardContent className="pt-6 text-sm text-foreground">{request.description}</CardContent></Card>}

      {assigneeName && (
        <p className="text-sm text-muted-foreground">Assigned to <span className="text-foreground">{assigneeName}</span></p>
      )}

      <div className="flex flex-wrap gap-2">
        {request.status === "DRAFT" && (
          <Button size="sm" onClick={() => run(() => mutations.submit.mutateAsync(request.id), "Request submitted")}>Submit</Button>
        )}

        <Can permission={PERMISSIONS.ADMIN_REQUESTS_UPDATE}>
          {request.status === "SUBMITTED" && (
            <Button size="sm" variant="outline" onClick={() => run(() => mutations.startReview.mutateAsync(request.id), "Review started")}>Start review</Button>
          )}
          {request.status === "UNDER_REVIEW" && (
            <Button size="sm" variant="outline" onClick={() => run(() => mutations.routeForApproval.mutateAsync(request.id), "Routed for approval")}>Route for approval</Button>
          )}
        </Can>

        <Can permission={PERMISSIONS.ADMIN_REQUESTS_APPROVE}>
          {(request.status === "UNDER_REVIEW" || request.status === "PENDING_APPROVAL") && (
            <Button size="sm" variant="ghost" onClick={() => run(() => mutations.reject.mutateAsync({ id: request.id }), "Request rejected")}>Reject</Button>
          )}
        </Can>

        <Can permission={PERMISSIONS.ADMIN_REQUESTS_ASSIGN}>
          {(request.status === "UNDER_REVIEW" || request.status === "APPROVED") && (
            <form onSubmit={handleAssign} className="flex items-center gap-2">
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Assign to…" /></SelectTrigger>
                <SelectContent>{(companyUsers ?? []).map((u) => <SelectItem key={u.userId} value={u.userId}>{userMap.get(u.userId)}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" type="submit" disabled={!assigneeId}>Assign</Button>
            </form>
          )}
        </Can>

        {request.status === "ASSIGNED" && (request.assigned_to === user?.id) && (
          <Button size="sm" onClick={() => run(() => mutations.startWork.mutateAsync(request.id), "Work started")}>Start work</Button>
        )}
        {request.status === "IN_PROGRESS" && (request.assigned_to === user?.id) && (
          <>
            <Button size="sm" variant="outline" onClick={() => run(() => mutations.markWaiting.mutateAsync({ id: request.id }), "Marked waiting")}>Mark waiting</Button>
            <Button size="sm" onClick={() => run(() => mutations.complete.mutateAsync(request.id), "Request completed")}>Mark completed</Button>
          </>
        )}
        {request.status === "WAITING" && (request.assigned_to === user?.id) && (
          <Button size="sm" onClick={() => run(() => mutations.complete.mutateAsync(request.id), "Request completed")}>Mark completed</Button>
        )}

        <Can permission={PERMISSIONS.ADMIN_REQUESTS_CLOSE}>
          {request.status === "COMPLETED" && (
            <Button size="sm" onClick={() => run(() => mutations.close.mutateAsync(request.id), "Request closed")}>Close request</Button>
          )}
        </Can>

        {["DRAFT", "SUBMITTED"].includes(request.status) && (
          <Button size="sm" variant="ghost" onClick={() => run(() => mutations.cancel.mutateAsync(request.id), "Request cancelled")}>Cancel</Button>
        )}
      </div>

      {approvals && approvals.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Approvals</h3>
            {approvals.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Step {a.sequence} — {a.required_permission}</span>
                <div className="flex items-center gap-2">
                  <AdminStatusBadge status={a.decision} />
                  <Can permission={PERMISSIONS.ADMIN_REQUESTS_APPROVE}>
                    {a.decision === "PENDING" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => run(() => mutations.decideApproval.mutateAsync({ approvalId: a.id, decision: "APPROVED" }), "Approved")}>Approve</Button>
                        <Button size="sm" variant="ghost" onClick={() => run(() => mutations.decideApproval.mutateAsync({ approvalId: a.id, decision: "REJECTED" }), "Rejected")}>Reject</Button>
                      </>
                    )}
                  </Can>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
            <Button type="submit" disabled={mutations.addComment.isPending}>Post</Button>
          </form>
        </CardContent>
      </Card>

      {history && history.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">History</h3>
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{h.event_type.replace(/_/g, " ")}{h.previous_status && h.new_status ? ` (${h.previous_status} → ${h.new_status})` : ""}</span>
                  <span>{new Date(h.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useTicket, useTicketMutations } from "@/features/it/tickets/hooks";
import { TicketConversation } from "@/features/it/tickets/components/TicketConversation";
import { TicketActivityFeed } from "@/features/it/tickets/components/TicketActivityFeed";
import { TicketSidebarActions } from "@/features/it/tickets/components/TicketSidebarActions";
import { TicketAttachmentsList } from "@/features/it/tickets/components/TicketAttachmentsList";
import { TicketPriorityBadge, TicketStatusBadge } from "@/components/shared/TicketBadges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { getErrorMessage } from "@/lib/errors";

function fullName(first?: string | null, last?: string | null) {
  const name = `${first ?? ""} ${last ?? ""}`.trim();
  return name || "—";
}

export default function TicketDetailPage() {
  const { companySlug, ticketId } = useParams<{ companySlug: string; ticketId: string }>();
  const navigate = useNavigate();
  const { data: ticket, isLoading } = useTicket(ticketId);
  const { remove } = useTicketMutations(ticketId);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = async () => {
    try {
      await remove.mutateAsync();
      toast.success("Ticket deleted");
      navigate(`/c/${companySlug}/it/tickets`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete ticket"));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <ErrorScreen
        title="Ticket not found"
        description="This ticket does not exist or you do not have access to it."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            {ticket.ticket_number}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">{ticket.subject}</h1>
            <TicketStatusBadge status={ticket.status} />
            <TicketPriorityBadge priority={ticket.priority} />
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {ticket.description || "No description provided."}
            </p>

            {ticket.attachments.length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Attachments</p>
                  <TicketAttachmentsList attachments={ticket.attachments} />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Tabs defaultValue="comments">
              <TabsList>
                <TabsTrigger value="comments">Comments</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
              <TabsContent value="comments" className="pt-4">
                <TicketConversation ticket={ticket} />
              </TabsContent>
              <TabsContent value="activity" className="pt-4">
                <TicketActivityFeed ticket={ticket} />
              </TabsContent>
            </Tabs>
          </CardHeader>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <DetailRow label="Requester" value={fullName(ticket.requester?.first_name, ticket.requester?.last_name)} />
            <DetailRow label="Department" value={ticket.requesterDepartment ?? "—"} />
            <DetailRow label="Category" value={ticket.category?.name ?? "—"} />
            <DetailRow label="Subcategory" value={ticket.subcategory?.name ?? "—"} />
            {ticket.asset && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Asset</span>
                <Link
                  to={`/c/${companySlug}/it/inventory/${ticket.asset.asset_code}`}
                  className="truncate font-medium text-primary hover:underline"
                >
                  {ticket.asset.asset_code} — {ticket.asset.name}
                </Link>
              </div>
            )}
            <DetailRow
              label="Assigned to"
              value={ticket.assignee ? fullName(ticket.assignee.first_name, ticket.assignee.last_name) : "Unassigned"}
            />
            <DetailRow label="Created" value={new Date(ticket.created_at).toLocaleString()} />
            {ticket.resolved_at && (
              <DetailRow label="Resolved" value={new Date(ticket.resolved_at).toLocaleString()} />
            )}
            {ticket.closed_at && (
              <DetailRow label="Closed" value={new Date(ticket.closed_at).toLocaleString()} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <TicketSidebarActions ticket={ticket} />
          </CardContent>
        </Card>

        <Can permission={PERMISSIONS.IT_TICKETS_DELETE}>
          <Card>
            <CardContent className="pt-6">
              <Button variant="destructive" size="sm" className="w-full" onClick={() => setDeleteOpen(true)}>
                Delete ticket
              </Button>
            </CardContent>
          </Card>
        </Can>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{ticket.subject}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the ticket and its comments, attachments, and history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium text-foreground">{value}</span>
    </div>
  );
}

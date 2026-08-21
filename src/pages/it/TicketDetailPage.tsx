import { useParams } from "react-router-dom";
import { Paperclip, Download } from "lucide-react";
import { toast } from "sonner";
import { useTicket } from "@/features/it/tickets/hooks";
import { getAttachmentSignedUrl } from "@/features/it/tickets/ticketApi";
import { TicketConversation } from "@/features/it/tickets/components/TicketConversation";
import { TicketActivityFeed } from "@/features/it/tickets/components/TicketActivityFeed";
import { TicketSidebarActions } from "@/features/it/tickets/components/TicketSidebarActions";
import { TicketPriorityBadge, TicketStatusBadge } from "@/components/shared/TicketBadges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/components/shared/ErrorScreen";

function fullName(first?: string | null, last?: string | null) {
  const name = `${first ?? ""} ${last ?? ""}`.trim();
  return name || "—";
}

export default function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { data: ticket, isLoading } = useTicket(ticketId);

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
                  {ticket.attachments.map((a) => (
                    <button
                      key={a.id}
                      onClick={async () => {
                        try {
                          const url = await getAttachmentSignedUrl(a.file_path);
                          window.open(url, "_blank", "noopener,noreferrer");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Failed to open attachment");
                        }
                      }}
                      className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="flex-1 truncate">{a.file_name}</span>
                      <Download className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  ))}
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
      </div>
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

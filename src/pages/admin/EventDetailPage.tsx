import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useEvent, useEventTasks, useEventMutations } from "@/features/admin/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { AdminStatusBadge } from "@/components/shared/AdminBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

const TASK_CATEGORIES = ["VENUE", "CATERING", "DECORATION", "TRANSPORTATION", "INVITATIONS", "EQUIPMENT", "SECURITY", "CLEANING", "OTHER"];

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { company } = useCompany();
  const { data: event, isLoading } = useEvent(eventId);
  const { data: tasks } = useEventTasks(eventId);
  const { createTask, updateTaskStatus, updateStatus } = useEventMutations(company?.id, eventId);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("VENUE");

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!event) return <ErrorScreen title="Event not found" description="This event does not exist or you do not have access." />;

  const handleAddTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!eventId) return;
    try {
      await createTask.mutateAsync({ companyId: company!.id, eventId, category, title });
      setOpen(false); setTitle("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add task");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{event.name}</h1>
          <p className="text-sm text-muted-foreground">{event.event_type.replace(/_/g, " ")} · {event.start_date} – {event.end_date}</p>
        </div>
        <AdminStatusBadge status={event.status} />
      </div>

      {event.description && <Card><CardContent className="pt-6 text-sm text-foreground">{event.description}</CardContent></Card>}

      <Can permission={PERMISSIONS.ADMIN_EVENTS_MANAGE}>
        <div className="flex gap-2">
          {event.status === "PLANNING" && <Button size="sm" onClick={() => updateStatus.mutate({ id: event.id, status: "CONFIRMED" })}>Confirm event</Button>}
          {event.status === "CONFIRMED" && <Button size="sm" onClick={() => updateStatus.mutate({ id: event.id, status: "COMPLETED" })}>Mark completed</Button>}
          {!["COMPLETED", "CANCELLED"].includes(event.status) && (
            <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: event.id, status: "CANCELLED" })}>Cancel event</Button>
          )}
        </div>
      </Can>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Tasks</h3>
            <Can permission={PERMISSIONS.ADMIN_EVENTS_MANAGE}>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button size="sm" variant="outline">+ Add task</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add event task</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddTask} className="space-y-3">
                    <div className="space-y-1.5"><Label>Title</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                    <div className="space-y-1.5">
                      <Label>Category</Label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{TASK_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <DialogFooter><Button type="submit" disabled={createTask.isPending}>Add task</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </Can>
          </div>
          {!tasks || tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks yet.</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <AdminStatusBadge status={t.status} />
                    <Can permission={PERMISSIONS.ADMIN_EVENTS_MANAGE}>
                      {t.status !== "COMPLETED" && (
                        <Button size="sm" variant="ghost" onClick={() => updateTaskStatus.mutate({ id: t.id, status: "COMPLETED" })}>Complete</Button>
                      )}
                    </Can>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

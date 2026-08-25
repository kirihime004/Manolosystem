import { useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useMyEmployeeRecord } from "@/features/hr/hooks";
import { useAdminRequests, useAdminRequestMutations, useAdminRequestCategories } from "@/features/admin/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminStatusBadge, AdminPriorityBadge } from "@/components/shared/AdminBadges";

export default function AdminRequestsListPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") ?? undefined;

  const { data: myEmployee } = useMyEmployeeRecord(company?.id, user?.id);
  const { data: requests, isLoading } = useAdminRequests(company?.id, { status: statusFilter });
  const { data: categories } = useAdminRequestCategories(company?.id);
  const { create, submit } = useAdminRequestMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [categoryId, setCategoryId] = useState<string>("");

  const categoryMap = new Map((categories ?? []).map((c) => [c.id, c.name]));

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!myEmployee) { toast.error("No employee record is linked to your account"); return; }
    try {
      const req = await create.mutateAsync({
        companyId: company!.id, requesterId: myEmployee.id, subject, description: description || null,
        priority, categoryId: categoryId || null,
      });
      await submit.mutateAsync(req.id);
      toast.success(`${req.request_number} submitted`);
      setOpen(false);
      setSubject(""); setDescription(""); setPriority("MEDIUM"); setCategoryId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit request");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Administrative Requests</h1>
          <p className="text-sm text-muted-foreground">Office chairs, meeting rooms, travel, maintenance, and other administrative services</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>+ New request</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New administrative request</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                  <SelectContent>{(categories ?? []).filter((c) => c.is_active).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Subject</Label><Input required value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Description</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <DialogFooter><Button type="submit" disabled={create.isPending || submit.isPending || !myEmployee}>Submit</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !requests || requests.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No requests yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead><TableHead>Subject</TableHead><TableHead>Category</TableHead>
                <TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/c/${companySlug}/admin/requests/${r.id}`)}>
                  <TableCell className="font-mono text-xs">{r.request_number}</TableCell>
                  <TableCell className="font-medium">{r.subject}</TableCell>
                  <TableCell className="text-muted-foreground">{r.category_id ? categoryMap.get(r.category_id) ?? "—" : "—"}</TableCell>
                  <TableCell><AdminPriorityBadge priority={r.priority} /></TableCell>
                  <TableCell><AdminStatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

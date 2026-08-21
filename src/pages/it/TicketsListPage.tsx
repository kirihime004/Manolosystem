import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus, Search, Ticket as TicketIcon } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useTickets, useTicketCategories, useCompanyMembers } from "@/features/it/tickets/hooks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { TicketPriorityBadge, TicketStatusBadge } from "@/components/shared/TicketBadges";
import type { TicketPriority, TicketStatus } from "@/types/database";

const STATUS_OPTIONS: TicketStatus[] = [
  "OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_USER", "WAITING_FOR_VENDOR", "RESOLVED", "CLOSED", "CANCELLED",
];
const PRIORITY_OPTIONS: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const PAGE_SIZE = 15;

function initials(first?: string | null, last?: string | null) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
}

export default function TicketsListPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [assignedTo, setAssignedTo] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { data: tickets, isLoading } = useTickets(company?.id, {
    search: search || undefined,
    status: status === "all" ? undefined : status,
    priority: priority === "all" ? undefined : priority,
    categoryId: categoryId === "all" ? undefined : categoryId,
    assignedTo: assignedTo === "all" ? undefined : assignedTo,
  });
  const { data: categoryData } = useTicketCategories(company?.id);
  const { data: members } = useCompanyMembers(company?.id);

  const paged = useMemo(
    () => (tickets ?? []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [tickets, page],
  );
  const totalPages = Math.max(1, Math.ceil((tickets?.length ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Tickets</h1>
          <p className="text-sm text-muted-foreground">{tickets?.length ?? 0} total</p>
        </div>
        <Link to={`/c/${companySlug}/it/tickets/new`}>
          <Button>
            <Plus className="h-4 w-4" />
            New ticket
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search subject or number…"
            className="pl-8"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={priority} onValueChange={(v) => { setPriority(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categoryData?.categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={assignedTo} onValueChange={(v) => { setAssignedTo(v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Assignee" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignees</SelectItem>
            {members?.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.first_name} {m.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : paged.length === 0 ? (
          <EmptyState icon={TicketIcon} title="No tickets found" description="Try adjusting your filters." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/c/${companySlug}/it/tickets/${t.id}`)}
                >
                  <TableCell className="font-mono text-xs font-medium">{t.ticket_number}</TableCell>
                  <TableCell className="max-w-64 truncate font-medium">{t.subject}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.requester ? `${t.requester.first_name ?? ""} ${t.requester.last_name ?? ""}`.trim() : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{t.category?.name ?? "—"}</TableCell>
                  <TableCell><TicketPriorityBadge priority={t.priority} /></TableCell>
                  <TableCell><TicketStatusBadge status={t.status} /></TableCell>
                  <TableCell>
                    {t.assignee ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{initials(t.assignee.first_name, t.assignee.last_name)}</AvatarFallback></Avatar>
                        <span className="text-muted-foreground">{t.assignee.first_name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

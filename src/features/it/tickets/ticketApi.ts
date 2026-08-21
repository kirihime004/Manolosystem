import { supabase } from "@/lib/supabase/client";
import type { Profile, Ticket, TicketCategory, TicketSubcategory } from "@/types/database";
import type { EnrichedTicket, TicketDetail, TicketFilters } from "@/features/it/tickets/types";

type MiniProfile = Pick<Profile, "id" | "first_name" | "last_name" | "avatar_url">;

async function fetchProfilesMap(userIds: string[]): Promise<Map<string, MiniProfile>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url")
    .in("id", unique);
  if (error) throw error;

  return new Map((data as MiniProfile[]).map((p) => [p.id, p]));
}

async function fetchCategoriesMap(companyId: string) {
  const [{ data: categories, error: catError }, { data: subcategories, error: subError }] =
    await Promise.all([
      supabase.from("ticket_categories").select("*").eq("company_id", companyId),
      supabase.from("ticket_subcategories").select("*").eq("company_id", companyId),
    ]);
  if (catError) throw catError;
  if (subError) throw subError;

  return {
    categories: new Map((categories as TicketCategory[]).map((c) => [c.id, c])),
    subcategories: new Map((subcategories as TicketSubcategory[]).map((s) => [s.id, s])),
  };
}

export interface TicketDashboardStats {
  open: number;
  assignedToMe: number;
  inProgress: number;
  waitingForUser: number;
  critical: number;
  overdue: number;
  resolvedToday: number;
  closedToday: number;
  resolved: number;
  closed: number;
  active: number;
  statusCounts: Partial<Record<string, number>>;
  priorityCounts: Partial<Record<string, number>>;
}

// Computed server-side (see get_ticket_dashboard_stats migration) instead of
// fetching every ticket and counting client-side -- the old approach meant
// downloading and re-enriching the company's entire ticket history just to
// render eight numbers, which stops scaling once there are a few hundred
// tickets. This is also naturally RLS-scoped: a caller without
// IT.TICKETS.VIEW transparently gets counts for just their own tickets.
export async function getDashboardStats(companyId: string): Promise<TicketDashboardStats> {
  const { data, error } = await supabase.rpc("get_ticket_dashboard_stats", { p_company_id: companyId });
  if (error) throw error;
  return data as unknown as TicketDashboardStats;
}

export interface MiniTicket {
  id: string;
  ticket_number: string;
  subject: string;
  status: Ticket["status"];
  priority: Ticket["priority"];
}

const MINI_TICKET_COLUMNS = "id, ticket_number, subject, status, priority";

export async function getRecentTickets(companyId: string, limit = 5): Promise<MiniTicket[]> {
  const { data, error } = await supabase
    .from("tickets")
    .select(MINI_TICKET_COLUMNS)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as MiniTicket[];
}

export async function getAssignedTickets(companyId: string, userId: string, limit = 5): Promise<MiniTicket[]> {
  const { data, error } = await supabase
    .from("tickets")
    .select(MINI_TICKET_COLUMNS)
    .eq("company_id", companyId)
    .eq("assigned_to", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as MiniTicket[];
}

export async function getCriticalTickets(companyId: string, limit = 5): Promise<MiniTicket[]> {
  const { data, error } = await supabase
    .from("tickets")
    .select(MINI_TICKET_COLUMNS)
    .eq("company_id", companyId)
    .eq("priority", "CRITICAL")
    .not("status", "in", "(RESOLVED,CLOSED,CANCELLED)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as MiniTicket[];
}

// Lightweight lookup for the dashboard's quick-search -- no profile/category
// enrichment, just enough to show a result and link to the ticket. RLS still
// scopes this to whatever tickets the caller can actually see.
export async function searchTickets(companyId: string, query: string, limit = 8): Promise<MiniTicket[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from("tickets")
    .select(MINI_TICKET_COLUMNS)
    .eq("company_id", companyId)
    .or(`subject.ilike.%${trimmed}%,ticket_number.ilike.%${trimmed}%`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as MiniTicket[];
}

export async function listTickets(
  companyId: string,
  filters: TicketFilters = {},
): Promise<EnrichedTicket[]> {
  let query = supabase.from("tickets").select("*").eq("company_id", companyId);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.assignedTo) query = query.eq("assigned_to", filters.assignedTo);
  if (filters.search) {
    query = query.or(`subject.ilike.%${filters.search}%,ticket_number.ilike.%${filters.search}%`);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;

  const tickets = data as Ticket[];
  const [profiles, { categories, subcategories }] = await Promise.all([
    fetchProfilesMap(tickets.flatMap((t) => [t.requester_id, t.assigned_to ?? ""])),
    fetchCategoriesMap(companyId),
  ]);

  return tickets.map((t) => ({
    ...t,
    requester: profiles.get(t.requester_id) ?? null,
    assignee: t.assigned_to ? profiles.get(t.assigned_to) ?? null : null,
    category: t.category_id ? categories.get(t.category_id) ?? null : null,
    subcategory: t.subcategory_id ? subcategories.get(t.subcategory_id) ?? null : null,
  }));
}

export async function getTicket(ticketId: string): Promise<TicketDetail | null> {
  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();
  if (error) throw error;
  if (!ticket) return null;

  const [commentsRes, attachmentsRes, assignmentsRes, historyRes, { categories, subcategories }] =
    await Promise.all([
      supabase.from("ticket_comments").select("*").eq("ticket_id", ticketId).order("created_at"),
      supabase.from("ticket_attachments").select("*").eq("ticket_id", ticketId).order("created_at"),
      supabase.from("ticket_assignments").select("*").eq("ticket_id", ticketId).order("created_at"),
      supabase.from("ticket_status_history").select("*").eq("ticket_id", ticketId).order("created_at"),
      fetchCategoriesMap(ticket.company_id),
    ]);

  if (commentsRes.error) throw commentsRes.error;
  if (attachmentsRes.error) throw attachmentsRes.error;
  if (assignmentsRes.error) throw assignmentsRes.error;
  if (historyRes.error) throw historyRes.error;

  const profiles = await fetchProfilesMap([
    ticket.requester_id,
    ticket.assigned_to ?? "",
    ...commentsRes.data.map((c) => c.author_id),
    ...attachmentsRes.data.map((a) => a.uploaded_by),
  ]);

  const { data: requesterMembership } = await supabase
    .from("company_users")
    .select("department_id, departments(name)")
    .eq("company_id", ticket.company_id)
    .eq("user_id", ticket.requester_id)
    .maybeSingle();

  const departmentsField = requesterMembership?.departments as
    | { name: string }
    | { name: string }[]
    | null;
  const requesterDepartment = Array.isArray(departmentsField)
    ? (departmentsField[0]?.name ?? null)
    : (departmentsField?.name ?? null);

  return {
    ...(ticket as Ticket),
    requester: profiles.get(ticket.requester_id) ?? null,
    assignee: ticket.assigned_to ? profiles.get(ticket.assigned_to) ?? null : null,
    category: ticket.category_id ? categories.get(ticket.category_id) ?? null : null,
    subcategory: ticket.subcategory_id ? subcategories.get(ticket.subcategory_id) ?? null : null,
    comments: commentsRes.data.map((c) => ({ ...c, author: profiles.get(c.author_id) ?? null })),
    attachments: attachmentsRes.data.map((a) => ({ ...a, uploader: profiles.get(a.uploaded_by) ?? null })),
    assignments: assignmentsRes.data,
    statusHistory: historyRes.data,
    requesterDepartment,
  };
}

export async function createTicket(input: {
  companyId: string;
  subject: string;
  description: string;
  priority: string;
  categoryId: string | null;
  subcategoryId: string | null;
  requesterId: string;
}) {
  const { data, error } = await supabase
    .from("tickets")
    .insert({
      company_id: input.companyId,
      subject: input.subject,
      description: input.description,
      priority: input.priority,
      category_id: input.categoryId,
      subcategory_id: input.subcategoryId,
      requester_id: input.requesterId,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Ticket;
}

export async function updateTicketAssignment(ticketId: string, assignedTo: string | null) {
  const { error } = await supabase.from("tickets").update({ assigned_to: assignedTo }).eq("id", ticketId);
  if (error) throw error;
}

export async function updateTicketStatus(ticketId: string, status: string) {
  const { error } = await supabase.from("tickets").update({ status }).eq("id", ticketId);
  if (error) throw error;
}

export async function updateTicketPriority(ticketId: string, priority: string) {
  const { error } = await supabase.from("tickets").update({ priority }).eq("id", ticketId);
  if (error) throw error;
}

export async function addComment(ticketId: string, companyId: string, authorId: string, body: string) {
  const { error } = await supabase.from("ticket_comments").insert({
    ticket_id: ticketId,
    company_id: companyId,
    author_id: authorId,
    body,
  });
  if (error) throw error;
}

export async function uploadAttachment(input: {
  companyId: string;
  ticketId: string;
  uploadedBy: string;
  file: File;
  commentId?: string;
}) {
  const path = `companies/${input.companyId}/tickets/${input.ticketId}/${Date.now()}-${input.file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("ticket-attachments")
    .upload(path, input.file);
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from("ticket_attachments").insert({
    company_id: input.companyId,
    ticket_id: input.ticketId,
    comment_id: input.commentId ?? null,
    uploaded_by: input.uploadedBy,
    file_path: path,
    file_name: input.file.name,
    file_size: input.file.size,
    mime_type: input.file.type,
  });
  if (insertError) throw insertError;
}

export async function getAttachmentSignedUrl(filePath: string) {
  const { data, error } = await supabase.storage
    .from("ticket-attachments")
    .createSignedUrl(filePath, 60 * 5);
  if (error) throw error;
  return data.signedUrl;
}

export interface TicketActivityItem {
  id: string;
  kind: "comment" | "status";
  ticketId: string;
  ticketNumber: string;
  subject: string;
  at: string;
  actorName: string;
  detail: string;
}

function fullName(p: MiniProfile | undefined) {
  if (!p) return "Someone";
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Someone";
}

// Recent comments and status changes on tickets this specific user is
// involved in (as requester or assignee), regardless of their broader
// ticket permissions -- this is the "did IT reply to me / is my ticket
// resolved" feed for the company dashboard, not a staff-wide activity log.
export async function getMyTicketActivity(
  companyId: string,
  userId: string,
  limit = 6,
): Promise<TicketActivityItem[]> {
  const { data: myTickets, error: ticketsError } = await supabase
    .from("tickets")
    .select("id, ticket_number, subject")
    .eq("company_id", companyId)
    .or(`requester_id.eq.${userId},assigned_to.eq.${userId}`);
  if (ticketsError) throw ticketsError;
  if (!myTickets || myTickets.length === 0) return [];

  const ticketIds = myTickets.map((t) => t.id);
  const ticketMap = new Map(myTickets.map((t) => [t.id, t]));

  const [{ data: comments, error: commentsError }, { data: history, error: historyError }] =
    await Promise.all([
      supabase
        .from("ticket_comments")
        .select("id, ticket_id, author_id, body, created_at")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("ticket_status_history")
        .select("id, ticket_id, old_status, new_status, changed_by, created_at")
        .in("ticket_id", ticketIds)
        .not("old_status", "is", null)
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);
  if (commentsError) throw commentsError;
  if (historyError) throw historyError;

  const actorIds = [
    ...(comments ?? []).map((c) => c.author_id),
    ...((history ?? []).map((h) => h.changed_by).filter(Boolean) as string[]),
  ];
  const profiles = await fetchProfilesMap(actorIds);

  const items: TicketActivityItem[] = [
    ...(comments ?? []).map((c) => ({
      id: `comment-${c.id}`,
      kind: "comment" as const,
      ticketId: c.ticket_id,
      ticketNumber: ticketMap.get(c.ticket_id)?.ticket_number ?? "",
      subject: ticketMap.get(c.ticket_id)?.subject ?? "",
      at: c.created_at,
      actorName: fullName(profiles.get(c.author_id)),
      detail: c.body,
    })),
    ...(history ?? []).map((h) => ({
      id: `status-${h.id}`,
      kind: "status" as const,
      ticketId: h.ticket_id,
      ticketNumber: ticketMap.get(h.ticket_id)?.ticket_number ?? "",
      subject: ticketMap.get(h.ticket_id)?.subject ?? "",
      at: h.created_at,
      actorName: h.changed_by ? fullName(profiles.get(h.changed_by)) : "System",
      detail: `${h.old_status} → ${h.new_status}`,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);

  return items;
}

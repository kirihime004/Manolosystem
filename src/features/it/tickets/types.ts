import type {
  Profile,
  Ticket,
  TicketAssignment,
  TicketAttachment,
  TicketCategory,
  TicketComment,
  TicketStatusHistory,
  TicketSubcategory,
} from "@/types/database";

export interface EnrichedTicket extends Ticket {
  requester: Pick<Profile, "id" | "first_name" | "last_name" | "avatar_url"> | null;
  assignee: Pick<Profile, "id" | "first_name" | "last_name" | "avatar_url"> | null;
  category: TicketCategory | null;
  subcategory: TicketSubcategory | null;
}

export interface TicketDetail extends EnrichedTicket {
  comments: (TicketComment & { author: Pick<Profile, "id" | "first_name" | "last_name" | "avatar_url"> | null })[];
  attachments: (TicketAttachment & { uploader: Pick<Profile, "id" | "first_name" | "last_name" | "avatar_url"> | null })[];
  assignments: TicketAssignment[];
  statusHistory: TicketStatusHistory[];
  requesterDepartment: string | null;
  asset: { asset_code: string; name: string } | null;
}

export interface TicketFilters {
  search?: string;
  status?: string;
  priority?: string;
  categoryId?: string;
  assignedTo?: string;
}

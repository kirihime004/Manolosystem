// Hand-written types mirroring supabase/migrations. If the Supabase CLI is
// linked to the project later, this file can be regenerated with:
//   supabase gen types typescript --project-id ddtwiujzbwwgvjcdkexv > src/types/database.ts

export type CompanyStatus = "ACTIVE" | "SUSPENDED" | "INACTIVE";
export type MembershipStatus = "ACTIVE" | "DISABLED" | "INVITED";
export type ModuleKey = "IT" | "HR" | "FINANCE" | "ADMIN" | "PRODUCTION";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TicketStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "WAITING_FOR_USER"
  | "WAITING_FOR_VENDOR"
  | "RESOLVED"
  | "CLOSED"
  | "CANCELLED";

export interface Company {
  id: string;
  name: string;
  slug: string;
  code: string;
  logo_url: string | null;
  status: CompanyStatus;
  created_at: string;
  updated_at: string;
}

export interface CompanyModule {
  id: string;
  company_id: string;
  module_key: ModuleKey;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyUser {
  id: string;
  company_id: string;
  user_id: string;
  status: MembershipStatus;
  department_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  key: string;
  module_key: ModuleKey;
  resource: string;
  action: string;
  description: string | null;
  created_at: string;
}

export interface RolePermission {
  id: string;
  company_id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
}

export interface UserRole {
  id: string;
  company_id: string;
  company_user_id: string;
  role_id: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  company_id: string | null;
  actor_user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TicketCategory {
  id: string;
  company_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface TicketSubcategory {
  id: string;
  company_id: string;
  category_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: string;
  company_id: string;
  ticket_number: string;
  requester_id: string;
  assigned_to: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  subject: string;
  description: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
}

export interface TicketComment {
  id: string;
  company_id: string;
  ticket_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface TicketAttachment {
  id: string;
  company_id: string;
  ticket_id: string;
  comment_id: string | null;
  uploaded_by: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface TicketAssignment {
  id: string;
  company_id: string;
  ticket_id: string;
  assigned_to: string | null;
  assigned_by: string | null;
  created_at: string;
}

export interface TicketStatusHistory {
  id: string;
  company_id: string;
  ticket_id: string;
  old_status: TicketStatus | null;
  new_status: TicketStatus;
  changed_by: string | null;
  created_at: string;
}

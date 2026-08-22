// Hand-written types mirroring supabase/migrations. If the Supabase CLI is
// linked to the project later, this file can be regenerated with:
//   supabase gen types typescript --project-id ddtwiujzbwwgvjcdkexv > src/types/database.ts

export type CompanyStatus = "ACTIVE" | "SUSPENDED" | "INACTIVE";
export type MembershipStatus = "ACTIVE" | "DISABLED" | "INVITED";
export type ModuleKey = "IT" | "INVENTORY" | "HR" | "FINANCE" | "ADMIN" | "PRODUCTION";
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

// ---------------------------------------------------------------------
// Phase 2: IT Inventory & Asset Management
// ---------------------------------------------------------------------
export type AssetType = "HARDWARE" | "SOFTWARE";
export type AssetStatus =
  | "ACTIVE"
  | "UNASSIGNED"
  | "REPAIR"
  | "DEFECTIVE"
  | "LOST"
  | "DISPOSED"
  | "RETIRED"
  | "RESERVED"
  | "EXPIRED"
  | "CANCELLED"
  | "SUSPENDED";
export type AssetCondition = "NEW" | "GOOD" | "FAIR" | "POOR" | "DEFECTIVE" | "NON_FUNCTIONAL";
export type SoftwareType = "SUBSCRIPTION" | "ONE_TIME_PURCHASE";
export type BillingCycle = "MONTHLY" | "QUARTERLY" | "ANNUAL" | "OTHER";
export type RepairStatus = "REQUESTED" | "IN_REPAIR" | "WAITING_FOR_PARTS" | "COMPLETED" | "CANCELLED";
export type DisposalReason =
  | "BEYOND_USEFUL_LIFE"
  | "DEFECTIVE"
  | "NON_REPAIRABLE"
  | "LOST"
  | "OBSOLETE"
  | "UPGRADE"
  | "OTHER";
export type DisposalMethod = "RECYCLED" | "DESTROYED" | "RETURNED_TO_VENDOR" | "SOLD" | "DONATED" | "OTHER";
export type IpDeviceType =
  | "DESKTOP"
  | "LAPTOP"
  | "SERVER"
  | "PRINTER"
  | "SWITCH"
  | "ROUTER"
  | "ACCESS_POINT"
  | "CCTV"
  | "NAS"
  | "FIREWALL"
  | "OTHER";
export type IpStatus = "ACTIVE" | "INACTIVE" | "UNKNOWN" | "RESERVED" | "CONFLICT";
export type CredentialCategory =
  | "NETWORK"
  | "SERVER"
  | "EMAIL"
  | "CLOUD"
  | "SOFTWARE"
  | "DATABASE"
  | "DOMAIN"
  | "PRINTER"
  | "SECURITY"
  | "OTHER";
export type CredentialStatus = "ACTIVE" | "INACTIVE" | "RETIRED";
export type RecommendedAction = "REPAIR" | "REPLACE" | "DISPOSE" | "ASSESS";
export type AssetHistoryEventType =
  | "CREATED"
  | "ASSIGNED"
  | "REASSIGNED"
  | "UNASSIGNED"
  | "STATUS_CHANGED"
  | "CONDITION_CHANGED"
  | "LOCATION_CHANGED"
  | "DEPARTMENT_CHANGED"
  | "REPAIR_STARTED"
  | "REPAIR_COMPLETED"
  | "MARKED_DEFECTIVE"
  | "MARKED_FOR_DISPOSAL"
  | "DISPOSED"
  | "RETIRED"
  | "WARRANTY_UPDATED"
  | "PURCHASE_UPDATED"
  | "SUBSCRIPTION_RENEWED"
  | "SUBSCRIPTION_CANCELLED"
  | "LICENSE_UPDATED";
export type NotificationType =
  | "HARDWARE_NEARING_EOL"
  | "HARDWARE_OVER_EOL"
  | "WARRANTY_EXPIRING"
  | "WARRANTY_EXPIRED"
  | "SUBSCRIPTION_RENEWAL_DUE"
  | "SUBSCRIPTION_EXPIRED"
  | "IP_CONFLICT"
  | "ASSET_DEFECTIVE"
  | "REPAIR_OVERDUE";

export interface Supplier {
  id: string;
  company_id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  company_id: string;
  asset_code: string;
  asset_type: AssetType;
  category: string | null;
  name: string;
  status: AssetStatus;
  condition: AssetCondition | null;
  serial_number: string | null;
  asset_tag: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  currency: string;
  supplier_id: string | null;
  invoice_number: string | null;
  purchase_order: string | null;
  assigned_to: string | null;
  department_id: string | null;
  location: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HardwareDetails {
  asset_id: string;
  company_id: string;
  brand: string | null;
  model: string | null;
  hostname: string | null;
  ip_address: string | null;
  mac_address: string | null;
  warranty_start: string | null;
  warranty_end: string | null;
  warranty_provider: string | null;
  warranty_reference: string | null;
  lifecycle_years: number;
}

export interface HardwareAsset extends Asset, HardwareDetails {
  end_of_life_date: string | null;
  days_until_eol: number | null;
  lifecycle_stage: "ACTIVE" | "NEARING_EOL" | "END_OF_LIFE" | "DISPOSED" | "RETIRED" | "LOST";
}

export interface SoftwareDetails {
  asset_id: string;
  company_id: string;
  software_type: SoftwareType;
  vendor: string | null;
  version: string | null;
  license_type: string | null;
  license_key: string | null;
  number_of_licenses: number | null;
}

export interface SoftwareSubscription {
  asset_id: string;
  company_id: string;
  subscription_start: string | null;
  subscription_end: string | null;
  renewal_date: string | null;
  billing_cycle: BillingCycle;
  cost: number | null;
  currency: string;
  seats_total: number;
  seats_used: number;
  seats_available: number;
  auto_renewal: boolean;
  account_owner: string | null;
}

export interface SoftwareAsset extends Asset, SoftwareDetails {
  subscription_start: string | null;
  subscription_end: string | null;
  renewal_date: string | null;
  billing_cycle: BillingCycle | null;
  subscription_cost: number | null;
  subscription_currency: string | null;
  seats_total: number | null;
  seats_used: number | null;
  seats_available: number | null;
  auto_renewal: boolean | null;
  account_owner: string | null;
  days_until_renewal: number | null;
}

export interface AssetHistoryEntry {
  id: string;
  company_id: string;
  asset_id: string;
  event_type: AssetHistoryEventType;
  performed_by: string | null;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
}

export interface Repair {
  id: string;
  company_id: string;
  asset_id: string;
  reported_date: string;
  problem_description: string;
  reported_by: string | null;
  repair_vendor: string | null;
  repair_start_date: string | null;
  expected_completion_date: string | null;
  actual_completion_date: string | null;
  repair_cost: number | null;
  currency: string;
  repair_status: RepairStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Disposal {
  id: string;
  company_id: string;
  asset_id: string;
  disposal_date: string;
  disposal_reason: DisposalReason;
  disposal_method: DisposalMethod;
  approved_by: string | null;
  disposed_by: string | null;
  final_value: number | null;
  currency: string;
  notes: string | null;
  attachment_path: string | null;
  created_at: string;
}

export interface IpAddress {
  id: string;
  company_id: string;
  ip_address: string;
  mac_address: string | null;
  hostname: string | null;
  device_type: IpDeviceType;
  asset_id: string | null;
  assigned_to: string | null;
  department_id: string | null;
  location: string | null;
  status: IpStatus;
  last_seen: string | null;
  first_seen: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Credential {
  id: string;
  company_id: string;
  credential_code: string;
  credential_name: string;
  system: string;
  url: string | null;
  username: string | null;
  encrypted_secret: string | null;
  secret_iv: string | null;
  category: CredentialCategory;
  assigned_owner: string | null;
  notes: string | null;
  status: CredentialStatus;
  last_rotated: string | null;
  next_rotation: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryNotification {
  id: string;
  company_id: string;
  user_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  resource_type: string;
  resource_id: string;
  read: boolean;
  created_at: string;
}

export interface NetworkAgentToken {
  id: string;
  company_id: string;
  name: string;
  token_hash: string;
  created_by: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  code: string;
  logo_url: string | null;
  login_background_url: string | null;
  sidebar_background_url: string | null;
  sidebar_background_color: string | null;
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
  asset_id: string | null;
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

// Hand-written types mirroring supabase/migrations. If the Supabase CLI is
// linked to the project later, this file can be regenerated with:
//   supabase gen types typescript --project-id ddtwiujzbwwgvjcdkexv > src/types/database.ts

export type CompanyStatus = "ACTIVE" | "SUSPENDED" | "INACTIVE";
export type MembershipStatus = "ACTIVE" | "DISABLED" | "INVITED";
export type ModuleKey =
  | "IT" | "TICKETING" | "INVENTORY" | "PROCUREMENT"
  | "HR" | "HR_EMPLOYEES" | "HR_ATTENDANCE_LEAVE" | "HR_PAYROLL"
  | "FINANCE" | "FINANCE_ACCOUNTING" | "FINANCE_AP" | "FINANCE_AR"
  | "FINANCE_EXPENSES" | "FINANCE_BANK" | "FINANCE_PAYROLL"
  | "ADMIN" | "ADMIN_REQUESTS" | "ADMIN_FACILITIES" | "ADMIN_SUPPLIES" | "ADMIN_ASSETS"
  | "ADMIN_VEHICLES" | "ADMIN_TRAVEL" | "ADMIN_VISITORS" | "ADMIN_EVENTS" | "ADMIN_CONTRACTS" | "ADMIN_COMMS"
  | "PRODUCTION" | "PRODUCTION_PROJECTS" | "PRODUCTION_SHOTS" | "PRODUCTION_ASSETS" | "PRODUCTION_TASKS"
  | "PRODUCTION_SCHEDULE" | "PRODUCTION_VERSIONS" | "PRODUCTION_DELIVERABLES" | "PRODUCTION_RESOURCES";
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

export type SupplierStatus = "ACTIVE" | "INACTIVE" | "BLACKLISTED";

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
  tax_number: string | null;
  payment_terms: string | null;
  currency_id: string | null;
  status: SupplierStatus;
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
  purchase_order_id: string | null;
  purchase_order_item_id: string | null;
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

// ---------------------------------------------------------------------
// Phase 3: IT Budget & Procurement
// ---------------------------------------------------------------------
export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
  country_or_region: string | null;
  is_active: boolean;
}

export interface CompanyCurrencySettings {
  id: string;
  company_id: string;
  base_currency_id: string;
}

export interface ExchangeRate {
  id: string;
  from_currency_id: string;
  to_currency_id: string;
  rate: number;
  effective_date: string;
  source: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export type BudgetStatus = "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED";

export interface Budget {
  id: string;
  company_id: string;
  budget_name: string;
  fiscal_year: number;
  start_date: string;
  end_date: string;
  currency_id: string;
  total_budget: number;
  status: BudgetStatus;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetSummary extends Budget {
  allocated: number;
  committed: number;
  spent: number;
  remaining: number;
  available: number;
}

export interface BudgetCategory {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

export interface BudgetAllocation {
  id: string;
  company_id: string;
  budget_id: string;
  category_id: string;
  allocated_amount: number;
}

export interface BudgetCategorySummary {
  budget_id: string;
  category_id: string;
  category_name: string;
  allocated_amount: number;
  committed: number;
  spent: number;
  available: number;
}

export type BudgetTransactionType = "ALLOCATION" | "COMMITMENT" | "RELEASE" | "EXPENSE" | "ADJUSTMENT" | "REFUND";

export interface BudgetTransaction {
  id: string;
  company_id: string;
  budget_id: string;
  category_id: string | null;
  amount: number;
  currency_id: string;
  transaction_type: BudgetTransactionType;
  adjustment_sign: 1 | -1;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export type PurchaseRequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "CONVERTED_TO_PO";
export type RequestPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface PurchaseRequest {
  id: string;
  company_id: string;
  request_number: string;
  requester_id: string;
  department_id: string | null;
  budget_id: string | null;
  budget_category_id: string | null;
  ticket_id: string | null;
  request_date: string;
  required_date: string | null;
  priority: RequestPriority;
  reason: string | null;
  description: string | null;
  currency_id: string;
  estimated_subtotal: number;
  estimated_tax: number;
  estimated_shipping: number;
  estimated_discount: number;
  estimated_total: number;
  base_currency_id: string | null;
  exchange_rate: number | null;
  base_currency_amount: number | null;
  status: PurchaseRequestStatus;
  created_at: string;
  updated_at: string;
}

export interface PurchaseRequestItem {
  id: string;
  purchase_request_id: string;
  company_id: string;
  description: string;
  category: string | null;
  asset_type: "HARDWARE" | "SOFTWARE" | null;
  software_type: "SUBSCRIPTION" | "ONE_TIME_PURCHASE" | null;
  quantity: number;
  estimated_unit_price: number;
  estimated_total: number;
  preferred_supplier_id: string | null;
  notes: string | null;
}

export type ApprovalDecision = "PENDING" | "APPROVED" | "REJECTED";

export interface PurchaseRequestApproval {
  id: string;
  company_id: string;
  purchase_request_id: string;
  approver_id: string | null;
  required_permission: string;
  approval_level: number;
  sequence: number;
  decision: ApprovalDecision;
  decided_at: string | null;
  comments: string | null;
  created_at: string;
}

export type QuotationStatus = "DRAFT" | "RECEIVED" | "UNDER_REVIEW" | "SELECTED" | "REJECTED" | "EXPIRED";

export interface Quotation {
  id: string;
  company_id: string;
  purchase_request_id: string;
  supplier_id: string;
  quotation_number: string | null;
  quotation_date: string;
  valid_until: string | null;
  currency_id: string;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  exchange_rate: number | null;
  base_currency_id: string | null;
  base_currency_total: number | null;
  delivery_time_days: number | null;
  warranty_terms: string | null;
  payment_terms: string | null;
  status: QuotationStatus;
  selected_by: string | null;
  selected_at: string | null;
  selection_reason: string | null;
  notes: string | null;
  created_at: string;
}

export interface QuotationItem {
  id: string;
  quotation_id: string;
  company_id: string;
  purchase_request_item_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  notes: string | null;
}

export type PurchaseOrderStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "SENT_TO_SUPPLIER"
  | "ACKNOWLEDGED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED"
  | "CLOSED";

export interface PurchaseOrder {
  id: string;
  company_id: string;
  po_number: string;
  purchase_request_id: string | null;
  quotation_id: string | null;
  supplier_id: string;
  po_date: string;
  expected_delivery_date: string | null;
  currency_id: string;
  payment_terms: string | null;
  shipping_terms: string | null;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  exchange_rate: number | null;
  base_currency_id: string | null;
  base_currency_total: number | null;
  status: PurchaseOrderStatus;
  created_by: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  company_id: string;
  description: string;
  category: string | null;
  asset_type: "HARDWARE" | "SOFTWARE" | null;
  software_type: "SUBSCRIPTION" | "ONE_TIME_PURCHASE" | null;
  quantity: number;
  unit_price: number;
  tax: number;
  discount: number;
  line_total: number;
  received_quantity: number;
  remaining_quantity: number;
}

export interface PurchaseOrderApproval {
  id: string;
  company_id: string;
  purchase_order_id: string;
  approver_id: string | null;
  required_permission: string;
  approval_level: number;
  sequence: number;
  decision: ApprovalDecision;
  decided_at: string | null;
  comments: string | null;
  created_at: string;
}

export interface Delivery {
  id: string;
  company_id: string;
  purchase_order_id: string;
  delivery_number: string;
  delivery_date: string;
  received_by: string | null;
  tracking_number: string | null;
  delivery_reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface DeliveryItem {
  id: string;
  delivery_id: string;
  company_id: string;
  purchase_order_item_id: string;
  quantity_received: number;
  notes: string | null;
}

export interface ApprovalPolicy {
  id: string;
  company_id: string;
  module: "PURCHASE_REQUEST" | "PURCHASE_ORDER";
  minimum_amount: number;
  maximum_amount: number | null;
  currency_id: string | null;
  required_permission: string;
  approval_sequence: number;
  allow_self_approval: boolean;
  enabled: boolean;
}

export interface ProcurementHistoryEntry {
  id: string;
  company_id: string;
  resource_type: "purchase_request" | "quotation" | "purchase_order" | "delivery";
  resource_id: string;
  event_type: string;
  performed_by: string | null;
  previous_status: string | null;
  new_status: string | null;
  metadata: Record<string, unknown>;
  notes: string | null;
  created_at: string;
}

export interface BudgetAlertThreshold {
  id: string;
  company_id: string;
  threshold_percent: number;
  enabled: boolean;
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
  code: string | null;
  description: string | null;
  manager_id: string | null;
  parent_department_id: string | null;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  updated_at: string;
}

export interface Position {
  id: string;
  company_id: string;
  title: string;
  code: string | null;
  department_id: string | null;
  level: number | null;
  description: string | null;
  reports_to_position_id: string | null;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  updated_at: string;
}

export interface EmploymentType {
  id: string;
  company_id: string;
  code: string;
  label: string;
  is_default: boolean;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
}

export interface EmploymentStatus {
  id: string;
  company_id: string;
  code: string;
  label: string;
  is_active_employment: boolean;
  is_default: boolean;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
}

export interface Employee {
  id: string;
  company_id: string;
  employee_number: string;
  user_id: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  preferred_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  marital_status: string | null;
  personal_email: string | null;
  company_email: string | null;
  phone: string | null;
  alternative_phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  profile_photo_path: string | null;
  department_id: string | null;
  position_id: string | null;
  manager_id: string | null;
  supervisor_id: string | null;
  employment_type_id: string | null;
  employment_status_id: string | null;
  employee_category: string | null;
  hire_date: string | null;
  probation_start_date: string | null;
  probation_end_date: string | null;
  regularization_date: string | null;
  termination_date: string | null;
  work_location: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeEmergencyContact {
  id: string;
  company_id: string;
  employee_id: string;
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeHistoryEntry {
  id: string;
  company_id: string;
  employee_id: string;
  event_type: string;
  field_name: string | null;
  previous_value: string | null;
  new_value: string | null;
  reason: string | null;
  notes: string | null;
  performed_by: string | null;
  created_at: string;
}

export type EmployeeDocumentType =
  | "EMPLOYMENT_CONTRACT" | "ID_DOCUMENT" | "RESUME" | "CERTIFICATE" | "TRAINING_CERTIFICATE"
  | "MEDICAL_CERTIFICATE" | "GOVERNMENT_DOCUMENT" | "TAX_DOCUMENT" | "OTHER";

export interface EmployeeDocument {
  id: string;
  company_id: string;
  employee_id: string;
  document_type: EmployeeDocumentType;
  title: string;
  document_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  storage_path: string;
  uploaded_by: string | null;
  status: "ACTIVE" | "EXPIRED" | "ARCHIVED";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ContractType = "FIXED_TERM" | "PERMANENT" | "PROBATIONARY" | "CONTRACTOR_AGREEMENT";
export type ContractStatus = "DRAFT" | "ACTIVE" | "EXPIRING" | "EXPIRED" | "RENEWED" | "TERMINATED";

export interface EmploymentContract {
  id: string;
  company_id: string;
  contract_number: string;
  employee_id: string;
  contract_type: ContractType;
  start_date: string;
  end_date: string | null;
  position_id: string | null;
  department_id: string | null;
  employment_type_id: string | null;
  salary_reference: number | null;
  currency_id: string | null;
  working_hours: string | null;
  work_location: string | null;
  status: ContractStatus;
  document_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type PayType = "MONTHLY" | "BIWEEKLY" | "WEEKLY" | "DAILY" | "HOURLY" | "PROJECT_BASED";

export interface EmployeeCompensation {
  id: string;
  company_id: string;
  employee_id: string;
  effective_date: string;
  pay_type: PayType;
  basic_salary: number;
  currency_id: string;
  pay_frequency: string | null;
  allowance: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkSchedule {
  id: string;
  company_id: string;
  name: string;
  working_days: number[];
  start_time: string;
  end_time: string;
  break_minutes: number;
  grace_period_minutes: number;
  overtime_rules: Record<string, unknown>;
  is_default: boolean;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  updated_at: string;
}

export interface Holiday {
  id: string;
  company_id: string;
  name: string;
  holiday_date: string;
  country: string | null;
  location: string | null;
  type: "NATIONAL" | "COMPANY" | "SPECIAL";
  status: "ACTIVE" | "CANCELLED";
  created_at: string;
  updated_at: string;
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "ON_LEAVE" | "HOLIDAY" | "REMOTE" | "REST_DAY";
export type AttendanceSource = "MANUAL" | "HR_ENTRY" | "SELF_SERVICE" | "BIOMETRIC" | "IMPORT" | "API";

export interface Attendance {
  id: string;
  company_id: string;
  employee_id: string;
  attendance_date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_minutes: number;
  total_hours: number | null;
  status: AttendanceStatus;
  source: AttendanceSource;
  location: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceCorrection {
  id: string;
  company_id: string;
  employee_id: string;
  attendance_id: string | null;
  attendance_date: string;
  original_clock_in: string | null;
  original_clock_out: string | null;
  requested_clock_in: string | null;
  requested_clock_out: string | null;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  approved_by: string | null;
  approved_at: string | null;
  approval_notes: string | null;
  created_at: string;
}

export interface LeaveType {
  id: string;
  company_id: string;
  code: string;
  name: string;
  is_paid: boolean;
  default_entitlement_days: number;
  allow_negative_balance: boolean;
  requires_approval: boolean;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  updated_at: string;
}

export interface LeaveBalance {
  id: string;
  company_id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  entitlement: number;
  used: number;
  pending: number;
  remaining: number;
  created_at: string;
  updated_at: string;
}

export type LeaveRequestStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface LeaveRequest {
  id: string;
  company_id: string;
  request_number: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  attachment_path: string | null;
  status: LeaveRequestStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequestApproval {
  id: string;
  company_id: string;
  leave_request_id: string;
  approver_id: string | null;
  required_permission: string;
  sequence: number;
  decision: "PENDING" | "APPROVED" | "REJECTED";
  decided_at: string | null;
  comments: string | null;
  created_at: string;
}

export type OvertimeRequestStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface OvertimeRequest {
  id: string;
  company_id: string;
  request_number: string;
  employee_id: string;
  work_date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  reason: string | null;
  department_id: string | null;
  status: OvertimeRequestStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OvertimeRequestApproval {
  id: string;
  company_id: string;
  overtime_request_id: string;
  approver_id: string | null;
  required_permission: string;
  sequence: number;
  decision: "PENDING" | "APPROVED" | "REJECTED";
  decided_at: string | null;
  comments: string | null;
  created_at: string;
}

export interface Timesheet {
  id: string;
  company_id: string;
  employee_id: string;
  work_date: string;
  project_id: string | null;
  task_id: string | null;
  project_name: string | null;
  task_name: string | null;
  start_time: string | null;
  end_time: string | null;
  hours: number;
  notes: string | null;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export type HrRequestType =
  | "EMPLOYMENT_CERTIFICATE" | "SALARY_CERTIFICATE" | "LEAVE_REQUEST" | "ATTENDANCE_CORRECTION"
  | "DOCUMENT_REQUEST" | "INFORMATION_UPDATE" | "EMPLOYMENT_VERIFICATION" | "OTHER";
export type HrRequestStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "COMPLETED" | "CANCELLED";

export interface HrRequest {
  id: string;
  company_id: string;
  request_number: string;
  employee_id: string;
  request_type: HrRequestType;
  subject: string;
  description: string | null;
  status: HrRequestStatus;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HrRequestComment {
  id: string;
  company_id: string;
  hr_request_id: string;
  author_id: string | null;
  comment: string;
  created_at: string;
}

export type BenefitType = "HEALTH_INSURANCE" | "LIFE_INSURANCE" | "ALLOWANCE" | "TRANSPORTATION" | "MEAL_ALLOWANCE" | "COMMUNICATION_ALLOWANCE" | "OTHER";
export type DeductionType = "TAX" | "LOAN" | "INSURANCE" | "EMPLOYEE_CONTRIBUTION" | "OTHER";

export interface EmployeeBenefit {
  id: string;
  company_id: string;
  employee_id: string;
  benefit_type: BenefitType;
  provider: string | null;
  start_date: string | null;
  end_date: string | null;
  amount: number | null;
  currency_id: string | null;
  frequency: string | null;
  status: "ACTIVE" | "INACTIVE" | "EXPIRED";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeDeduction {
  id: string;
  company_id: string;
  employee_id: string;
  deduction_type: DeductionType;
  description: string | null;
  amount: number;
  currency_id: string | null;
  frequency: string | null;
  start_date: string | null;
  end_date: string | null;
  status: "ACTIVE" | "INACTIVE" | "COMPLETED";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type LifecycleTaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED" | "CANCELLED";

export interface OnboardingTaskTemplate {
  id: string;
  company_id: string;
  department: "HR" | "IT" | "ADMIN" | "MANAGER";
  task_type: string;
  title: string;
  description: string | null;
  sort_order: number;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  updated_at: string;
}

export interface OffboardingTaskTemplate {
  id: string;
  company_id: string;
  department: "HR" | "IT" | "ADMIN" | "FINANCE" | "MANAGER";
  task_type: string;
  title: string;
  description: string | null;
  sort_order: number;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  updated_at: string;
}

export interface EmployeeOnboardingTask {
  id: string;
  company_id: string;
  employee_id: string;
  department: "HR" | "IT" | "ADMIN" | "MANAGER";
  task_type: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  status: LifecycleTaskStatus;
  due_date: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeOffboardingTask {
  id: string;
  company_id: string;
  employee_id: string;
  department: "HR" | "IT" | "ADMIN" | "FINANCE" | "MANAGER";
  task_type: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  status: LifecycleTaskStatus;
  due_date: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayrollPeriod {
  id: string;
  company_id: string;
  period_name: string;
  frequency: "MONTHLY" | "BIWEEKLY" | "WEEKLY";
  start_date: string;
  end_date: string;
  pay_date: string | null;
  status: "DRAFT" | "OPEN" | "PROCESSING" | "REVIEW" | "APPROVED" | "PAID" | "CLOSED";
  created_by: string | null;
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

// ---------------------------------------------------------------------
// Phase 5: Finance & Accounting
// ---------------------------------------------------------------------
export type FiscalYearStatus = "ACTIVE" | "CLOSED";
export type FinancialPeriodStatus = "OPEN" | "CLOSED" | "LOCKED";
export type FinancialPeriodType = "MONTHLY" | "QUARTERLY" | "YEARLY";
export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE" | "COGS";
export type JournalEntryStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "POSTED" | "REVERSED" | "VOID";
export type SupplierBillStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID";
export type MatchStatus = "MATCHED" | "MISMATCH" | "NOT_APPLICABLE";
export type PaymentMethod = "BANK_TRANSFER" | "CASH" | "CHEQUE" | "CARD" | "OTHER";
export type SupplierPaymentStatus = "DRAFT" | "COMPLETED" | "VOID";
export type CashAccountType = "BANK" | "CASH" | "PETTY_CASH" | "CREDIT_CARD" | "OTHER";
export type CashAccountStatus = "ACTIVE" | "INACTIVE" | "CLOSED";
export type BankTransactionType = "DEPOSIT" | "WITHDRAWAL" | "TRANSFER" | "BANK_FEE" | "INTEREST" | "ADJUSTMENT";
export type BankTransactionDirection = "IN" | "OUT";
export type BankReconciliationStatus = "IN_PROGRESS" | "COMPLETED";
export type CustomerType = "CLIENT" | "STUDIO" | "NETWORK" | "PRODUCTION_COMPANY" | "CORPORATE" | "OTHER";
export type CustomerInvoiceStatus = "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID" | "CANCELLED";
export type CustomerPaymentStatus = "DRAFT" | "COMPLETED" | "REFUNDED" | "VOID";
export type ExpenseCategory = "TRAVEL" | "MEALS" | "TRANSPORTATION" | "TRAINING" | "OFFICE" | "CLIENT" | "PRODUCTION" | "IT" | "OTHER";
export type ExpenseStatus = "DRAFT" | "SUBMITTED" | "MANAGER_APPROVED" | "FINANCE_REVIEW" | "APPROVED" | "REJECTED" | "PAID" | "CANCELLED";
export type TaxType =
  | "VAT" | "WITHHOLDING_TAX" | "SALES_TAX"
  | "SSS_EMPLOYEE" | "SSS_EMPLOYER" | "PHILHEALTH_EMPLOYEE" | "PHILHEALTH_EMPLOYER"
  | "PAGIBIG_EMPLOYEE" | "PAGIBIG_EMPLOYER" | "OTHER";
export type TaxDirection = "OUTPUT" | "INPUT";
export type PayrollRunType = "REGULAR" | "THIRTEENTH_MONTH";
export type PayrollRunStatus = "DRAFT" | "PROCESSING" | "REVIEW" | "APPROVED" | "PAID" | "CLOSED" | "CANCELLED";

export interface FiscalYear {
  id: string;
  company_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: FiscalYearStatus;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinancialPeriod {
  id: string;
  company_id: string;
  fiscal_year_id: string;
  name: string;
  period_type: FinancialPeriodType;
  start_date: string;
  end_date: string;
  status: FinancialPeriodStatus;
  closed_by: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChartOfAccount {
  id: string;
  company_id: string;
  code: string;
  name: string;
  account_type: AccountType;
  parent_account_id: string | null;
  is_header: boolean;
  is_system: boolean;
  status: "ACTIVE" | "ARCHIVED";
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CostCenter {
  id: string;
  company_id: string;
  code: string;
  name: string;
  department_id: string | null;
  parent_id: string | null;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  updated_at: string;
}

export interface ProfitCenter {
  id: string;
  company_id: string;
  code: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
  id: string;
  company_id: string;
  journal_number: string;
  date: string;
  reference_type: string | null;
  reference_id: string | null;
  description: string;
  currency_id: string;
  exchange_rate: number;
  base_currency_id: string;
  financial_period_id: string | null;
  status: JournalEntryStatus;
  total_debit: number;
  total_credit: number;
  reversal_of_id: string | null;
  reversal_reason: string | null;
  created_by: string | null;
  posted_by: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryLine {
  id: string;
  journal_entry_id: string;
  company_id: string;
  line_number: number;
  account_id: string;
  description: string | null;
  debit: number;
  credit: number;
  original_amount: number | null;
  exchange_rate: number | null;
  base_debit: number;
  base_credit: number;
  department_id: string | null;
  employee_id: string | null;
  supplier_id: string | null;
  customer_id: string | null;
  project_id: string | null;
  cost_center_id: string | null;
  profit_center_id: string | null;
  created_at: string;
}

export interface JournalEntryApproval {
  id: string;
  company_id: string;
  journal_entry_id: string;
  approver_id: string | null;
  required_permission: string;
  approval_level: number;
  sequence: number;
  decision: ApprovalDecision;
  decided_at: string | null;
  comments: string | null;
  created_at: string;
}

export interface GeneralLedgerRow {
  line_id: string;
  company_id: string;
  journal_entry_id: string;
  journal_number: string;
  date: string;
  reference_type: string | null;
  reference_id: string | null;
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  description: string | null;
  debit: number;
  credit: number;
  balance: number;
  department_id: string | null;
  employee_id: string | null;
  supplier_id: string | null;
  customer_id: string | null;
  project_id: string | null;
  cost_center_id: string | null;
  profit_center_id: string | null;
  currency_id: string;
  base_currency_id: string;
  status: JournalEntryStatus;
}

export interface TrialBalanceRow {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  opening_debit: number;
  opening_credit: number;
  period_debit: number;
  period_credit: number;
  closing_debit: number;
  closing_credit: number;
}

export interface SupplierBill {
  id: string;
  company_id: string;
  bill_number: string;
  supplier_id: string;
  purchase_order_id: string | null;
  bill_date: string;
  due_date: string;
  currency_id: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  exchange_rate: number | null;
  base_currency_id: string | null;
  base_currency_total: number | null;
  paid_amount: number;
  status: SupplierBillStatus;
  match_status: MatchStatus;
  matched_at: string | null;
  department_id: string | null;
  cost_center_id: string | null;
  budget_id: string | null;
  budget_category_id: string | null;
  journal_entry_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierBillItem {
  id: string;
  supplier_bill_id: string;
  company_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax: number;
  discount: number;
  line_total: number;
  account_id: string | null;
  purchase_order_item_id: string | null;
  tax_rate_id: string | null;
  created_at: string;
}

export interface SupplierBillApproval {
  id: string;
  company_id: string;
  supplier_bill_id: string;
  approver_id: string | null;
  required_permission: string;
  approval_level: number;
  sequence: number;
  decision: ApprovalDecision;
  decided_at: string | null;
  comments: string | null;
  created_at: string;
}

export interface SupplierPayment {
  id: string;
  company_id: string;
  payment_number: string;
  supplier_id: string;
  supplier_bill_id: string;
  payment_date: string;
  payment_method: PaymentMethod;
  bank_account_id: string;
  currency_id: string;
  amount: number;
  exchange_rate: number | null;
  base_currency_id: string | null;
  base_currency_amount: number | null;
  reference: string | null;
  status: SupplierPaymentStatus;
  journal_entry_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CashAccount {
  id: string;
  company_id: string;
  name: string;
  account_type: CashAccountType;
  bank_name: string | null;
  account_number_masked: string | null;
  currency_id: string;
  gl_account_id: string;
  opening_balance: number;
  current_balance: number;
  status: CashAccountStatus;
  created_at: string;
  updated_at: string;
}

export interface BankTransaction {
  id: string;
  company_id: string;
  cash_account_id: string;
  transaction_date: string;
  transaction_type: BankTransactionType;
  direction: BankTransactionDirection;
  reference: string | null;
  description: string | null;
  amount: number;
  currency_id: string;
  reconciled: boolean;
  reconciliation_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
  journal_entry_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankReconciliation {
  id: string;
  company_id: string;
  cash_account_id: string;
  statement_date: string;
  statement_balance: number;
  system_balance: number;
  status: BankReconciliationStatus;
  notes: string | null;
  reconciled_by: string | null;
  reconciled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  company_id: string;
  customer_code: string;
  name: string;
  customer_type: CustomerType;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_number: string | null;
  currency_id: string | null;
  payment_terms: string | null;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  updated_at: string;
}

export interface CustomerInvoice {
  id: string;
  company_id: string;
  invoice_number: string;
  customer_id: string;
  project_id: string | null;
  invoice_date: string;
  due_date: string;
  currency_id: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  exchange_rate: number | null;
  base_currency_id: string | null;
  base_currency_total: number | null;
  paid_amount: number;
  status: CustomerInvoiceStatus;
  department_id: string | null;
  cost_center_id: string | null;
  profit_center_id: string | null;
  payment_terms: string | null;
  notes: string | null;
  journal_entry_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerInvoiceItem {
  id: string;
  customer_invoice_id: string;
  company_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax: number;
  discount: number;
  line_total: number;
  revenue_account_id: string | null;
  project_id: string | null;
  tax_rate_id: string | null;
  created_at: string;
}

export interface CustomerPayment {
  id: string;
  company_id: string;
  payment_number: string;
  customer_id: string;
  customer_invoice_id: string;
  payment_date: string;
  payment_method: PaymentMethod;
  bank_account_id: string;
  currency_id: string;
  amount: number;
  exchange_rate: number | null;
  base_currency_id: string | null;
  base_currency_amount: number | null;
  is_overpayment: boolean;
  reference: string | null;
  status: CustomerPaymentStatus;
  journal_entry_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  company_id: string;
  expense_number: string;
  employee_id: string;
  department_id: string | null;
  expense_date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  currency_id: string;
  exchange_rate: number | null;
  base_currency_id: string | null;
  base_currency_amount: number | null;
  receipt_path: string | null;
  project_id: string | null;
  customer_id: string | null;
  account_id: string | null;
  cost_center_id: string | null;
  budget_id: string | null;
  budget_category_id: string | null;
  status: ExpenseStatus;
  approver_id: string | null;
  finance_reviewer: string | null;
  journal_entry_id: string | null;
  paid_via_cash_account_id: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseApproval {
  id: string;
  company_id: string;
  expense_id: string;
  approver_id: string | null;
  required_permission: string;
  approval_level: number;
  sequence: number;
  decision: ApprovalDecision;
  decided_at: string | null;
  comments: string | null;
  created_at: string;
}

export interface TaxRate {
  id: string;
  company_id: string;
  name: string;
  code: string;
  rate: number;
  tax_type: TaxType;
  country: string | null;
  effective_date: string;
  expiry_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaxTransaction {
  id: string;
  company_id: string;
  reference_type: string;
  reference_id: string;
  tax_type: TaxType;
  direction: TaxDirection;
  tax_rate_id: string | null;
  supplier_id: string | null;
  customer_id: string | null;
  department_id: string | null;
  transaction_date: string;
  base_amount: number;
  tax_amount: number;
  currency_id: string;
  base_currency_id: string | null;
  base_currency_tax_amount: number | null;
  created_at: string;
}

export interface PayrollRun {
  id: string;
  company_id: string;
  payroll_period_id: string;
  run_type: PayrollRunType;
  status: PayrollRunStatus;
  currency_id: string;
  total_gross_pay: number;
  total_deductions: number;
  total_employer_contributions: number;
  total_net_pay: number;
  journal_entry_id: string | null;
  payment_journal_entry_id: string | null;
  processed_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayrollItem {
  id: string;
  payroll_run_id: string;
  company_id: string;
  employee_id: string;
  basic_salary: number;
  allowances: number;
  overtime_hours: number;
  overtime_pay: number;
  bonuses: number;
  gross_pay: number;
  sss_employee: number;
  philhealth_employee: number;
  pagibig_employee: number;
  withholding_tax: number;
  other_deductions: number;
  total_deductions: number;
  sss_employer: number;
  philhealth_employer: number;
  pagibig_employer: number;
  total_employer_contributions: number;
  net_pay: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgingRow {
  supplier_id?: string;
  supplier_name?: string;
  customer_id?: string;
  customer_name?: string;
  bill_id?: string;
  bill_number?: string;
  invoice_id?: string;
  invoice_number?: string;
  due_date: string;
  original_amount: number;
  paid_amount: number;
  outstanding: number;
  days_overdue: number;
  bucket: "Current" | "1-30" | "31-60" | "61-90" | "90+";
}

// ---------------------------------------------------------------------
// Phase 6: Administration
// ---------------------------------------------------------------------
export type AdminRequestPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type AdminRequestStatus =
  | "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED"
  | "ASSIGNED" | "IN_PROGRESS" | "WAITING" | "COMPLETED" | "CANCELLED" | "CLOSED";

export interface AdminRequestCategory {
  id: string;
  company_id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AdminRequest {
  id: string;
  company_id: string;
  request_number: string;
  requester_id: string;
  department_id: string | null;
  category_id: string | null;
  assigned_to: string | null;
  subject: string;
  description: string | null;
  priority: AdminRequestPriority;
  status: AdminRequestStatus;
  required_date: string | null;
  location_id: string | null;
  estimated_cost: number | null;
  currency_id: string | null;
  exchange_rate: number | null;
  base_currency_id: string | null;
  base_currency_amount: number | null;
  approval_required: boolean;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  completed_at: string | null;
}

export interface AdminRequestComment {
  id: string;
  company_id: string;
  request_id: string;
  author_id: string;
  comment: string;
  is_internal: boolean;
  created_at: string;
}

export interface AdminRequestApproval {
  id: string;
  company_id: string;
  request_id: string;
  approver_id: string | null;
  required_permission: string;
  sequence: number;
  decision: "PENDING" | "APPROVED" | "REJECTED";
  decided_at: string | null;
  comments: string | null;
  created_at: string;
}

export interface AdminHistoryEntry {
  id: string;
  company_id: string;
  resource_type: string;
  resource_id: string;
  event_type: string;
  performed_by: string | null;
  previous_status: string | null;
  new_status: string | null;
  metadata: Record<string, unknown>;
  notes: string | null;
  created_at: string;
}

export type LocationType = "HEAD_OFFICE" | "BRANCH" | "STUDIO" | "WAREHOUSE" | "REMOTE_OFFICE" | "OTHER";

export interface AdminLocation {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
  type: LocationType;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  building: string | null;
  floor: string | null;
  status: "ACTIVE" | "INACTIVE";
  manager_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Building {
  id: string;
  company_id: string;
  location_id: string;
  name: string;
  code: string | null;
  address: string | null;
  floors: number | null;
  status: "ACTIVE" | "INACTIVE";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Floor {
  id: string;
  company_id: string;
  building_id: string;
  floor_number: string;
  floor_name: string | null;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  updated_at: string;
}

export type RoomType =
  | "MEETING_ROOM" | "CONFERENCE_ROOM" | "TRAINING_ROOM" | "STUDIO" | "OFFICE"
  | "RECEPTION" | "KITCHEN" | "STORAGE" | "OTHER";

export interface Room {
  id: string;
  company_id: string;
  location_id: string | null;
  building_id: string | null;
  floor_id: string | null;
  room_code: string;
  name: string;
  room_number: string | null;
  type: RoomType;
  capacity: number | null;
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE";
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type RoomBookingStatus = "REQUESTED" | "APPROVED" | "CONFIRMED" | "CANCELLED" | "COMPLETED";

export interface RoomBooking {
  id: string;
  company_id: string;
  room_id: string;
  requester_id: string;
  department_id: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  purpose: string | null;
  attendees: number | null;
  status: RoomBookingStatus;
  created_at: string;
  updated_at: string;
}

export type WorkspaceStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE" | "UNAVAILABLE";

export interface Workspace {
  id: string;
  company_id: string;
  location_id: string | null;
  building_id: string | null;
  floor_id: string | null;
  workspace_code: string;
  area: string | null;
  desk_number: string | null;
  status: WorkspaceStatus;
  current_employee_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceAssignment {
  id: string;
  company_id: string;
  workspace_id: string;
  employee_id: string;
  department_id: string | null;
  assigned_date: string;
  released_date: string | null;
  status: "ACTIVE" | "RELEASED";
  assigned_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface OfficeSupply {
  id: string;
  company_id: string;
  item_code: string;
  name: string;
  category: string | null;
  unit: string;
  current_quantity: number;
  minimum_quantity: number;
  reorder_quantity: number | null;
  location_id: string | null;
  supplier_id: string | null;
  unit_cost: number | null;
  currency_id: string | null;
  status: "ACTIVE" | "DISCONTINUED";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type SupplyMovementType = "STOCK_IN" | "STOCK_OUT" | "TRANSFER" | "ADJUSTMENT" | "RETURN" | "DISPOSAL";

export interface OfficeSupplyMovement {
  id: string;
  company_id: string;
  supply_id: string;
  movement_type: SupplyMovementType;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  performed_by: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
}

export interface OfficeSupplyRequest {
  id: string;
  company_id: string;
  request_number: string;
  requester_id: string;
  department_id: string | null;
  supply_id: string;
  quantity_requested: number;
  quantity_issued: number | null;
  reason: string | null;
  needed_by: string | null;
  status: "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "ISSUED" | "CANCELLED";
  purchase_request_id: string | null;
  reviewed_by: string | null;
  issued_by: string | null;
  issued_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AdminAssetStatus = "ACTIVE" | "AVAILABLE" | "ASSIGNED" | "MAINTENANCE" | "DAMAGED" | "LOST" | "DISPOSED" | "RETIRED";

export interface AdminAsset {
  id: string;
  company_id: string;
  asset_code: string;
  name: string;
  category: string | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  status: AdminAssetStatus;
  condition: "NEW" | "GOOD" | "FAIR" | "POOR" | "DEFECTIVE" | "NON_FUNCTIONAL" | null;
  purchase_date: string | null;
  purchase_price: number | null;
  currency_id: string | null;
  exchange_rate: number | null;
  base_currency_id: string | null;
  base_currency_amount: number | null;
  supplier_id: string | null;
  warranty_start: string | null;
  warranty_end: string | null;
  location_id: string | null;
  assigned_to: string | null;
  department_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type MaintenanceStatus = "REPORTED" | "ASSESSED" | "SCHEDULED" | "IN_PROGRESS" | "WAITING_PARTS" | "COMPLETED" | "CANCELLED";

export interface MaintenanceRecord {
  id: string;
  company_id: string;
  maintenance_number: string;
  asset_id: string | null;
  room_id: string | null;
  location_id: string | null;
  reported_by: string | null;
  assigned_to: string | null;
  supplier_id: string | null;
  issue: string;
  priority: AdminRequestPriority;
  status: MaintenanceStatus;
  scheduled_date: string | null;
  completed_date: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  currency_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceSchedule {
  id: string;
  company_id: string;
  asset_id: string | null;
  room_id: string | null;
  location_id: string | null;
  title: string;
  frequency: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL" | "CUSTOM";
  interval_days: number | null;
  last_maintenance_date: string | null;
  next_maintenance_date: string;
  supplier_id: string | null;
  estimated_cost: number | null;
  currency_id: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type VehicleStatus = "AVAILABLE" | "ASSIGNED" | "IN_USE" | "MAINTENANCE" | "REPAIR" | "ACCIDENT" | "RETIRED" | "DISPOSED";
export type VehicleType = "COMPANY_CAR" | "VAN" | "TRUCK" | "MOTORCYCLE" | "PRODUCTION_TRANSPORT" | "SERVICE_VEHICLE" | "OTHER";

export interface Vehicle {
  id: string;
  company_id: string;
  vehicle_code: string;
  plate_number: string;
  make: string | null;
  model: string | null;
  year: number | null;
  vehicle_type: VehicleType;
  color: string | null;
  vin: string | null;
  registration_number: string | null;
  registration_expiry: string | null;
  insurance_expiry: string | null;
  assigned_driver: string | null;
  department_id: string | null;
  location_id: string | null;
  status: VehicleStatus;
  purchase_date: string | null;
  purchase_price: number | null;
  currency_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleAssignment {
  id: string;
  company_id: string;
  vehicle_id: string;
  employee_id: string;
  department_id: string | null;
  assigned_date: string;
  returned_date: string | null;
  status: "ACTIVE" | "RETURNED";
  assigned_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface VehicleMaintenance {
  id: string;
  company_id: string;
  vehicle_id: string;
  maintenance_type: "OIL_CHANGE" | "SERVICE" | "REPAIR" | "TIRE_REPLACEMENT" | "INSPECTION" | "REGISTRATION" | "INSURANCE" | "OTHER";
  service_date: string;
  mileage: number | null;
  cost: number | null;
  currency_id: string | null;
  supplier_id: string | null;
  notes: string | null;
  created_at: string;
}

export type TravelRequestStatus =
  | "DRAFT" | "SUBMITTED" | "MANAGER_APPROVED" | "ADMIN_REVIEW" | "FINANCE_REVIEW"
  | "APPROVED" | "BOOKED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "REJECTED";

export interface TravelRequest {
  id: string;
  company_id: string;
  request_number: string;
  employee_id: string;
  department_id: string | null;
  purpose: string;
  destination: string;
  travel_type: "DOMESTIC" | "INTERNATIONAL";
  departure_date: string;
  return_date: string;
  estimated_cost: number | null;
  currency_id: string | null;
  status: TravelRequestStatus;
  approver_id: string | null;
  flight_details: string | null;
  hotel_details: string | null;
  transportation_details: string | null;
  visa_required: boolean;
  insurance_required: boolean;
  per_diem: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  completed_at: string | null;
}

export type VisitorStatus = "EXPECTED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";
export type VisitorType = "CLIENT" | "VENDOR" | "CANDIDATE" | "PARTNER" | "GUEST" | "DELIVERY" | "OTHER";

export interface Visitor {
  id: string;
  company_id: string;
  name: string;
  organization: string | null;
  visitor_type: VisitorType;
  email: string | null;
  phone: string | null;
  host_employee_id: string;
  purpose: string | null;
  visit_date: string;
  arrival_time: string | null;
  departure_time: string | null;
  status: VisitorStatus;
  badge_number: string | null;
  badge_issued_at: string | null;
  badge_returned_at: string | null;
  badge_status: "ISSUED" | "RETURNED" | "LOST" | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  company_id: string;
  organizer_id: string;
  room_booking_id: string | null;
  title: string;
  purpose: string | null;
  agenda: string | null;
  meeting_date: string;
  start_time: string;
  end_time: string;
  status: "SCHEDULED" | "CANCELLED" | "COMPLETED";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingParticipant {
  id: string;
  company_id: string;
  meeting_id: string;
  employee_id: string;
  response_status: "INVITED" | "ACCEPTED" | "DECLINED" | "TENTATIVE";
  created_at: string;
}

export type EventType =
  | "COMPANY_ANNIVERSARY" | "CHRISTMAS_PARTY" | "TEAM_BUILDING" | "TRAINING_EVENT"
  | "TOWN_HALL" | "CLIENT_EVENT" | "CORPORATE_EVENT" | "OTHER";

export interface AdminEvent {
  id: string;
  company_id: string;
  name: string;
  event_type: EventType;
  location_id: string | null;
  start_date: string;
  end_date: string;
  organizer_id: string | null;
  budget_id: string | null;
  budget_category_id: string | null;
  status: "PLANNING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventTask {
  id: string;
  company_id: string;
  event_id: string;
  category: "VENUE" | "CATERING" | "DECORATION" | "TRANSPORTATION" | "INVITATIONS" | "EQUIPMENT" | "SECURITY" | "CLEANING" | "OTHER";
  title: string;
  description: string | null;
  assigned_to: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED" | "CANCELLED";
  due_date: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type AdminContractStatus = "DRAFT" | "ACTIVE" | "EXPIRING" | "EXPIRED" | "RENEWED" | "TERMINATED" | "CANCELLED";
export type AdminContractType = "OFFICE_LEASE" | "CLEANING" | "SECURITY" | "MAINTENANCE" | "UTILITY" | "VEHICLE_LEASE" | "SERVICE" | "OTHER";

export interface AdminContract {
  id: string;
  company_id: string;
  contract_number: string;
  contract_name: string;
  contract_type: AdminContractType;
  supplier_id: string | null;
  start_date: string;
  end_date: string;
  renewal_date: string | null;
  value: number | null;
  currency_id: string | null;
  payment_terms: string | null;
  owner_id: string | null;
  status: AdminContractStatus;
  renewed_from_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminCompliance {
  id: string;
  company_id: string;
  compliance_number: string;
  type: string;
  name: string;
  authority: string | null;
  reference_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  responsible_person: string | null;
  status: "ACTIVE" | "EXPIRING" | "EXPIRED" | "PENDING" | "CANCELLED";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminDocument {
  id: string;
  company_id: string;
  resource_type: string;
  resource_id: string;
  document_type: string;
  title: string;
  storage_path: string;
  issue_date: string | null;
  expiry_date: string | null;
  uploaded_by: string | null;
  status: "ACTIVE" | "EXPIRED" | "ARCHIVED";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Announcement {
  id: string;
  company_id: string;
  title: string;
  content: string;
  audience: "ENTIRE_COMPANY" | "DEPARTMENT" | "LOCATION" | "ROLE";
  audience_department_id: string | null;
  audience_location_id: string | null;
  audience_role_id: string | null;
  priority: AdminRequestPriority;
  publish_date: string;
  expiry_date: string | null;
  status: "DRAFT" | "PUBLISHED" | "EXPIRED" | "RETRACTED";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CourierMail {
  id: string;
  company_id: string;
  direction: "INCOMING" | "OUTGOING";
  tracking_number: string | null;
  sender: string | null;
  recipient: string | null;
  department_id: string | null;
  courier_provider: string | null;
  log_date: string;
  status: "RECEIVED" | "IN_TRANSIT" | "READY_FOR_PICKUP" | "DELIVERED" | "RETURNED" | "CANCELLED";
  received_by: string | null;
  delivered_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminDashboardSummary {
  open_requests: number;
  pending_approvals: number;
  today_visitors: number;
  today_meetings: number;
  upcoming_events: number;
  low_stock_supplies: number;
  maintenance_due: number;
  contracts_expiring: number;
  documents_expiring: number;
  compliance_due: number;
  vehicle_renewals: number;
  upcoming_travel: number;
}

// ---------------------------------------------------------------------
// Phase 7: Animation Production Management
// ---------------------------------------------------------------------
export type ProductionProjectType = "FEATURE_FILM" | "SERIES" | "SHORT" | "COMMERCIAL" | "GAME_CINEMATIC" | "OTHER";
export type ProductionProjectStatus = "PLANNING" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED" | "ARCHIVED";
export type ProductionPipelineStatus =
  | "NOT_STARTED" | "READY" | "IN_PROGRESS" | "PENDING_REVIEW" | "CHANGES_REQUESTED"
  | "APPROVED" | "COMPLETED" | "ON_HOLD" | "OMITTED";
export type ProductionRiskStatus = "ON_TRACK" | "AT_RISK" | "LATE";
export type ProjectMemberRole = "DIRECTOR" | "PRODUCER" | "SUPERVISOR" | "ARTIST" | "COORDINATOR" | "CLIENT_LIAISON";

export interface ProductionSettings {
  company_id: string;
  shot_naming_format: string;
  default_task_statuses: string[];
  created_at: string;
  updated_at: string;
}

export interface ProductionProject {
  id: string;
  company_id: string;
  project_code: string;
  name: string;
  description: string | null;
  project_type: ProductionProjectType;
  client_id: string | null;
  department_id: string | null;
  director_id: string | null;
  producer_id: string | null;
  status: ProductionProjectStatus;
  start_date: string | null;
  target_end_date: string | null;
  actual_end_date: string | null;
  currency_id: string | null;
  notes: string | null;
  custom_field_values: Record<string, unknown>;
  budget_id: string | null;
  client_portal_enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionProjectMember {
  id: string;
  company_id: string;
  project_id: string;
  employee_id: string;
  project_role: ProjectMemberRole;
  department: string | null;
  added_by: string | null;
  added_at: string;
}

export interface ProductionShow {
  id: string;
  company_id: string;
  project_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionEpisode {
  id: string;
  company_id: string;
  project_id: string;
  show_id: string | null;
  episode_number: number;
  episode_code: string;
  name: string | null;
  status: "PLANNING" | "IN_PROGRESS" | "COMPLETED" | "DELIVERED" | "ON_HOLD";
  air_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionSequence {
  id: string;
  company_id: string;
  project_id: string;
  episode_id: string | null;
  sequence_number: number;
  sequence_code: string;
  name: string | null;
  description: string | null;
  status: "PLANNING" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD";
  created_at: string;
  updated_at: string;
}

export interface ProductionShot {
  id: string;
  company_id: string;
  project_id: string;
  sequence_id: string;
  shot_number: number;
  shot_code: string;
  description: string | null;
  frame_start: number;
  frame_end: number | null;
  duration_frames: number | null;
  status: ProductionPipelineStatus;
  risk_status: ProductionRiskStatus;
  complexity: "LOW" | "MEDIUM" | "HIGH" | null;
  thumbnail_path: string | null;
  due_date: string | null;
  custom_field_values: Record<string, unknown>;
  client_visible: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionAsset {
  id: string;
  company_id: string;
  project_id: string;
  asset_code: string;
  name: string;
  asset_category: "CHARACTER" | "PROP" | "ENVIRONMENT" | "VEHICLE" | "RIG" | "EFFECT" | "OTHER";
  description: string | null;
  status: ProductionPipelineStatus;
  thumbnail_path: string | null;
  custom_field_values: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionTaskType {
  id: string;
  company_id: string;
  name: string;
  applies_to: "SHOT" | "ASSET" | "BOTH";
  sort_order: number;
  color: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ProductionTask {
  id: string;
  company_id: string;
  project_id: string;
  task_type_id: string | null;
  shot_id: string | null;
  asset_id: string | null;
  task_code: string;
  name: string;
  description: string | null;
  status: ProductionPipelineStatus;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  risk_status: ProductionRiskStatus;
  assigned_to: string | null;
  start_date: string | null;
  due_date: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  bid_amount: number | null;
  currency_id: string | null;
  sort_order: number;
  custom_field_values: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionTaskDependency {
  id: string;
  company_id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: "FS" | "SS" | "FF" | "SF";
  created_by: string | null;
  created_at: string;
}

export interface ProductionMilestone {
  id: string;
  company_id: string;
  project_id: string;
  episode_id: string | null;
  milestone_code: string;
  name: string;
  description: string | null;
  milestone_type: "INTERNAL" | "CLIENT" | "DELIVERY";
  due_date: string;
  completed_date: string | null;
  status: "UPCOMING" | "AT_RISK" | "LATE" | "COMPLETED" | "CANCELLED";
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionVersion {
  id: string;
  company_id: string;
  project_id: string;
  shot_id: string | null;
  asset_id: string | null;
  task_id: string | null;
  version_number: number;
  name: string | null;
  description: string | null;
  file_path: string | null;
  thumbnail_path: string | null;
  frame_start: number | null;
  frame_end: number | null;
  status: "PENDING_REVIEW" | "APPROVED" | "CHANGES_REQUESTED" | "ARCHIVED";
  submitted_by: string | null;
  submitted_at: string;
  notes: string | null;
  client_visible: boolean;
  created_at: string;
}

export interface ProductionReview {
  id: string;
  company_id: string;
  version_id: string;
  reviewer_type: "EMPLOYEE" | "CLIENT";
  reviewer_employee_id: string | null;
  reviewer_client_id: string | null;
  reviewer_name: string | null;
  decision: "PENDING" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
  comment: string | null;
  requested_by: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface ProductionNote {
  id: string;
  company_id: string;
  resource_type: "PROJECT" | "SHOT" | "ASSET" | "TASK" | "VERSION";
  resource_id: string;
  parent_note_id: string | null;
  author_id: string | null;
  content: string;
  frame_number: number | null;
  status: "OPEN" | "RESOLVED";
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionDeliverable {
  id: string;
  company_id: string;
  project_id: string;
  episode_id: string | null;
  shot_id: string | null;
  deliverable_code: string;
  name: string;
  description: string | null;
  version_id: string | null;
  recipient_client_id: string | null;
  due_date: string | null;
  delivered_date: string | null;
  status: "PENDING" | "IN_PROGRESS" | "READY" | "DELIVERED" | "REJECTED";
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionFile {
  id: string;
  company_id: string;
  resource_type: "PROJECT" | "SHOT" | "ASSET" | "VERSION" | "DELIVERABLE";
  resource_id: string;
  filename: string;
  storage_path: string;
  file_type: string | null;
  file_size: number | null;
  checksum: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface ProductionClientUser {
  id: string;
  company_id: string;
  customer_id: string;
  user_id: string;
  name: string;
  email: string;
  is_active: boolean;
  invited_by: string | null;
  created_at: string;
}

export type ProductionCustomFieldType =
  | "TEXT" | "TEXTAREA" | "NUMBER" | "BOOLEAN" | "DATE" | "DATETIME"
  | "DROPDOWN" | "MULTI_SELECT" | "EMPLOYEE" | "PROJECT" | "SHOT" | "TASK" | "CURRENCY";

export interface ProductionCustomField {
  id: string;
  company_id: string;
  entity_type: "PROJECT" | "SHOT" | "ASSET" | "TASK";
  field_key: string;
  label: string;
  field_type: ProductionCustomFieldType;
  options: { value: string; label: string }[];
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface ProductionCustomFieldValue {
  id: string;
  company_id: string;
  custom_field_id: string;
  entity_type: "PROJECT" | "SHOT" | "ASSET" | "TASK";
  entity_id: string;
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_date: string | null;
  value_uuid: string | null;
  value_json: unknown;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionWorkflowTemplate {
  id: string;
  company_id: string;
  name: string;
  entity_type: "TASK" | "SHOT" | "ASSET";
  is_default: boolean;
  created_at: string;
}

export interface ProductionWorkflowStage {
  id: string;
  company_id: string;
  workflow_template_id: string;
  name: string;
  sort_order: number;
  maps_to_status: string;
  created_at: string;
}

export interface ProductionProjectTemplate {
  id: string;
  company_id: string;
  name: string;
  project_type: string | null;
  description: string | null;
  config: { milestones?: { name: string; days_offset: number; milestone_type: string }[] };
  created_by: string | null;
  created_at: string;
}

export interface ProductionHistoryEntry {
  id: string;
  company_id: string;
  resource_type: "PROJECT" | "SHOW" | "EPISODE" | "SEQUENCE" | "SHOT" | "ASSET" | "TASK" | "VERSION" | "REVIEW" | "MILESTONE" | "DELIVERABLE";
  resource_id: string;
  event_type: string;
  performed_by: string | null;
  previous_status: string | null;
  new_status: string | null;
  metadata: Record<string, unknown>;
  notes: string | null;
  created_at: string;
}

export interface ProductionDashboardSummary {
  active_projects: number;
  open_tasks: number;
  my_tasks: number;
  tasks_at_risk: number;
  tasks_late: number;
  pending_reviews: number;
  upcoming_milestones: number;
  overdue_milestones: number;
  pending_deliverables: number;
  overdue_deliverables: number;
}

export interface ProductionWorkloadRow {
  employee_id: string;
  employee_name: string;
  open_task_count: number;
  total_estimated_hours: number;
  is_available_today: boolean;
}

export interface ProductionBudgetSummary {
  budget_id: string;
  budget_name: string;
  total_budget: number;
  allocated: number;
  spent: number;
  remaining: number;
  currency_code: string;
}

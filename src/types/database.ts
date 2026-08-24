// Hand-written types mirroring supabase/migrations. If the Supabase CLI is
// linked to the project later, this file can be regenerated with:
//   supabase gen types typescript --project-id ddtwiujzbwwgvjcdkexv > src/types/database.ts

export type CompanyStatus = "ACTIVE" | "SUSPENDED" | "INACTIVE";
export type MembershipStatus = "ACTIVE" | "DISABLED" | "INVITED";
export type ModuleKey =
  | "IT" | "TICKETING" | "INVENTORY" | "PROCUREMENT"
  | "HR" | "HR_EMPLOYEES" | "HR_ATTENDANCE_LEAVE" | "HR_PAYROLL"
  | "FINANCE" | "ADMIN" | "PRODUCTION";
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

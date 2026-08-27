import {
  Ticket, Users, DollarSign, Building2, Clapperboard, Boxes, ShoppingCart,
  Wrench, UserSquare2, CalendarClock, Wallet, BookOpen, Receipt, Landmark,
  ReceiptText, PiggyBank, ClipboardList, MapPin, Package, Armchair, Car,
  Plane, UserCheck, PartyPopper, FileSignature, Megaphone, FolderKanban,
  Film, Shapes, ListChecks, CalendarRange, GitBranch, SendToBack, Gauge,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { ModuleKey } from "@/types/database";

// Single source of truth for how each module is presented in the UI.
// IT, HR, Finance, and ADMIN are pure parent/master switches -- turning
// any of them off hides everything nested under it (Platform
// Superadmin's Modules tab, the company sidebar, and RLS via
// has_module_enabled()'s cascade all agree on this same parent/child
// structure). PRODUCTION doesn't have a concrete feature built yet, so
// it's still named after its department.
export const MODULE_INFO: Record<ModuleKey, { label: string; description: string; icon: LucideIcon; path: string }> = {
  IT: { label: "IT", description: "Ticketing, inventory, and budget & procurement", icon: Wrench, path: "it" },
  TICKETING: { label: "Ticketing", description: "Support tickets and technical requests", icon: Ticket, path: "it" },
  INVENTORY: { label: "Inventory", description: "Hardware, software, credentials, and IP assets", icon: Boxes, path: "it/inventory" },
  PROCUREMENT: { label: "Budget & Procurement", description: "IT budgets, purchase requests, and purchase orders", icon: ShoppingCart, path: "it/procurement" },

  HR: { label: "HR", description: "Employees, attendance & leave, and payroll & benefits", icon: Users, path: "hr" },
  HR_EMPLOYEES: { label: "Employees", description: "The employee master record, org structure, documents, and contracts", icon: UserSquare2, path: "hr/employees" },
  HR_ATTENDANCE_LEAVE: { label: "Attendance & Leave", description: "Attendance, leave, overtime, and timesheets", icon: CalendarClock, path: "hr/attendance" },
  HR_PAYROLL: { label: "Payroll & Benefits", description: "Benefits, deductions, and payroll periods", icon: Wallet, path: "hr/benefits" },

  FINANCE: { label: "Finance", description: "Accounting, AP/AR, expenses, cash & bank, and payroll", icon: DollarSign, path: "finance" },
  FINANCE_ACCOUNTING: { label: "Accounting", description: "Chart of accounts, journal entries, general ledger, and trial balance", icon: BookOpen, path: "finance/accounting/chart-of-accounts" },
  FINANCE_AP: { label: "Accounts Payable", description: "Supplier bills and AP aging", icon: Receipt, path: "finance/ap/bills" },
  FINANCE_AR: { label: "Accounts Receivable", description: "Customers, invoices, and AR aging", icon: ReceiptText, path: "finance/ar/customers" },
  FINANCE_EXPENSES: { label: "Expenses", description: "Employee expense claims and approvals", icon: Wallet, path: "finance/expenses" },
  FINANCE_BANK: { label: "Cash & Bank", description: "Cash accounts, bank transactions, and reconciliation", icon: Landmark, path: "finance/cash-bank" },
  FINANCE_PAYROLL: { label: "Payroll", description: "Payroll runs and payslips", icon: PiggyBank, path: "finance/payroll" },

  ADMIN: { label: "Administration", description: "Requests, facilities, assets, vehicles, travel, and office operations", icon: Building2, path: "admin" },
  ADMIN_REQUESTS: { label: "Requests", description: "General administrative service requests", icon: ClipboardList, path: "admin/requests" },
  ADMIN_FACILITIES: { label: "Facilities", description: "Locations, rooms, room bookings, and workspaces", icon: MapPin, path: "admin/facilities" },
  ADMIN_SUPPLIES: { label: "Office Supplies", description: "Consumables inventory and supply requests", icon: Package, path: "admin/supplies" },
  ADMIN_ASSETS: { label: "Administrative Assets", description: "Furniture, appliances, and their maintenance", icon: Armchair, path: "admin/assets" },
  ADMIN_VEHICLES: { label: "Vehicles", description: "Company fleet management", icon: Car, path: "admin/vehicles" },
  ADMIN_TRAVEL: { label: "Travel", description: "Company travel coordination and approvals", icon: Plane, path: "admin/travel" },
  ADMIN_VISITORS: { label: "Visitors", description: "Visitor check-in/out and internal meetings", icon: UserCheck, path: "admin/visitors" },
  ADMIN_EVENTS: { label: "Events", description: "Company events and event tasks", icon: PartyPopper, path: "admin/events" },
  ADMIN_CONTRACTS: { label: "Contracts", description: "Contracts, documents, and compliance records", icon: FileSignature, path: "admin/contracts" },
  ADMIN_COMMS: { label: "Announcements & Courier", description: "Company announcements and courier/mail tracking", icon: Megaphone, path: "admin/announcements" },
  PRODUCTION: { label: "Production", description: "Projects, shots, tasks, versions, and reviews", icon: Clapperboard, path: "production" },
  PRODUCTION_PROJECTS: { label: "Projects", description: "Projects, shows, episodes, and sequences", icon: FolderKanban, path: "production/projects" },
  PRODUCTION_SHOTS: { label: "Shots", description: "The shot grid", icon: Film, path: "production/shots" },
  PRODUCTION_ASSETS: { label: "Assets", description: "Characters, props, environments, and rigs", icon: Shapes, path: "production/assets" },
  PRODUCTION_TASKS: { label: "Tasks", description: "Task board, assignments, and dependencies", icon: ListChecks, path: "production/tasks" },
  PRODUCTION_SCHEDULE: { label: "Schedule", description: "Milestones and the production calendar", icon: CalendarRange, path: "production/schedule" },
  PRODUCTION_VERSIONS: { label: "Reviews", description: "Versions, review decisions, and notes", icon: GitBranch, path: "production/reviews" },
  PRODUCTION_DELIVERABLES: { label: "Deliverables", description: "Client deliverables and production files", icon: SendToBack, path: "production/deliverables" },
  PRODUCTION_RESOURCES: { label: "Resources", description: "Team workload, budgets, and reports", icon: Gauge, path: "production/resources" },

  AI: { label: "AI", description: "AI business intelligence, analytics, and the AI assistant", icon: Sparkles, path: "ai" },
};

import {
  Ticket, Users, DollarSign, Building2, Clapperboard, Boxes, ShoppingCart,
  Wrench, UserSquare2, CalendarClock, Wallet, type LucideIcon,
} from "lucide-react";
import type { ModuleKey } from "@/types/database";

// Single source of truth for how each module is presented in the UI.
// IT and HR are pure parent/master switches -- turning either off hides
// everything nested under it (Platform Superadmin's Modules tab, the
// company sidebar, and RLS via has_module_enabled()'s cascade all agree
// on this same parent/child structure). Finance/Admin/Production don't
// have a concrete feature built yet (see FUTURE_MODULES in the product
// spec), so they're still named after their department until there's
// something specific to name them after.
export const MODULE_INFO: Record<ModuleKey, { label: string; description: string; icon: LucideIcon; path: string }> = {
  IT: { label: "IT", description: "Ticketing, inventory, and budget & procurement", icon: Wrench, path: "it" },
  TICKETING: { label: "Ticketing", description: "Support tickets and technical requests", icon: Ticket, path: "it" },
  INVENTORY: { label: "Inventory", description: "Hardware, software, credentials, and IP assets", icon: Boxes, path: "it/inventory" },
  PROCUREMENT: { label: "Budget & Procurement", description: "IT budgets, purchase requests, and purchase orders", icon: ShoppingCart, path: "it/procurement" },

  HR: { label: "HR", description: "Employees, attendance & leave, and payroll & benefits", icon: Users, path: "hr" },
  HR_EMPLOYEES: { label: "Employees", description: "The employee master record, org structure, documents, and contracts", icon: UserSquare2, path: "hr/employees" },
  HR_ATTENDANCE_LEAVE: { label: "Attendance & Leave", description: "Attendance, leave, overtime, and timesheets", icon: CalendarClock, path: "hr/attendance" },
  HR_PAYROLL: { label: "Payroll & Benefits", description: "Benefits, deductions, and payroll periods", icon: Wallet, path: "hr/benefits" },

  FINANCE: { label: "Finance", description: "Invoices, expenses, and budgets", icon: DollarSign, path: "finance" },
  ADMIN: { label: "Administration", description: "Assets, suppliers, and purchasing", icon: Building2, path: "admin" },
  PRODUCTION: { label: "Production", description: "Shots, tasks, and reviews", icon: Clapperboard, path: "production" },
};

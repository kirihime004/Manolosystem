import { Ticket, Users, DollarSign, Building2, Clapperboard, Boxes, ShoppingCart, type LucideIcon } from "lucide-react";
import type { ModuleKey } from "@/types/database";

// Single source of truth for how each module is presented in the UI.
// Labels name the actual capability a person uses, not the department --
// "Ticketing" tells someone what they're clicking into; "IT" doesn't.
// Finance/Admin/Production don't have a concrete feature built yet (see
// FUTURE_MODULES in the product spec), so they're still named after their
// department until there's something specific to name them after.
export const MODULE_INFO: Record<ModuleKey, { label: string; description: string; icon: LucideIcon; path: string }> = {
  IT: { label: "Ticketing", description: "Support tickets and technical requests", icon: Ticket, path: "it" },
  INVENTORY: { label: "Inventory", description: "Hardware, software, credentials, and IP assets", icon: Boxes, path: "it/inventory" },
  PROCUREMENT: { label: "Budget & Procurement", description: "IT budgets, purchase requests, and purchase orders", icon: ShoppingCart, path: "it/procurement" },
  HR: { label: "HR & Employees", description: "The employee master record, attendance, leave, and HR workflows", icon: Users, path: "hr" },
  FINANCE: { label: "Finance", description: "Invoices, expenses, and budgets", icon: DollarSign, path: "finance" },
  ADMIN: { label: "Administration", description: "Assets, suppliers, and purchasing", icon: Building2, path: "admin" },
  PRODUCTION: { label: "Production", description: "Shots, tasks, and reviews", icon: Clapperboard, path: "production" },
};

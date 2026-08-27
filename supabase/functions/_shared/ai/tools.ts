import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { AIToolDefinition } from "./AIProvider.ts";

// The controlled tool registry -- the ONLY way the model can ever read
// MindBurst data. Every tool maps to exactly one permission-gated RPC (or,
// for the two task-list tools, a plain RLS-scoped select through the
// caller's own client -- never a raw/unparameterized SQL string). The
// model never sees a connection string, a service-role key, or the
// ability to run arbitrary SQL.
export interface ToolContext {
  client: SupabaseClient; // scoped to the CALLER's own JWT -- RLS applies
  companyId: string;
  userId: string;
}

export interface RegisteredTool {
  definition: AIToolDefinition;
  requiredPermission: string;
  execute: (ctx: ToolContext, args: Record<string, unknown>) => Promise<unknown>;
}

export const TOOL_REGISTRY: RegisteredTool[] = [
  {
    definition: {
      name: "get_company_health",
      description: "Get the overall company health (GREEN/YELLOW/RED) and a per-module breakdown for IT, HR, Finance, Admin, and Production, each with the real counts behind its status.",
      parameters: { type: "object", properties: {} },
    },
    requiredPermission: "AI.COMPANY_ANALYTICS.VIEW",
    execute: async (ctx) => {
      const { data, error } = await ctx.client.rpc("get_company_ai_context", { p_company_id: ctx.companyId });
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    definition: {
      name: "get_it_summary",
      description: "Get IT metrics: open/critical tickets, tickets resolved in the last 30 days, assets in repair, hardware approaching replacement age, and software renewals due in the next 30 days.",
      parameters: { type: "object", properties: {} },
    },
    requiredPermission: "AI.IT_ANALYTICS.VIEW",
    execute: async (ctx) => {
      const { data, error } = await ctx.client.rpc("get_it_dashboard_summary", { p_company_id: ctx.companyId });
      if (error) throw new Error(error.message);
      return data?.[0] ?? null;
    },
  },
  {
    definition: {
      name: "get_hr_summary",
      description: "Get HR metrics: active employee count, pending leave requests, employees on approved leave today, pending overtime requests, and pending timesheets.",
      parameters: { type: "object", properties: {} },
    },
    requiredPermission: "AI.HR_ANALYTICS.VIEW",
    execute: async (ctx) => {
      const { data, error } = await ctx.client.rpc("get_hr_dashboard_summary", { p_company_id: ctx.companyId });
      if (error) throw new Error(error.message);
      return data?.[0] ?? null;
    },
  },
  {
    definition: {
      name: "get_finance_summary",
      description: "Get Finance metrics for the current month to date: revenue, expenses, count and total amount of overdue customer invoices (AR), and count and total amount of overdue supplier bills (AP).",
      parameters: { type: "object", properties: {} },
    },
    requiredPermission: "AI.FINANCE_ANALYTICS.VIEW",
    execute: async (ctx) => {
      const { data, error } = await ctx.client.rpc("get_finance_health_summary", { p_company_id: ctx.companyId });
      if (error) throw new Error(error.message);
      return data?.[0] ?? null;
    },
  },
  {
    definition: {
      name: "get_admin_summary",
      description: "Get Administration metrics: open admin requests, pending approvals, and contracts expiring soon.",
      parameters: { type: "object", properties: {} },
    },
    requiredPermission: "AI.ADMIN_ANALYTICS.VIEW",
    execute: async (ctx) => {
      const { data, error } = await ctx.client.rpc("get_admin_dashboard_summary", { p_company_id: ctx.companyId });
      if (error) throw new Error(error.message);
      return data?.[0] ?? null;
    },
  },
  {
    definition: {
      name: "get_production_summary",
      description: "Get Production metrics: active projects, open tasks, tasks at risk, late tasks, and pending reviews.",
      parameters: { type: "object", properties: {} },
    },
    requiredPermission: "AI.PRODUCTION_ANALYTICS.VIEW",
    execute: async (ctx) => {
      const { data, error } = await ctx.client.rpc("get_production_dashboard_summary", { p_company_id: ctx.companyId });
      if (error) throw new Error(error.message);
      return data?.[0] ?? null;
    },
  },
  {
    definition: {
      name: "get_overdue_tasks",
      description: "List up to 20 production tasks currently flagged LATE (overdue), with their code, name, status, and due date.",
      parameters: { type: "object", properties: {} },
    },
    requiredPermission: "AI.PRODUCTION_ANALYTICS.VIEW",
    execute: async (ctx) => {
      const { data, error } = await ctx.client
        .from("production_tasks")
        .select("task_code, name, status, due_date")
        .eq("company_id", ctx.companyId)
        .eq("risk_status", "LATE")
        .order("due_date", { ascending: true })
        .limit(20);
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    definition: {
      name: "get_my_tasks",
      description: "List the current user's own open production tasks (their code, name, status, and due date). Only ever returns the caller's own tasks.",
      parameters: { type: "object", properties: {} },
    },
    requiredPermission: "AI.ASSISTANT.VIEW",
    execute: async (ctx) => {
      const { data: employee } = await ctx.client
        .from("employees")
        .select("id")
        .eq("company_id", ctx.companyId)
        .eq("user_id", ctx.userId)
        .maybeSingle();
      if (!employee) return { tasks: [], note: "No employee record linked to this account." };
      const { data, error } = await ctx.client
        .from("production_tasks")
        .select("task_code, name, status, due_date")
        .eq("company_id", ctx.companyId)
        .eq("assigned_to", employee.id)
        .not("status", "in", "(COMPLETED,APPROVED)")
        .order("due_date", { ascending: true })
        .limit(20);
      if (error) throw new Error(error.message);
      return data;
    },
  },
];

// Bulk version of invite-user: creates an auth user + company membership +
// role assignment + HR employee record, per row, for many people at once.
// Same reason this must run server-side -- creating auth.users rows
// requires the Supabase Admin API / service-role key, which never reaches
// the browser.
//
// Unlike invite-user (single row, any failure is the whole request's
// failure), this loops over rows and keeps going past a failed row --
// one bad email in a 50-row spreadsheet shouldn't block the other 49.
// Every row's outcome is reported back individually.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface BulkRow {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  departmentId: string | null;
  positionId: string | null;
  employmentTypeId: string | null;
  employmentStatusId: string | null;
  roleIds: string[];
  hireDate: string | null;
  phone: string | null;
  tin: string | null;
  sssNumber: string | null;
  philhealthNumber: string | null;
  pagibigNumber: string | null;
}

interface BulkPayload {
  companyId: string;
  rows: BulkRow[];
}

interface RowResult {
  email: string;
  success: boolean;
  userId?: string;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const secretKey =
      Deno.env.get("SUPABASE_SECRET_KEY") ??
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    // Client scoped to the caller's own JWT: used only to figure out who is
    // calling and whether they are actually allowed to do this.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: callerUser },
      error: callerError,
    } = await callerClient.auth.getUser();

    if (callerError || !callerUser) {
      return json({ error: "Invalid session" }, 401);
    }

    const payload = (await req.json()) as BulkPayload;
    if (!payload.companyId || !Array.isArray(payload.rows) || payload.rows.length === 0) {
      return json({ error: "companyId and a non-empty rows array are required" }, 400);
    }
    if (payload.rows.length > 500) {
      return json({ error: "Import is limited to 500 rows per file" }, 400);
    }
    for (const row of payload.rows) {
      if (!row.email || !row.password || row.password.length < 8 || !row.firstName || !row.lastName) {
        return json({ error: `Row for "${row.email || "(missing email)"}" is missing a required field` }, 400);
      }
    }

    // This combines what invite-user (account) and the HR "New employee"
    // form (employee record) each do separately -- so it requires both
    // permissions, not just one.
    const { data: isSuperadmin } = await callerClient.rpc("is_platform_superadmin");
    const { data: canManageUsers } = await callerClient.rpc("has_permission", {
      p_company_id: payload.companyId,
      p_permission_key: "ADMIN.USERS.MANAGE",
    });
    const { data: canCreateEmployees } = await callerClient.rpc("has_permission", {
      p_company_id: payload.companyId,
      p_permission_key: "HR.EMPLOYEES.CREATE",
    });

    if (!isSuperadmin && !(canManageUsers && canCreateEmployees)) {
      return json(
        { error: "Forbidden -- bulk import requires both user-management and employee-creation permissions" },
        403,
      );
    }

    // Privileged client: only used after the authorization check above.
    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const results: RowResult[] = [];

    for (const row of payload.rows) {
      try {
        const { data: created, error: createError } = await adminClient.auth.admin.createUser({
          email: row.email,
          password: row.password,
          email_confirm: true,
          user_metadata: { first_name: row.firstName, last_name: row.lastName },
        });

        if (createError || !created.user) {
          results.push({ email: row.email, success: false, error: createError?.message ?? "Failed to create account" });
          continue;
        }

        const userId = created.user.id;

        const { data: membership, error: membershipError } = await adminClient
          .from("company_users")
          .insert({
            company_id: payload.companyId,
            user_id: userId,
            status: "ACTIVE",
            department_id: row.departmentId,
          })
          .select("id")
          .single();

        if (membershipError || !membership) {
          results.push({ email: row.email, success: false, error: membershipError?.message ?? "Failed to create membership" });
          continue;
        }

        if (row.roleIds.length > 0) {
          const { error: roleError } = await adminClient
            .from("user_roles")
            .upsert(
              row.roleIds.map((roleId) => ({ company_user_id: membership.id, role_id: roleId })),
              { onConflict: "company_user_id,role_id", ignoreDuplicates: true },
            );
          if (roleError) {
            results.push({ email: row.email, success: false, error: roleError.message });
            continue;
          }
        }

        const { error: employeeError } = await adminClient.from("employees").insert({
          company_id: payload.companyId,
          user_id: userId,
          first_name: row.firstName,
          last_name: row.lastName,
          company_email: row.email,
          phone: row.phone,
          department_id: row.departmentId,
          position_id: row.positionId,
          employment_type_id: row.employmentTypeId,
          employment_status_id: row.employmentStatusId,
          hire_date: row.hireDate,
          tin: row.tin,
          sss_number: row.sssNumber,
          philhealth_number: row.philhealthNumber,
          pagibig_number: row.pagibigNumber,
        });

        if (employeeError) {
          results.push({ email: row.email, success: false, error: employeeError.message });
          continue;
        }

        // Inserted directly (not via log_audit_event()) because that helper
        // attributes the entry to auth.uid(), which is unset under the
        // service-role key -- we already know the real actor from their JWT.
        await adminClient.from("audit_logs").insert({
          company_id: payload.companyId,
          actor_user_id: callerUser.id,
          action: "USER_CREATED",
          resource_type: "company_user",
          resource_id: membership.id,
          metadata: { email: row.email, bulk: true },
        });

        results.push({ email: row.email, success: true, userId });
      } catch (rowErr) {
        results.push({
          email: row.email,
          success: false,
          error: rowErr instanceof Error ? rowErr.message : "Unknown error",
        });
      }
    }

    return json({ results }, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

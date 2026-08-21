// Creates an auth user + company membership + role assignment.
//
// This MUST run server-side: creating an auth.users row requires the
// Supabase Admin API, which requires the secret/service-role key. That key
// is only ever read here, from the Edge Function's own environment — it is
// never sent to, or stored in, the browser.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface InvitePayload {
  companyId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roleIds?: string[];
  redirectTo?: string;
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

    const payload = (await req.json()) as InvitePayload;
    if (!payload.companyId || !payload.email) {
      return json({ error: "companyId and email are required" }, 400);
    }

    const { data: isSuperadmin } = await callerClient.rpc(
      "is_platform_superadmin",
    );
    const { data: canManageUsers } = await callerClient.rpc("has_permission", {
      p_company_id: payload.companyId,
      p_permission_key: "ADMIN.USERS.MANAGE",
    });

    if (!isSuperadmin && !canManageUsers) {
      return json({ error: "Forbidden" }, 403);
    }

    // Privileged client: only used after the authorization check above.
    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: invited, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(payload.email, {
        data: {
          first_name: payload.firstName ?? null,
          last_name: payload.lastName ?? null,
        },
        redirectTo: payload.redirectTo,
      });

    if (inviteError || !invited.user) {
      return json({ error: inviteError?.message ?? "Failed to invite user" }, 400);
    }

    // Idempotent: this endpoint doubles as "resend invite" when the invitee
    // never finished setting a password (their link expired, they lost the
    // email, etc). inviteUserByEmail itself resends in that case; the
    // membership/role rows just need to not choke on already existing.
    const { data: existingMembership } = await adminClient
      .from("company_users")
      .select("id")
      .eq("company_id", payload.companyId)
      .eq("user_id", invited.user.id)
      .maybeSingle();

    let membershipId: string;

    if (existingMembership) {
      membershipId = existingMembership.id;
    } else {
      const { data: newMembership, error: membershipError } = await adminClient
        .from("company_users")
        .insert({
          company_id: payload.companyId,
          user_id: invited.user.id,
          status: "INVITED",
        })
        .select("id")
        .single();

      if (membershipError || !newMembership) {
        return json({ error: membershipError?.message ?? "Failed to create membership" }, 400);
      }
      membershipId = newMembership.id;
    }

    if (payload.roleIds && payload.roleIds.length > 0) {
      const rows = payload.roleIds.map((roleId) => ({
        company_user_id: membershipId,
        role_id: roleId,
      }));
      const { error: roleError } = await adminClient
        .from("user_roles")
        .upsert(rows, { onConflict: "company_user_id,role_id", ignoreDuplicates: true });
      if (roleError) {
        return json({ error: roleError.message }, 400);
      }
    }

    // Inserted directly (not via log_audit_event()) because that helper
    // attributes the entry to auth.uid(), which is unset under the
    // service-role key -- we already know the real actor from their JWT.
    await adminClient.from("audit_logs").insert({
      company_id: payload.companyId,
      actor_user_id: callerUser.id,
      action: "USER_INVITED",
      resource_type: "company_user",
      resource_id: membershipId,
      metadata: { email: payload.email },
    });

    return json({ userId: invited.user.id, companyUserId: membershipId }, 200);
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

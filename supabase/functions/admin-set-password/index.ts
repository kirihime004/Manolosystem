// Lets a Company Admin (or Platform Superadmin) set a new password for one
// of their own company's users. Changing another user's password requires
// the Admin API (and therefore the secret key), so -- like invite-user --
// this must run server-side.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface SetPasswordPayload {
  companyId: string;
  userId: string;
  newPassword: string;
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

    const payload = (await req.json()) as SetPasswordPayload;
    if (!payload.companyId || !payload.userId || !payload.newPassword) {
      return json({ error: "companyId, userId, and newPassword are required" }, 400);
    }
    if (payload.newPassword.length < 8) {
      return json({ error: "newPassword must be at least 8 characters" }, 400);
    }

    const { data: isSuperadmin } = await callerClient.rpc("is_platform_superadmin");
    const { data: canManageUsers } = await callerClient.rpc("has_permission", {
      p_company_id: payload.companyId,
      p_permission_key: "ADMIN.USERS.MANAGE",
    });

    if (!isSuperadmin && !canManageUsers) {
      return json({ error: "Forbidden" }, 403);
    }

    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Never trust that the target user actually belongs to this company --
    // an admin's ADMIN.USERS.MANAGE only covers their own company, so
    // confirm membership server-side before touching anyone's password.
    const { data: membership } = await adminClient
      .from("company_users")
      .select("id")
      .eq("company_id", payload.companyId)
      .eq("user_id", payload.userId)
      .maybeSingle();

    if (!membership && !isSuperadmin) {
      return json({ error: "That user is not a member of this company" }, 403);
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(payload.userId, {
      password: payload.newPassword,
    });

    if (updateError) {
      return json({ error: updateError.message }, 400);
    }

    await adminClient.from("audit_logs").insert({
      company_id: payload.companyId,
      actor_user_id: callerUser.id,
      action: "USER_PASSWORD_RESET",
      resource_type: "company_user",
      resource_id: membership?.id ?? null,
      metadata: {},
    });

    return json({ success: true }, 200);
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

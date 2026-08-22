// Encrypts a credential's secret (password/API key/etc.) server-side and
// stores only the ciphertext. Must run here rather than client-side: the
// encryption key is an Edge Function secret the browser never receives,
// and Postgres RLS (protect_credential_secret_columns) refuses to let a
// normal authenticated session write encrypted_secret/secret_iv directly
// -- only a service-role write (this function) is allowed to.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { encryptSecret } from "../_shared/credentialCrypto.ts";

interface SetSecretPayload {
  companyId: string;
  credentialId: string;
  secret: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const secretKey =
      Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const payload = (await req.json()) as SetSecretPayload;
    if (!payload.companyId || !payload.credentialId || !payload.secret) {
      return json({ error: "companyId, credentialId, and secret are required" }, 400);
    }

    const { data: canCreate } = await callerClient.rpc("has_permission", {
      p_company_id: payload.companyId,
      p_permission_key: "IT.CREDENTIALS.CREATE",
    });
    const { data: canUpdate } = await callerClient.rpc("has_permission", {
      p_company_id: payload.companyId,
      p_permission_key: "IT.CREDENTIALS.UPDATE",
    });

    if (!canCreate && !canUpdate) {
      return json({ error: "Forbidden" }, 403);
    }

    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Confirm the credential actually belongs to this company before
    // touching it -- the permission check above only proves the caller has
    // CREDENTIALS access somewhere in this company, not that this specific
    // row is theirs to write.
    const { data: credential } = await adminClient
      .from("credentials")
      .select("id, system")
      .eq("id", payload.credentialId)
      .eq("company_id", payload.companyId)
      .maybeSingle();

    if (!credential) {
      return json({ error: "Credential not found" }, 404);
    }

    const { ciphertext, iv } = await encryptSecret(payload.secret);

    const { error: updateError } = await adminClient
      .from("credentials")
      .update({ encrypted_secret: ciphertext, secret_iv: iv })
      .eq("id", payload.credentialId);

    if (updateError) {
      return json({ error: updateError.message }, 400);
    }

    await adminClient.from("audit_logs").insert({
      company_id: payload.companyId,
      actor_user_id: callerUser.id,
      action: "CREDENTIAL_SECRET_SET",
      resource_type: "credential",
      resource_id: payload.credentialId,
      metadata: { system: credential.system },
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

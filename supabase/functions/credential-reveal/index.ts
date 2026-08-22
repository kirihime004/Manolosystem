// Decrypts and returns a credential's secret. This is the ONLY path that
// ever produces the plaintext -- it requires IT.CREDENTIALS.REVEAL
// specifically (stronger than IT.CREDENTIALS.VIEW, which only ever sees
// metadata) and every call is written to audit_logs, without the secret
// itself, before the response is sent.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { decryptSecret } from "../_shared/credentialCrypto.ts";

interface RevealPayload {
  companyId: string;
  credentialId: string;
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

    const payload = (await req.json()) as RevealPayload;
    if (!payload.companyId || !payload.credentialId) {
      return json({ error: "companyId and credentialId are required" }, 400);
    }

    const { data: canReveal } = await callerClient.rpc("has_permission", {
      p_company_id: payload.companyId,
      p_permission_key: "IT.CREDENTIALS.REVEAL",
    });

    if (!canReveal) {
      return json({ error: "Forbidden" }, 403);
    }

    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: credential } = await adminClient
      .from("credentials")
      .select("id, system, encrypted_secret, secret_iv")
      .eq("id", payload.credentialId)
      .eq("company_id", payload.companyId)
      .maybeSingle();

    if (!credential) {
      return json({ error: "Credential not found" }, 404);
    }

    // Audit the reveal BEFORE returning the secret, so a failed response
    // delivery can never leave a silent, unaudited disclosure.
    await adminClient.from("audit_logs").insert({
      company_id: payload.companyId,
      actor_user_id: callerUser.id,
      action: "CREDENTIAL_REVEALED",
      resource_type: "credential",
      resource_id: payload.credentialId,
      metadata: { system: credential.system },
    });

    if (!credential.encrypted_secret || !credential.secret_iv) {
      return json({ secret: null }, 200);
    }

    const secret = await decryptSecret(credential.encrypted_secret, credential.secret_iv);
    return json({ secret }, 200);
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

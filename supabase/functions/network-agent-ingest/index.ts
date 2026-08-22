// Ingestion endpoint for a future local ManoloSystem Network Agent:
//
//   Company LAN -> Local Agent -> this function -> Supabase -> IP Monitoring
//
// A Vercel-hosted web app cannot reach into a company's private LAN, so
// real device discovery has to happen on a machine inside that network.
// This function is the "secure API" half of that architecture: it accepts
// a bearer token scoped to one company (see network_agent_tokens; the
// plaintext token is shown once at creation and only its SHA-256 hash is
// ever stored), then upserts whatever devices the agent reports into
// ip_addresses. The agent process itself is out of scope for this phase.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface DevicePayload {
  ip: string;
  mac?: string;
  hostname?: string;
  deviceType?: string;
}

interface IngestPayload {
  devices: DevicePayload[];
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const secretKey =
      Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (!token) {
      return json({ error: "Missing agent token" }, 401);
    }

    const tokenHash = await sha256Hex(token);
    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: agentToken } = await adminClient
      .from("network_agent_tokens")
      .select("id, company_id, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!agentToken || agentToken.revoked_at) {
      return json({ error: "Invalid or revoked agent token" }, 401);
    }

    const payload = (await req.json()) as IngestPayload;
    if (!Array.isArray(payload.devices) || payload.devices.length === 0) {
      return json({ error: "devices[] is required" }, 400);
    }
    if (payload.devices.length > 500) {
      return json({ error: "Too many devices in one request (max 500)" }, 400);
    }

    let upserted = 0;
    for (const device of payload.devices) {
      if (!device.ip) continue;

      const { data: existing } = await adminClient
        .from("ip_addresses")
        .select("id")
        .eq("company_id", agentToken.company_id)
        .eq("ip_address", device.ip)
        .maybeSingle();

      if (existing) {
        await adminClient
          .from("ip_addresses")
          .update({
            mac_address: device.mac ?? null,
            hostname: device.hostname ?? null,
            device_type: device.deviceType ?? "OTHER",
            last_seen: new Date().toISOString(),
            status: "ACTIVE",
          })
          .eq("id", existing.id);
      } else {
        await adminClient.from("ip_addresses").insert({
          company_id: agentToken.company_id,
          ip_address: device.ip,
          mac_address: device.mac ?? null,
          hostname: device.hostname ?? null,
          device_type: device.deviceType ?? "OTHER",
          status: "ACTIVE",
          last_seen: new Date().toISOString(),
        });
      }
      upserted++;
    }

    await adminClient
      .from("network_agent_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", agentToken.id);

    return json({ success: true, upserted }, 200);
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

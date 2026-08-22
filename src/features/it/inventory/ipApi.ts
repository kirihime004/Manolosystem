import { supabase } from "@/lib/supabase/client";
import type { Asset, IpAddress, Profile } from "@/types/database";

type MiniProfile = Pick<Profile, "id" | "first_name" | "last_name" | "avatar_url">;

export interface EnrichedIpAddress extends IpAddress {
  assignee: MiniProfile | null;
  asset: Pick<Asset, "asset_code" | "name"> | null;
}

export interface IpStats {
  total: number;
  active: number;
  inactive: number;
  unknown: number;
  conflicts: number;
}

export async function getIpStats(companyId: string): Promise<IpStats> {
  const { data, error } = await supabase.from("ip_addresses").select("status").eq("company_id", companyId);
  if (error) throw error;
  const rows = data ?? [];
  return {
    total: rows.length,
    active: rows.filter((r) => r.status === "ACTIVE").length,
    inactive: rows.filter((r) => r.status === "INACTIVE").length,
    unknown: rows.filter((r) => r.status === "UNKNOWN").length,
    conflicts: rows.filter((r) => r.status === "CONFLICT").length,
  };
}

export async function listIpAddresses(companyId: string, search?: string): Promise<EnrichedIpAddress[]> {
  let query = supabase.from("ip_addresses").select("*, asset:assets(asset_code, name)").eq("company_id", companyId);
  if (search) {
    const s = search.replace(/[%,]/g, "");
    query = query.or(`hostname.ilike.%${s}%,mac_address.ilike.%${s}%`);
  }
  const { data, error } = await query.order("ip_address");
  if (error) throw error;

  const rows = data as (IpAddress & { asset: Pick<Asset, "asset_code" | "name"> | null })[];
  const userIds = [...new Set(rows.map((r) => r.assigned_to).filter((id): id is string => !!id))];
  let profiles = new Map<string, MiniProfile>();
  if (userIds.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .in("id", userIds);
    if (profileError) throw profileError;
    profiles = new Map((profileRows as MiniProfile[]).map((p) => [p.id, p]));
  }

  return rows.map((r) => ({ ...r, assignee: r.assigned_to ? (profiles.get(r.assigned_to) ?? null) : null }));
}

export async function createIpAddress(input: {
  companyId: string;
  ipAddress: string;
  macAddress?: string | null;
  hostname?: string | null;
  deviceType: string;
  assetId?: string | null;
  assignedTo?: string | null;
  location?: string | null;
  status?: string;
  notes?: string | null;
}): Promise<IpAddress> {
  const { data, error } = await supabase
    .from("ip_addresses")
    .insert({
      company_id: input.companyId,
      ip_address: input.ipAddress,
      mac_address: input.macAddress ?? null,
      hostname: input.hostname ?? null,
      device_type: input.deviceType,
      asset_id: input.assetId ?? null,
      assigned_to: input.assignedTo ?? null,
      location: input.location ?? null,
      status: input.status ?? "ACTIVE",
      notes: input.notes ?? null,
      last_seen: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as IpAddress;
}

export async function updateIpAddress(
  id: string,
  patch: Partial<{
    ipAddress: string;
    macAddress: string | null;
    hostname: string | null;
    deviceType: string;
    assetId: string | null;
    assignedTo: string | null;
    location: string | null;
    status: string;
    notes: string | null;
  }>,
): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (patch.ipAddress !== undefined) fields.ip_address = patch.ipAddress;
  if (patch.macAddress !== undefined) fields.mac_address = patch.macAddress;
  if (patch.hostname !== undefined) fields.hostname = patch.hostname;
  if (patch.deviceType !== undefined) fields.device_type = patch.deviceType;
  if (patch.assetId !== undefined) fields.asset_id = patch.assetId;
  if (patch.assignedTo !== undefined) fields.assigned_to = patch.assignedTo;
  if (patch.location !== undefined) fields.location = patch.location;
  if (patch.status !== undefined) fields.status = patch.status;
  if (patch.notes !== undefined) fields.notes = patch.notes;

  const { error } = await supabase.from("ip_addresses").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteIpAddress(id: string): Promise<void> {
  const { error } = await supabase.from("ip_addresses").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Network agent tokens. The plaintext token is generated and hashed
// entirely client-side with Web Crypto (SubtleCrypto is available in
// every modern browser) -- only the hash is ever sent to Supabase, so it
// never appears in any request the browser doesn't already control.
// ---------------------------------------------------------------------
export function generateAgentToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return "mbnt_" + btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createAgentToken(companyId: string, name: string): Promise<string> {
  const plaintext = generateAgentToken();
  const hash = await sha256Hex(plaintext);
  const { error } = await supabase.from("network_agent_tokens").insert({
    company_id: companyId,
    name,
    token_hash: hash,
  });
  if (error) throw error;
  return plaintext;
}

export async function listAgentTokens(companyId: string) {
  const { data, error } = await supabase
    .from("network_agent_tokens")
    .select("id, name, created_at, last_used_at, revoked_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function revokeAgentToken(id: string): Promise<void> {
  const { error } = await supabase.from("network_agent_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

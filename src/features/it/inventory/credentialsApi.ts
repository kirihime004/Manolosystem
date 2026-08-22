import { supabase } from "@/lib/supabase/client";
import { getFunctionErrorMessage } from "@/lib/supabase/functionError";
import type { Credential, Profile } from "@/types/database";

type MiniProfile = Pick<Profile, "id" | "first_name" | "last_name" | "avatar_url">;

export interface EnrichedCredential extends Credential {
  owner: MiniProfile | null;
}

export async function listCredentials(companyId: string, search?: string): Promise<EnrichedCredential[]> {
  let query = supabase.from("credentials").select("*").eq("company_id", companyId);
  if (search) {
    const s = search.replace(/[%,]/g, "");
    query = query.or(`credential_name.ilike.%${s}%,system.ilike.%${s}%,username.ilike.%${s}%`);
  }
  const { data, error } = await query.order("credential_name");
  if (error) throw error;

  const credentials = data as Credential[];
  const ownerIds = [...new Set(credentials.map((c) => c.assigned_owner).filter((id): id is string => !!id))];
  let owners = new Map<string, MiniProfile>();
  if (ownerIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .in("id", ownerIds);
    if (profileError) throw profileError;
    owners = new Map((profiles as MiniProfile[]).map((p) => [p.id, p]));
  }

  return credentials.map((c) => ({ ...c, owner: c.assigned_owner ? (owners.get(c.assigned_owner) ?? null) : null }));
}

export async function createCredential(input: {
  companyId: string;
  credentialName: string;
  system: string;
  url?: string | null;
  username?: string | null;
  category: string;
  assignedOwner?: string | null;
  notes?: string | null;
}): Promise<Credential> {
  const { data, error } = await supabase
    .from("credentials")
    .insert({
      company_id: input.companyId,
      credential_name: input.credentialName,
      system: input.system,
      url: input.url ?? null,
      username: input.username ?? null,
      category: input.category,
      assigned_owner: input.assignedOwner ?? null,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Credential;
}

export async function updateCredential(
  credentialId: string,
  patch: Partial<{
    credentialName: string;
    system: string;
    url: string | null;
    username: string | null;
    category: string;
    assignedOwner: string | null;
    notes: string | null;
    status: string;
    lastRotated: string | null;
    nextRotation: string | null;
  }>,
): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (patch.credentialName !== undefined) fields.credential_name = patch.credentialName;
  if (patch.system !== undefined) fields.system = patch.system;
  if (patch.url !== undefined) fields.url = patch.url;
  if (patch.username !== undefined) fields.username = patch.username;
  if (patch.category !== undefined) fields.category = patch.category;
  if (patch.assignedOwner !== undefined) fields.assigned_owner = patch.assignedOwner;
  if (patch.notes !== undefined) fields.notes = patch.notes;
  if (patch.status !== undefined) fields.status = patch.status;
  if (patch.lastRotated !== undefined) fields.last_rotated = patch.lastRotated;
  if (patch.nextRotation !== undefined) fields.next_rotation = patch.nextRotation;

  const { error } = await supabase.from("credentials").update(fields).eq("id", credentialId);
  if (error) throw error;
}

export async function deleteCredential(credentialId: string): Promise<void> {
  const { error } = await supabase.from("credentials").delete().eq("id", credentialId);
  if (error) throw error;
}

// Setting/rotating the secret and revealing it both go through Edge
// Functions -- the encryption key never reaches the browser, and every
// reveal is audited server-side before the plaintext is returned.
export async function setCredentialSecret(input: { companyId: string; credentialId: string; secret: string }): Promise<void> {
  const { error } = await supabase.functions.invoke("credential-set-secret", { body: input });
  if (error) throw new Error(await getFunctionErrorMessage(error));
}

export async function revealCredential(input: { companyId: string; credentialId: string }): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("credential-reveal", { body: input });
  if (error) throw new Error(await getFunctionErrorMessage(error));
  return (data as { secret: string | null }).secret;
}

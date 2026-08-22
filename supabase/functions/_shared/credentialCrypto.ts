// AES-256-GCM encrypt/decrypt for credential secrets. The key never leaves
// this server-side environment (it's an Edge Function secret, not a
// database value), so Postgres itself only ever stores ciphertext -- a
// database dump or a client with table SELECT access still can't recover
// the plaintext without also having this key.
async function getKey(): Promise<CryptoKey> {
  const b64 = Deno.env.get("CREDENTIAL_ENCRYPTION_KEY");
  if (!b64) throw new Error("CREDENTIAL_ENCRYPTION_KEY is not configured");
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error("CREDENTIAL_ENCRYPTION_KEY must decode to 32 bytes");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const buf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(buf))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

export async function decryptSecret(ciphertextB64: string, ivB64: string): Promise<string> {
  const key = await getKey();
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const data = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0));
  const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(buf);
}

// supabase-js's PostgrestError (what a failed `.from()`/`.rpc()` call
// throws) is a plain object, not an Error subclass -- `err instanceof
// Error` is false for it, so the common `err instanceof Error ?
// err.message : "fallback"` check silently swallows the real Postgres
// exception text (e.g. a `raise exception` message from an RPC) and shows
// only the generic fallback instead. This checks for a string `.message`
// on anything, which covers both real Errors and PostgrestError alike.
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
}

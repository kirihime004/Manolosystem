// supabase-js's default error for a non-2xx Edge Function response is just
// "Edge Function returned a non-2xx status code" -- it doesn't surface the
// JSON body our functions actually return (e.g. {"error": "..."}). This
// pulls the real message out of the failed response so toasts show
// something a user (or we, debugging) can act on.
export async function getFunctionErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context && typeof context === "object" && "json" in context) {
    try {
      const body = await (context as Response).json();
      if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
        return body.error;
      }
    } catch {
      // fall through to the generic message below
    }
  }
  return error instanceof Error ? error.message : "Something went wrong";
}

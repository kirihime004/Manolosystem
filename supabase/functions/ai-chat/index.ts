// The single server-side entry point for the AI Assistant. Holds the only
// copy of OPENROUTER_API_KEY in the whole system (a Supabase function
// secret, never sent to the browser, never committed). Every business-data
// read the model performs goes through TOOL_REGISTRY -- permission-checked
// RPCs or RLS-scoped selects -- never raw SQL, never the service-role key
// for reads. The service-role key is used ONLY to write the assistant's
// own reply and the usage/audit row after the fact, exactly like every
// other privileged write in this app's other Edge Functions.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { OpenRouterProvider } from "../_shared/ai/OpenRouterProvider.ts";
import { ASSISTANT_SYSTEM_PROMPT } from "../_shared/ai/prompts.ts";
import { TOOL_REGISTRY, type ToolContext } from "../_shared/ai/tools.ts";
import type { AIChatMessage, AIToolCall } from "../_shared/ai/AIProvider.ts";

const MAX_TOOL_ITERATIONS = 4;

interface ChatPayload {
  companyId: string;
  conversationId: string;
  message: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const secretKey = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
  const defaultModel = Deno.env.get("OPENROUTER_DEFAULT_MODEL") ?? "openai/gpt-4o-mini";
  const siteUrl = Deno.env.get("OPENROUTER_SITE_URL");
  const appName = Deno.env.get("OPENROUTER_APP_NAME") ?? "MindBurst";

  let adminClient: SupabaseClient | null = null;
  let payload: ChatPayload | null = null;
  let userId: string | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    adminClient = createClient(supabaseUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: { user: callerUser }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerUser) return json({ error: "Invalid session" }, 401);
    userId = callerUser.id;

    payload = (await req.json()) as ChatPayload;
    if (!payload.companyId || !payload.conversationId || !payload.message?.trim()) {
      return json({ error: "companyId, conversationId, and message are required" }, 400);
    }

    const [{ data: moduleEnabled }, { data: canUseAssistant }] = await Promise.all([
      callerClient.rpc("has_module_enabled", { p_company_id: payload.companyId, p_module_key: "AI" }),
      callerClient.rpc("has_permission", { p_company_id: payload.companyId, p_permission_key: "AI.ASSISTANT.VIEW" }),
    ]);
    if (!moduleEnabled) return json({ error: "AI is not enabled for this company." }, 403);
    if (!canUseAssistant) return json({ error: "Forbidden" }, 403);

    const { data: conversation } = await callerClient
      .from("ai_conversations")
      .select("id, user_id, title")
      .eq("id", payload.conversationId)
      .eq("company_id", payload.companyId)
      .maybeSingle();
    if (!conversation || conversation.user_id !== callerUser.id) {
      return json({ error: "Conversation not found" }, 404);
    }

    // Usage limits -- fail closed, never silently over-spend.
    const { data: settings } = await adminClient
      .from("ai_company_settings")
      .select("enabled, monthly_token_limit, monthly_request_limit, default_model")
      .eq("company_id", payload.companyId)
      .maybeSingle();

    if (settings && settings.enabled === false) {
      return json({ error: "AI has been disabled for this company by an administrator." }, 403);
    }

    if (settings?.monthly_request_limit || settings?.monthly_token_limit) {
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const { data: usageRows } = await adminClient
        .from("ai_requests")
        .select("input_tokens, output_tokens")
        .eq("company_id", payload.companyId)
        .eq("status", "SUCCESS")
        .gte("created_at", monthStart.toISOString());
      const requestCount = usageRows?.length ?? 0;
      const tokenCount = (usageRows ?? []).reduce((sum, r) => sum + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0);
      const overRequests = settings.monthly_request_limit != null && requestCount >= settings.monthly_request_limit;
      const overTokens = settings.monthly_token_limit != null && tokenCount >= settings.monthly_token_limit;
      if (overRequests || overTokens) {
        await adminClient.from("ai_requests").insert({
          company_id: payload.companyId, user_id: callerUser.id, conversation_id: payload.conversationId,
          request_type: "CHAT", provider: "openrouter", status: "LIMIT_EXCEEDED", error_type: "monthly_limit",
        });
        return json({ error: "This company's monthly AI usage limit has been reached." }, 429);
      }
    }

    if (!openRouterKey) {
      return json({ error: "AI service is not configured." }, 503);
    }

    // Insert the user's turn as the caller (RLS-enforced: role must be USER
    // and the conversation must belong to them -- see ai_messages_insert_own).
    const { error: insertUserError } = await callerClient.from("ai_messages").insert({
      conversation_id: payload.conversationId, company_id: payload.companyId, role: "USER", content: payload.message,
    });
    if (insertUserError) return json({ error: insertUserError.message }, 400);

    // Which tools this specific caller is allowed to use, this request.
    const { data: myPermissions } = await callerClient.rpc("get_my_permission_keys", { p_company_id: payload.companyId });
    const permissionSet = new Set<string>(myPermissions ?? []);
    const availableTools = TOOL_REGISTRY.filter((t) => permissionSet.has(t.requiredPermission));

    const { data: history } = await callerClient
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", payload.conversationId)
      .order("created_at", { ascending: true })
      .limit(30);

    const messages: AIChatMessage[] = [
      { role: "system", content: ASSISTANT_SYSTEM_PROMPT },
      ...(history ?? []).map((m): AIChatMessage => ({ role: m.role.toLowerCase() as "user" | "assistant", content: m.content })),
    ];

    const provider = new OpenRouterProvider(openRouterKey, siteUrl, appName);
    const model = settings?.default_model || defaultModel;
    const toolContext: ToolContext = { client: callerClient, companyId: payload.companyId, userId: callerUser.id };

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let finalContent: string | null = null;
    let actualModel = model;
    const collectedToolCalls: { tool: string; arguments: Record<string, unknown>; result: unknown }[] = [];

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const result = await provider.chat(messages, availableTools.map((t) => t.definition), model);
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;
      actualModel = result.model;

      if (result.toolCalls.length === 0) {
        finalContent = result.content;
        break;
      }

      messages.push({
        role: "assistant",
        content: result.content ?? "",
        tool_calls: result.toolCalls.map((tc: AIToolCall) => ({ id: tc.id, type: "function", function: { name: tc.name, arguments: JSON.stringify(tc.arguments) } })),
      });

      for (const call of result.toolCalls) {
        const tool = availableTools.find((t) => t.definition.name === call.name);
        let toolResult: unknown;
        if (!tool) {
          toolResult = { error: "Tool not available for this user." };
        } else {
          try {
            toolResult = await tool.execute(toolContext, call.arguments);
          } catch (err) {
            toolResult = { error: err instanceof Error ? err.message : "Tool execution failed." };
          }
        }
        collectedToolCalls.push({ tool: call.name, arguments: call.arguments, result: toolResult });
        messages.push({ role: "tool", tool_call_id: call.id, name: call.name, content: JSON.stringify(toolResult) });
      }

      if (iteration === MAX_TOOL_ITERATIONS - 1) {
        finalContent = "I gathered some data but couldn't finish analyzing it within my step limit. Please ask a more specific follow-up.";
      }
    }

    const answer = finalContent ?? "I wasn't able to generate a response.";

    const { data: assistantMessage, error: insertAssistantError } = await adminClient
      .from("ai_messages")
      .insert({
        conversation_id: payload.conversationId, company_id: payload.companyId, role: "ASSISTANT",
        content: answer, tool_calls: collectedToolCalls.length > 0 ? collectedToolCalls : null,
      })
      .select("*")
      .single();
    if (insertAssistantError) return json({ error: insertAssistantError.message }, 500);

    await adminClient.from("ai_requests").insert({
      company_id: payload.companyId, user_id: callerUser.id, conversation_id: payload.conversationId,
      request_type: "CHAT", provider: "openrouter", model: actualModel, requested_model: model,
      input_tokens: totalInputTokens, output_tokens: totalOutputTokens, latency_ms: Date.now() - startedAt, status: "SUCCESS",
    });

    if (conversation.title === "New conversation") {
      await adminClient.from("ai_conversations").update({ title: payload.message.slice(0, 60) }).eq("id", payload.conversationId);
    }

    return json({ message: assistantMessage }, 200);
  } catch (err) {
    if (adminClient && payload) {
      await adminClient.from("ai_requests").insert({
        company_id: payload.companyId, user_id: userId, conversation_id: payload.conversationId,
        request_type: "CHAT", provider: "openrouter", status: "ERROR",
        error_type: err instanceof Error ? err.message.slice(0, 200) : "unknown",
      }).then(() => {}, () => {});
    }
    return json({ error: "AI service is temporarily unavailable." }, 502);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

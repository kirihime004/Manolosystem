import type { AIChatMessage, AIChatResult, AIProvider, AIToolDefinition } from "./AIProvider.ts";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 10_000;

// The only file in this app that knows OpenRouter's request/response
// shape. Reads its key from Deno.env -- never hard-coded, never sent to
// the browser -- set via `supabase secrets set OPENROUTER_API_KEY=...`.
export class OpenRouterProvider implements AIProvider {
  private readonly apiKey: string;
  private readonly siteUrl?: string;
  private readonly appName?: string;

  constructor(apiKey: string, siteUrl?: string, appName?: string) {
    this.apiKey = apiKey;
    this.siteUrl = siteUrl;
    this.appName = appName;
  }

  async chat(messages: AIChatMessage[], tools: AIToolDefinition[], model: string): Promise<AIChatResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(this.siteUrl ? { "HTTP-Referer": this.siteUrl } : {}),
          ...(this.appName ? { "X-Title": this.appName } : {}),
        },
        body: JSON.stringify({
          model,
          messages,
          ...(tools.length > 0
            ? { tools: tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })), tool_choice: "auto" }
            : {}),
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`OpenRouter error ${res.status}: ${text.slice(0, 300)}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const message = choice?.message;

      const toolCalls = (message?.tool_calls ?? []).map((tc: { id: string; function: { name: string; arguments: string } }) => {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          args = {};
        }
        return { id: tc.id, name: tc.function.name, arguments: args };
      });

      return {
        content: message?.content ?? null,
        toolCalls,
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
        model: data.model ?? model,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

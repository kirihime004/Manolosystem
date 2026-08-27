// Provider-agnostic AI chat contract. OpenRouterProvider is the only
// implementation today; a future OpenAIProvider/AnthropicProvider only
// needs to satisfy this interface -- nothing else in ai-chat/index.ts or
// tools.ts references OpenRouter directly.
export interface AIChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
}

export interface AIToolDefinition {
  name: string;
  description: string;
  parameters: { type: "object"; properties: Record<string, unknown>; required?: string[] };
}

export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AIChatResult {
  content: string | null;
  toolCalls: AIToolCall[];
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface AIProvider {
  chat(messages: AIChatMessage[], tools: AIToolDefinition[], model: string): Promise<AIChatResult>;
}

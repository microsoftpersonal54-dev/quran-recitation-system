import "server-only";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenRouterToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface OpenRouterToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenRouterTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatCompletionResult {
  message: OpenRouterMessage;
  finishReason: string | null;
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_MODEL);
}

export function aiModelName(): string {
  return process.env.OPENROUTER_MODEL ?? "";
}

export async function chatCompletion(params: {
  messages: OpenRouterMessage[];
  tools?: OpenRouterTool[];
  temperature?: number;
}): Promise<ChatCompletionResult> {
  if (!isAiConfigured()) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const body: Record<string, unknown> = {
    model: aiModelName(),
    messages: params.messages,
    temperature: params.temperature ?? 0.1,
  };
  if (params.tools && params.tools.length > 0) {
    body.tools = params.tools;
    body.tool_choice = "auto";
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      // Recommended by OpenRouter for analytics; harmless if blank.
      "HTTP-Referer": process.env.APP_URL ?? "http://localhost:3000",
      "X-Title": process.env.APP_NAME ?? "Quran Recitation Record",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OPENROUTER_HTTP_${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{
      message?: OpenRouterMessage;
      finish_reason?: string;
    }>;
  };

  const choice = data.choices?.[0];
  if (!choice?.message) {
    throw new Error("OPENROUTER_EMPTY_RESPONSE");
  }

  return {
    message: choice.message,
    finishReason: choice.finish_reason ?? null,
  };
}
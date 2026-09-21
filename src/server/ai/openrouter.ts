import "server-only";
import { siteUrl, internalFunctionSecret } from "@/lib/netlify/site-url";

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

function proxyUrl(): string | null {
  const secret = internalFunctionSecret();
  const onNetlify = Boolean(process.env.NETLIFY || process.env.URL);
  if (!secret || !onNetlify) return null;
  return `${siteUrl()}/.netlify/functions/ai-proxy`;
}

export async function chatCompletion(params: {
  messages: OpenRouterMessage[];
  tools?: OpenRouterTool[];
  temperature?: number;
}): Promise<ChatCompletionResult> {
  if (!isAiConfigured()) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const viaProxy = proxyUrl();
  const payload: Record<string, unknown> = {
    messages: params.messages,
    temperature: params.temperature ?? 0.1,
  };
  if (params.tools && params.tools.length > 0) {
    payload.tools = params.tools;
  }

  const res = viaProxy
    ? await fetch(viaProxy, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${internalFunctionSecret()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
    : await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.APP_URL ?? siteUrl(),
          "X-Title": process.env.APP_NAME ?? "Quran Recitation Record",
        },
        body: JSON.stringify({
          model: aiModelName(),
          messages: params.messages,
          temperature: params.temperature ?? 0.1,
          ...(params.tools && params.tools.length > 0
            ? { tools: params.tools, tool_choice: "auto" }
            : {}),
        }),
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

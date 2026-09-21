import type { Handler } from "@netlify/functions";

/**
 * Server-side OpenRouter proxy. The API key never leaves Netlify env.
 * Called by the Next.js /api/ai/query tool loop — not from the browser.
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const secret = process.env.INTERNAL_FUNCTION_SECRET;
  const auth = event.headers.authorization ?? event.headers.Authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!secret || token !== secret) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  if (!apiKey || !model) {
    return {
      statusCode: 503,
      body: JSON.stringify({ error: "AI_NOT_CONFIGURED" }),
    };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(event.body || "{}") as Record<string, unknown>;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON." }) };
  }

  const body = {
    model,
    messages: payload.messages,
    temperature: payload.temperature ?? 0.1,
    ...(Array.isArray(payload.tools) && payload.tools.length > 0
      ? { tools: payload.tools, tool_choice: "auto" }
      : {}),
  };

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || process.env.URL || "",
      "X-Title": process.env.APP_NAME ?? "Quran Recitation Record",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  return {
    statusCode: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") || "application/json",
      ...corsHeaders(),
    },
    body: text,
  };
};

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": process.env.APP_URL || process.env.URL || "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

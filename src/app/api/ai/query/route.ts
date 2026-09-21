import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { answerQuestion } from "@/server/ai/agent";
import { isAiConfigured } from "@/server/ai/openrouter";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      })
    )
    .min(1)
    .max(30),
});

export async function GET() {
  return NextResponse.json({ configured: isAiConfigured() });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.role !== "FATHER") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = querySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await answerQuestion({
      fatherId: user.id,
      fatherName: user.name,
      messages: parsed.data.messages,
    });

    await audit({
      userId: user.id,
      action: "ai.query",
      metadata: {
        toolCalls: result.toolCallsUsed.map((t) => t.name),
      },
    });

    return NextResponse.json({
      reply: result.reply,
      toolCallsUsed: result.toolCallsUsed,
    });
  } catch (err) {
    console.error("[ai.query] failed", err);
    const code = (err as Error).message;
    if (code === "AI_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "AI_NOT_CONFIGURED" },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "The AI assistant is temporarily unavailable." },
      { status: 502 }
    );
  }
}
import "server-only";
import {
  chatCompletion,
  isAiConfigured,
  OpenRouterMessage,
  OpenRouterTool,
} from "./openrouter";
import { TOOL_DEFINITIONS, executeTool } from "./tools";
import { db } from "@/lib/db";

const MAX_TOOL_ROUNDS = 5;

function buildSystemPrompt(params: {
  fatherName: string;
  studentNames: string[];
  nowIso: string;
  timezone: string;
}): string {
  const studentLine =
    params.studentNames.length > 0
      ? `Students in this family: ${params.studentNames.join(", ")}.`
      : "No student accounts exist yet.";

    return [
    "You are a private assistant inside a Quran recitation record app for a single family.",
    "",
    "Your ONLY source of truth is the tools available to you. You MUST call a tool before stating any fact about recitations, mistakes, dates, times, durations, attendance, leaves, paras, or progress.",
    "",
    "Hard rules:",
    "- Never invent recordings, times, dates, surah names, mistake counts, attendance, leaves, or any other factual information.",
    "- If the tools return no matching data, say clearly: \"I don't have any records of that.\"",
    "- Do not guess. Do not use prior knowledge about the user's family or habits.",
    "- Use the exact dates, times, and durations returned by the tools.",
    "- Format durations exactly as the tools provide them (e.g. \"0:05\" or \"12:34\").",
    "- When asked about a date like \"yesterday\" or \"last week\", first compute the correct dates, then call the relevant tool.",
    "- Address the father respectfully and plainly. Keep answers concise and factual.",
    "",
    "Tool guide:",
    "- For 'what did he do on <date>' use get_day_detail.",
    "- For attendance or leaves use get_attendance or get_leaves.",
    "- For 'how many paras' or 'which para' use get_para_progress.",
    "- For 'how much total time' use get_progress_summary.",
    "- For 'what did he recite <range>' use get_recitations.",
    "",
    `Current date and time (ISO): ${params.nowIso}`,
    `Timezone: ${params.timezone}`,
    `The father's name: ${params.fatherName}`,
    studentLine,
  ].join("\n");
}

export interface AiQueryResult {
  reply: string;
  toolCallsUsed: { name: string; args: unknown }[];
}

export async function answerQuestion(params: {
  fatherId: string;
  fatherName: string;
  messages: { role: "user" | "assistant"; content: string }[];
}): Promise<AiQueryResult> {
  if (!isAiConfigured()) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  // Fetch student names for prompt context.
  const students = await db.user.findMany({
    where: { role: "STUDENT", active: true },
    select: { name: true },
  });

  const nowIso = new Date().toISOString();
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";

  const system = buildSystemPrompt({
    fatherName: params.fatherName,
    studentNames: students.map((s) => s.name),
    nowIso,
    timezone,
  });

  const tools: OpenRouterTool[] = TOOL_DEFINITIONS.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const conversation: OpenRouterMessage[] = [
    { role: "system", content: system },
    ...params.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const toolCallsUsed: { name: string; args: unknown }[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await chatCompletion({
      messages: conversation,
      tools,
      temperature: 0.1,
    });

    const msg = result.message;

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      const content = typeof msg.content === "string" ? msg.content : "";
      return { reply: content, toolCallsUsed };
    }

    // Append the assistant message with tool_calls so the model has context.
    conversation.push({
      role: "assistant",
      content: msg.content ?? null,
      tool_calls: msg.tool_calls,
    });

    for (const call of msg.tool_calls) {
      let parsedArgs: unknown = {};
      try {
        parsedArgs = call.function.arguments
          ? JSON.parse(call.function.arguments)
          : {};
      } catch {
        parsedArgs = {};
      }
      toolCallsUsed.push({ name: call.function.name, args: parsedArgs });

      const result = await executeTool(
        call.function.name,
        call.function.arguments
      );

      conversation.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.function.name,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    reply:
      "I wasn't able to finish that lookup in the allotted time. Try a more specific question.",
    toolCallsUsed,
  };
}
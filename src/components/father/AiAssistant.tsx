"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "What did he recite yesterday?",
  "How much Quran did he recite this week?",
  "How many mistakes this month?",
  "Which recordings have not been reviewed?",
  "How much total recitation time does he have?",
  "Show me the recordings from last week.",
];

export default function AiAssistant() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/ai/query");
        const data = await res.json();
        setConfigured(Boolean(data.configured));
      } catch {
        setConfigured(false);
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || busy) return;
    setError(null);
    setInput("");

    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(next);
    setBusy(true);

    try {
      const res = await fetch("/api/ai/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "AI_NOT_CONFIGURED") {
          setConfigured(false);
          throw new Error("AI Assistant is currently unavailable.");
        }
        throw new Error(data.error ?? "Request failed.");
      }
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setBusy(false);
    }
  }

  if (configured === null) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500">
        Checking assistant…
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <Sparkles className="h-4 w-4" aria-hidden />
          AI Assistant
        </div>
        <p className="mt-2 text-sm text-neutral-700">
          AI Assistant is currently unavailable.
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Add <code className="rounded bg-neutral-100 px-1">OPENROUTER_API_KEY</code>{" "}
          and{" "}
          <code className="rounded bg-neutral-100 px-1">OPENROUTER_MODEL</code>{" "}
          to <code className="rounded bg-neutral-100 px-1">.env.local</code> and
          restart the app to enable it.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col rounded-xl border border-neutral-200 bg-white">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="py-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <Sparkles className="h-4 w-4" aria-hidden />
              Quran Progress Assistant
            </div>
            <p className="mt-1 text-sm text-neutral-600">
              Ask about the student's recitations. Answers come from the
              stored records only.
            </p>

            <div className="mt-4 space-y-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="block w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-sm text-neutral-800 hover:border-neutral-300 hover:bg-white"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {messages.map((m, i) => (
              <li
                key={i}
                className={
                  m.role === "user"
                    ? "flex justify-end"
                    : "flex justify-start"
                }
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${
                    m.role === "user"
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-900"
                  }`}
                >
                  {m.content}
                </div>
              </li>
            ))}
            {busy && (
              <li className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-neutral-100 px-3.5 py-2.5 text-sm text-neutral-600">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Looking up records…
                </div>
              </li>
            )}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="border-t border-neutral-100 p-3">
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {error}
          </p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-neutral-200 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          disabled={busy}
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none disabled:bg-neutral-50"
        />
        <button
          type="submit"
          disabled={busy || input.trim().length === 0}
          aria-label="Send"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-neutral-900 text-white disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
        </button>
      </form>
    </div>
  );
}
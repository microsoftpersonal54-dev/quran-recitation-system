import { requireRole } from "@/lib/auth/guards";
import AiAssistant from "@/components/father/AiAssistant";

export const dynamic = "force-dynamic";

export default async function FatherAiPage() {
  const user = await requireRole(["FATHER"]);
  return (
    <div>
      <header className="mb-4">
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          Assistant
        </p>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">
          Ask about {user.name === "Father" ? "the student" : "progress"}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Answers come only from your stored records.
        </p>
      </header>
      <AiAssistant />
    </div>
  );
}
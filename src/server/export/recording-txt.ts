import "server-only";
import { db } from "@/lib/db";
import { formatMs } from "@/lib/format";

/**
 * Produce a human-readable text export of a recording.
 * Never includes raw filesystem paths.
 */
export async function recordingToTxt(id: string): Promise<string | null> {
  const rec = await db.recording.findFirst({
    where: { id, deletedAt: null },
    include: {
      student: { select: { name: true } },
      mistakes: {
        orderBy: { timestampMs: "asc" },
        include: { reviewer: { select: { name: true } } },
      },
    },
  });

  if (!rec) return null;

  const date = new Date(rec.recordedAt);
  const dateStr = date.toISOString().slice(0, 10);
  const timeStr = date.toTimeString().slice(0, 5);

  const lines: string[] = [];
  lines.push("# RECITATION RECORD");
  lines.push("");
  lines.push(`Student:      ${rec.student.name}`);
  lines.push(`Date:         ${dateStr}`);
  lines.push(`Time:         ${timeStr}`);
  lines.push(`Surah:        ${rec.surahName} (${rec.surahNumber})`);
  lines.push(`Ayah From:    ${rec.ayahFrom}`);
  lines.push(`Ayah To:      ${rec.ayahTo}`);
  lines.push(`Duration:     ${formatMs(rec.durationMs)}`);
  lines.push(`Review:       ${rec.reviewStatus.replace("_", " ")}`);
  lines.push(
    `Mistakes:     ${rec.mistakes.length}`
  );
  lines.push("");

  if (rec.notes) {
    lines.push("## Student notes");
    lines.push("");
    lines.push(rec.notes);
    lines.push("");
  }

  if (rec.mistakes.length === 0) {
    lines.push("## Mistakes");
    lines.push("");
    lines.push("(none recorded)");
    lines.push("");
  } else {
    lines.push("## Mistakes");
    lines.push("");
    for (const m of rec.mistakes) {
      lines.push(formatMs(m.timestampMs));
      if (m.ayahNumber != null) lines.push(`Ayah: ${m.ayahNumber}`);
      lines.push(`Category: ${m.category}`);
      lines.push(`Severity: ${m.severity}`);
      lines.push(`Description: ${m.description}`);
      if (m.correction) lines.push(`Correction: ${m.correction}`);
      lines.push(`Reviewer: ${m.reviewer.name}`);
      lines.push("");
    }
  }

  const reviewers = Array.from(
    new Set(rec.mistakes.map((m) => m.reviewer.name))
  );
  if (reviewers.length > 0) {
    lines.push(`Reviewer(s): ${reviewers.join(", ")}`);
  }
  lines.push("");
  lines.push(`Exported: ${new Date().toISOString()}`);

  return lines.join("\n");
}
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { Readable } from "node:stream";
import { getCurrentUser } from "@/lib/auth/session";
import { openRecordingStream } from "@/server/recordings/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const result = await openRecordingStream(id);
  if (!result) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { recording, fullPath } = result;

  if (user.role === "STUDENT" && recording.studentId !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const stat = await fs.promises.stat(fullPath);
  const totalBytes = stat.size;
  const range = req.headers.get("range");

  // Basic range support so the <audio> element can seek.
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : totalBytes - 1;
      if (
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        start >= 0 &&
        end >= start &&
        end < totalBytes
      ) {
        const nodeStream = fs.createReadStream(fullPath, { start, end });
        const webStream = Readable.toWeb(nodeStream) as ReadableStream;
        return new NextResponse(webStream, {
          status: 206,
          headers: {
            "Content-Type": recording.mimeType,
            "Content-Length": String(end - start + 1),
            "Content-Range": `bytes ${start}-${end}/${totalBytes}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": "private, no-store",
          },
        });
      }
    }
  }

  const nodeStream = fs.createReadStream(fullPath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;
  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": recording.mimeType,
      "Content-Length": String(totalBytes),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
    },
  });
}
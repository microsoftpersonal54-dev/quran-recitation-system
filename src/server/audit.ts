import "server-only";
import { db } from "@/lib/db";

export async function audit(params: {
  userId?: string | null;
  action: string;
  target?: string | null;
  metadata?: unknown;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        target: params.target ?? null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed", err);
  }
}
import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, homeForRole, SessionUser } from "./session";

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(
  allowed: Array<"STUDENT" | "FATHER" | "QARI">
): Promise<SessionUser> {
  const user = await requireUser();
  if (!allowed.includes(user.role as never)) {
    redirect(homeForRole(user.role));
  }
  return user;
}
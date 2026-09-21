import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, homeForRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const count = await db.user.count();
  if (count === 0) redirect("/setup");

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  redirect(homeForRole(user.role));
}
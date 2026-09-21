import FatherNav from "@/components/father/FatherNav";
import { requireRole } from "@/lib/auth/guards";
import { getUnreadCount } from "@/server/notifications/service";

export const dynamic = "force-dynamic";

export default async function FatherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["FATHER"]);
  const unread = await getUnreadCount(user.id);

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">{children}</div>
      <FatherNav unreadCount={unread} />
    </div>
  );
}
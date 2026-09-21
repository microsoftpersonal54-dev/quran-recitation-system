import { requireRole } from "@/lib/auth/guards";
import ProgressView from "@/components/progress/ProgressView";

export const dynamic = "force-dynamic";

export default async function StudentProgressPage() {
  const user = await requireRole(["STUDENT"]);
  return (
    <ProgressView
      studentId={user.id}
      title="Your progress"
      subtitle="A view of your own recitations over time."
    />
  );
}
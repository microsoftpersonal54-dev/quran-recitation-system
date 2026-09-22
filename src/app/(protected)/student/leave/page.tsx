import { requireRole } from "@/lib/auth/guards";
import LeaveClient from "@/components/student/LeaveClient";

export const dynamic = "force-dynamic";

export default async function StudentLeavePage() {
  const user = await requireRole(["STUDENT"]);

  return (
    <div>
      <header className="mb-5">
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          Leave
        </p>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">
          Mark a leave day
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Tap any date to mark it as leave.
        </p>
      </header>
      <LeaveClient studentId={user.id} />
    </div>
  );
}
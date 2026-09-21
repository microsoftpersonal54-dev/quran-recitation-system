import { requireRole } from "@/lib/auth/guards";
import ProgressView from "@/components/progress/ProgressView";

export const dynamic = "force-dynamic";

export default async function FatherProgressPage() {
  await requireRole(["FATHER"]);
  return (
    <ProgressView
      title="Progress"
      subtitle="Overall activity from every recording in the archive."
    />
  );
}
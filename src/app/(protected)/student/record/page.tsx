import { requireRole } from "@/lib/auth/guards";
import Recorder from "@/components/student/Recorder";

export default async function RecordPage() {
  const user = await requireRole(["STUDENT"]);
  return <Recorder studentName={user.name} />;
}
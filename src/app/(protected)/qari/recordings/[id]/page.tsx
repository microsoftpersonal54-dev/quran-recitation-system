import { requireRole } from "@/lib/auth/guards";
import RecordingDetail from "@/components/review/RecordingDetail";

export const dynamic = "force-dynamic";

export default async function QariRecordingDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["QARI"]);
  const { id } = await params;
  return (
    <RecordingDetail
      id={id}
      backHref="/qari"
      backLabel="Review queue"
      canEdit
    />
  );
}
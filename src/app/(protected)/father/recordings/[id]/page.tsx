import { requireRole } from "@/lib/auth/guards";
import RecordingDetail from "@/components/review/RecordingDetail";

export const dynamic = "force-dynamic";

export default async function FatherRecordingDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["FATHER"]);
  const { id } = await params;
  return (
    <RecordingDetail
      id={id}
      backHref="/father/recordings"
      backLabel="All recordings"
      canEdit
    />
  );
}
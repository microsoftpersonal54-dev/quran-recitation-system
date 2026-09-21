import BottomNav from "@/components/student/BottomNav";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-md px-4 pb-24 pt-6">{children}</div>
      <BottomNav />
    </div>
  );
}
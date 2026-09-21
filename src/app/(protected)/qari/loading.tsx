import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <header className="mb-6">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-2 h-6 w-56" />
        <Skeleton className="mt-2 h-4 w-48" />
      </header>

      <SkeletonList rows={5} />
    </div>
  );
}
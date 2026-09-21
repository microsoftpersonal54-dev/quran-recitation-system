import { Skeleton, SkeletonCard, SkeletonList } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <header className="mb-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-6 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
      </header>

      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <section className="mt-6">
        <Skeleton className="h-4 w-40" />
        <div className="mt-3">
          <SkeletonList rows={3} />
        </div>
      </section>
    </div>
  );
}
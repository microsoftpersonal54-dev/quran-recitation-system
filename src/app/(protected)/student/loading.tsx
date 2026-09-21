import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <header className="mb-6">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-2 h-6 w-56" />
        <Skeleton className="mt-2 h-4 w-64" />
      </header>

      <Skeleton className="h-24 w-full rounded-xl" />

      <section className="mt-8">
        <Skeleton className="h-4 w-32" />
        <div className="mt-3">
          <SkeletonList rows={3} />
        </div>
      </section>
    </div>
  );
}
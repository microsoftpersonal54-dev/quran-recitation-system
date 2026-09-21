export function Skeleton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-md bg-neutral-200 ${className}`}
      aria-hidden
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <Skeleton className="h-3 w-24" />
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <li
          key={i}
          className="rounded-xl border border-neutral-200 bg-white p-4"
        >
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-2 h-3 w-32" />
        </li>
      ))}
    </ul>
  );
}
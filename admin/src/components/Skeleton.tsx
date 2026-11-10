// A plain "Загрузка…" string leaves every page blank while data fetches —
// the thing people actually see on every single page open. This renders
// the real layout's shape immediately (in the brand's own hairline tone,
// pulsing) so the app feels like it's already there, just filling in.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-hairline/70 ${className}`} />;
}

export function SkeletonProductCard() {
  return (
    <div>
      <Skeleton className="aspect-[3/4] w-full rounded-none" />
      <div className="mt-5 flex flex-col items-center gap-2 px-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3.5 w-16" />
      </div>
    </div>
  );
}

export function SkeletonRow({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${className}`}>
      <Skeleton className="h-10 w-10 flex-none rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-4 w-16 flex-none" />
    </div>
  );
}

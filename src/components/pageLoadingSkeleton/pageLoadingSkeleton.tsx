import type { PageLoadingSkeletonProps } from "./pageLoadingSkeleton.types";

// dark:bg-white/10 (not dark:bg-muted) — these blocks render on top of
// bg-muted / bg-card surfaces that are nearly the same tone as --muted in
// dark mode, so a --muted-based fill would be invisible. A translucent
// white overlay stays visible against any dark surface, matching the
// pattern already used for the Sidebar's own nav skeleton.
function AdminSkeleton() {
  return (
    <div className="flex-1 space-y-6">
      <div className="h-9 w-48 rounded-md bg-slate-300/60 dark:bg-white/10 animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-xl bg-slate-300/60 dark:bg-white/10 animate-pulse"
          />
        ))}
      </div>
      <div className="h-64 w-full rounded-xl bg-slate-300/60 dark:bg-white/10 animate-pulse" />
    </div>
  );
}

function LoginSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-md bg-card rounded-[var(--modal-radius)] shadow-[var(--card-shadow)] border border-border p-8 space-y-6">
        {/* Logo placeholder */}
        <div className="text-center space-y-2">
          <div className="h-9 w-40 rounded-md bg-slate-300/60 dark:bg-white/10 animate-pulse mx-auto" />
          <div className="h-4 w-28 rounded-md bg-slate-300/60 dark:bg-white/10 animate-pulse mx-auto" />
        </div>
        {/* Form skeleton */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-slate-300/60 dark:bg-white/10 animate-pulse" />
            <div className="h-10 w-full rounded-lg bg-slate-300/60 dark:bg-white/10 animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-20 rounded bg-slate-300/60 dark:bg-white/10 animate-pulse" />
            <div className="h-10 w-full rounded-lg bg-slate-300/60 dark:bg-white/10 animate-pulse" />
          </div>
          <div className="h-11 w-full rounded-full bg-slate-300/60 dark:bg-white/10 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

const skeletonMap = {
  admin: AdminSkeleton,
  login: LoginSkeleton,
} as const;

export function PageLoadingSkeleton({ variant }: PageLoadingSkeletonProps) {
  const Skeleton = skeletonMap[variant];
  return <Skeleton />;
}

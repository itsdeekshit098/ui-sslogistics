import type { PageLoadingSkeletonProps } from "./pageLoadingSkeleton.types";

function AdminSkeleton() {
  return (
    <div className="flex-1 space-y-6">
      <div className="h-9 w-48 rounded-md bg-muted animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
      <div className="h-64 w-full rounded-xl bg-muted animate-pulse" />
    </div>
  );
}

function LoginSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0F4FF] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-6">
        {/* Logo placeholder */}
        <div className="text-center space-y-2">
          <div className="h-9 w-40 rounded-md bg-muted animate-pulse mx-auto" />
          <div className="h-4 w-28 rounded-md bg-muted animate-pulse mx-auto" />
        </div>
        {/* Form skeleton */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            <div className="h-10 w-full rounded-lg bg-muted animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-20 rounded bg-muted animate-pulse" />
            <div className="h-10 w-full rounded-lg bg-muted animate-pulse" />
          </div>
          <div className="h-11 w-full rounded-full bg-muted animate-pulse" />
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

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowLeftIcon } from "@/components/ui/icon";
import type { PageHeaderProps } from "./pageHeader.types";

/**
 * The title/description/actions block repeated at the top of every admin
 * page — previously hand-rebuilt per page with drifting heading sizes
 * (text-2xl vs text-3xl) and, on detail pages, a plain text "← Back" link
 * with no shared styling.
 */
export function PageHeader({
  title,
  description,
  badge,
  backHref,
  backLabel = "Back",
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn(className)}>
      {backHref && (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon size={16} /> {backLabel}
        </Link>
      )}

      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
            {badge}
          </div>
          {description && <p className="mt-1 text-muted-foreground">{description}</p>}
        </div>

        {actions && (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div>
        )}
      </div>
    </div>
  );
}

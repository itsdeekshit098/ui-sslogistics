import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, PlusIcon } from "@/components/ui/icon";
import { PageFab } from "@/components/ui/pageFab";
import { Tooltip } from "@/components/ui/tooltip";
import type { PageHeaderProps } from "./pageHeader.types";

/**
 * The title/description/actions block repeated at the top of every admin
 * page — previously hand-rebuilt per page with drifting heading sizes
 * (text-2xl vs text-3xl) and, on detail pages, a plain text "← Back" link
 * with no shared styling.
 *
 * Below md the mobile top bar already shows the page name and the back
 * button, so a list page's title block is hidden there, a detail page's
 * title shrinks, and `primaryAction` moves into a floating button.
 */
export function PageHeader({
  title,
  description,
  badge,
  backHref,
  backLabel = "Back",
  actions,
  primaryAction,
  className,
}: PageHeaderProps) {
  const isDetail = !!backHref;
  const primaryIcon = primaryAction?.icon ?? <PlusIcon size={16} />;

  const renderPrimaryButton = () =>
    primaryAction && (
      <Button
        data-testid={primaryAction.testId}
        onClick={primaryAction.onClick}
        disabled={primaryAction.disabled}
        className="max-md:hidden"
      >
        <span className="mr-2 inline-flex">{primaryIcon}</span>
        {primaryAction.label}
      </Button>
    );

  return (
    <>
      <div className={cn(!isDetail && !actions && "max-md:hidden", className)}>
        {backHref && (
          <Link
            href={backHref}
            className="mb-3 hidden items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
          >
            <ArrowLeftIcon size={16} /> {backLabel}
          </Link>
        )}

        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center md:gap-4">
          <div className={cn("min-w-0", !isDetail && "max-md:hidden")}>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground md:text-3xl">
                {title}
              </h1>
              {badge}
            </div>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground md:text-base">
                {description}
              </p>
            )}
          </div>

          {(actions || primaryAction) && (
            <div
              className={cn(
                "flex w-full flex-wrap gap-2 sm:w-auto",
                // Detail-page actions on phones: equal-width tiles with the
                // icon over a short label, instead of buttons wrapping onto
                // a ragged second row. Labels wrap inside the tile rather than
                // clipping when four share the width ("Recover Principal").
                isDetail &&
                  "max-sm:grid max-sm:auto-cols-fr max-sm:grid-flow-col max-sm:[&>button]:h-auto max-sm:[&>button]:flex-col max-sm:[&>button]:gap-1 max-sm:[&>button]:px-1 max-sm:[&>button]:py-2.5 max-sm:[&>button]:min-w-0 max-sm:[&>button]:whitespace-normal max-sm:[&>button]:text-center max-sm:[&>button]:text-xs max-sm:[&>button]:leading-tight max-sm:[&>button_svg]:!mr-0",
              )}
            >
              {actions}
              {primaryAction &&
                (primaryAction.disabled && primaryAction.disabledReason ? (
                  <Tooltip content={primaryAction.disabledReason}>
                    <span className="inline-block cursor-not-allowed max-md:hidden">
                      <span className="pointer-events-none inline-flex">
                        {renderPrimaryButton()}
                      </span>
                    </span>
                  </Tooltip>
                ) : (
                  renderPrimaryButton()
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Sibling of the header, not inside it — the header itself is hidden on
          phones for list pages, which would take the floating button with it. */}
      {primaryAction && (
        <PageFab
          label={primaryAction.label}
          onClick={primaryAction.onClick}
          icon={primaryAction.icon}
          disabled={primaryAction.disabled}
          disabledReason={primaryAction.disabledReason}
          testId={primaryAction.testId ? `${primaryAction.testId}-fab` : undefined}
        />
      )}
    </>
  );
}

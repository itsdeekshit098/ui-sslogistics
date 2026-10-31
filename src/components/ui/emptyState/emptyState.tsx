"use client";

import React from "react";
import { InboxIcon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EmptyStateProps } from "./emptyState.types";

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = InboxIcon,
  title,
  description,
  actionLabel,
  onAction,
  actionDisabled = false,
  className,
}) => {
  return (
    <div
      data-testid="empty-state"
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-4 max-md:p-8",
        className,
      )}
    >
      <div className="rounded-xl bg-muted p-4 mb-4 max-md:flex max-md:h-16 max-md:w-16 max-md:items-center max-md:justify-center max-md:rounded-[var(--m-radius-card)] max-md:bg-border max-md:p-0 max-md:[&_svg]:h-7 max-md:[&_svg]:w-7">
        <Icon size={32} style={{ color: "var(--muted-foreground)", opacity: 0.5 }} />
      </div>
      <h3
        data-testid="empty-state-title"
        className="text-lg font-semibold mb-1 max-md:mb-1.5 max-md:text-base"
      >
        {title}
      </h3>
      {description && (
        <p
          data-testid="empty-state-description"
          className="text-sm text-muted-foreground max-w-sm"
        >
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button
          data-testid="empty-state-action-btn"
          size="sm"
          className="mt-4 max-md:mt-5 max-md:h-12 max-md:w-full max-md:text-[15px] max-md:font-semibold"
          onClick={onAction}
          disabled={actionDisabled}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;

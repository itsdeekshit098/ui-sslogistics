"use client";

import React from "react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EmptyStateProps } from "./emptyState.types";

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
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
        "flex flex-col items-center justify-center text-center py-12 px-4",
        className,
      )}
    >
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <h3
        data-testid="empty-state-title"
        className="text-lg font-semibold mb-1"
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
          className="mt-4"
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

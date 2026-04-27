"use client";

import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ErrorStateProps } from "./errorState.types";

const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Something went wrong",
  description = "We couldn\u2019t load the data. Please check your connection and try again.",
  onRetry,
  retryLabel = "Try Again",
  retrying = false,
  className,
}) => {
  return (
    <div
      data-testid="error-state"
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-4",
        className,
      )}
    >
      <div className="rounded-full bg-red-50 dark:bg-red-900/20 p-4 mb-4">
        <AlertCircle className="h-8 w-8 text-red-500 dark:text-red-400" />
      </div>
      <h3
        data-testid="error-state-title"
        className="text-lg font-semibold mb-1"
      >
        {title}
      </h3>
      <p
        data-testid="error-state-description"
        className="text-sm text-muted-foreground max-w-sm"
      >
        {description}
      </p>
      {onRetry && (
        <Button
          data-testid="error-state-retry-btn"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={onRetry}
          disabled={retrying}
        >
          <RefreshCw
            className={cn("h-4 w-4 mr-2", retrying && "animate-spin")}
          />
          {retrying ? "Retrying..." : retryLabel}
        </Button>
      )}
    </div>
  );
};

export default ErrorState;

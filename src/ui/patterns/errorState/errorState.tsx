"use client";

import { AlertCircleIcon } from "../../icons";
import { Description, IconBox, RetryButton, RetryIcon, Root, Title } from "./errorState.styles";
import type { ErrorStateProps } from "./errorState.types";

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn’t load the data. Please check your connection and try again.",
  onRetry,
  retryLabel = "Try Again",
  retrying = false,
  className,
}: ErrorStateProps) {
  return (
    <Root data-testid="error-state" data-ui="error-state" className={className}>
      <IconBox>
        <AlertCircleIcon size={32} />
      </IconBox>
      <Title data-testid="error-state-title">{title}</Title>
      <Description data-testid="error-state-description">{description}</Description>
      {onRetry && (
        <RetryButton
          data-testid="error-state-retry-btn"
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={retrying}
        >
          <RetryIcon size={16} $spinning={retrying} />
          {retrying ? "Retrying..." : retryLabel}
        </RetryButton>
      )}
    </Root>
  );
}

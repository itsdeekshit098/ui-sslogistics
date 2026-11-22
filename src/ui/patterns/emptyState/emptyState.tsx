"use client";

import { InboxIcon } from "../../icons";
import { Action, Description, IconBox, Root, Title } from "./emptyState.styles";
import type { EmptyStateProps } from "./emptyState.types";

export function EmptyState({
  icon: Icon = InboxIcon,
  title,
  description,
  actionLabel,
  onAction,
  actionDisabled = false,
  className,
}: EmptyStateProps) {
  return (
    <Root data-testid="empty-state" data-ui="empty-state" className={className}>
      <IconBox>
        <Icon size={32} />
      </IconBox>
      <Title data-testid="empty-state-title">{title}</Title>
      {description && <Description data-testid="empty-state-description">{description}</Description>}
      {actionLabel && onAction && (
        <Action
          data-testid="empty-state-action-btn"
          data-ui="empty-state-action"
          size="sm"
          onClick={onAction}
          disabled={actionDisabled}
        >
          {actionLabel}
        </Action>
      )}
    </Root>
  );
}

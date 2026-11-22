"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { AlertCircleIcon, AlertTriangleIcon, CheckCircleIcon, XIcon } from "../../icons";
import type { Tone } from "../../styles/tone";
import { Actions, Body, Dismiss, IconSlot, Message, Root, Title } from "./alert.styles";
import type { AlertProps } from "./alert.types";

const DEFAULT_ICON: Record<Tone, ReactNode> = {
  neutral: <AlertCircleIcon size={16} />,
  primary: <AlertCircleIcon size={16} />,
  info: <AlertCircleIcon size={16} />,
  success: <CheckCircleIcon size={16} />,
  warning: <AlertTriangleIcon size={16} />,
  danger: <AlertCircleIcon size={16} />,
};

/**
 * An inline message about the state of the page or a form: a failed save, a
 * warning, a confirmation. Danger and warning use `role="alert"` so a screen
 * reader announces them as they appear; the rest use `role="status"`.
 */
export function Alert({
  tone = "info",
  title,
  icon,
  onDismiss,
  action,
  scrollIntoView = false,
  children,
  role,
  ...props
}: AlertProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollIntoView) rootRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [scrollIntoView, children]);

  const assertive = tone === "danger" || tone === "warning";
  const shownIcon = icon === undefined ? DEFAULT_ICON[tone] : icon;

  return (
    <Root ref={rootRef} data-ui="alert" role={role ?? (assertive ? "alert" : "status")} $tone={tone} {...props}>
      {shownIcon && <IconSlot aria-hidden="true">{shownIcon}</IconSlot>}
      <Body>
        {title && <Title>{title}</Title>}
        {children && <Message>{children}</Message>}
      </Body>
      {(action || onDismiss) && (
        <Actions>
          {action}
          {onDismiss && (
            <Dismiss type="button" aria-label="Dismiss" onClick={onDismiss}>
              <XIcon size={14} />
            </Dismiss>
          )}
        </Actions>
      )}
    </Root>
  );
}

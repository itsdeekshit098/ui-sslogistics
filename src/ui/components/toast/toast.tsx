"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { XIcon } from "../../icons";
import { ActionButton, Body, Close, Description, Item, Title, Viewport } from "./toast.styles";
import type { ToastApi, ToastOptions, ToastRecord } from "./toast.types";

const MAX_VISIBLE = 4;
const DEFAULT_MS = 5000;
const DANGER_MS = 8000;

const ToastContext = createContext<ToastApi | null>(null);

/** Shows short messages ("Saved", "Couldn't save") that fade on their own. Mount once, high in the tree. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((all) => all.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    counter.current += 1;
    const id = `toast-${counter.current}`;
    setToasts((all) => [...all, { ...options, id }].slice(-MAX_VISIBLE));
    return id;
  }, []);

  const dismissAll = useCallback(() => setToasts([]), []);
  const api = useMemo(() => ({ toast, dismiss, dismissAll }), [toast, dismiss, dismissAll]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <Viewport data-ui="toast-viewport" role="region" aria-label="Notifications" aria-live="polite">
            {toasts.map((t) => (
              <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
            ))}
          </Viewport>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastRecord; onDismiss: (id: string) => void }) {
  const { id, title, description, tone = "neutral", action } = toast;
  const duration = toast.duration ?? (tone === "danger" ? DANGER_MS : DEFAULT_MS);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(duration);
  const startedAt = useRef(0);

  // Count down, stopping while the pointer or focus is on the toast so it can be read.
  useEffect(() => {
    if (duration === 0 || paused) return;
    startedAt.current = Date.now();
    const timer = setTimeout(() => onDismiss(id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [duration, paused, id, onDismiss]);

  return (
    <Item
      data-ui="toast"
      role={tone === "danger" ? "alert" : "status"}
      $tone={tone}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Body>
        {title && <Title>{title}</Title>}
        {description && <Description>{description}</Description>}
      </Body>
      {action && (
        <ActionButton
          type="button"
          onClick={() => {
            action.onClick();
            onDismiss(id);
          }}
        >
          {action.label}
        </ActionButton>
      )}
      <Close type="button" aria-label="Dismiss" onClick={() => onDismiss(id)}>
        <XIcon size={14} />
      </Close>
    </Item>
  );
}

/** The toast functions. Must be used inside a `ToastProvider`. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside a <ToastProvider>");
  return api;
}

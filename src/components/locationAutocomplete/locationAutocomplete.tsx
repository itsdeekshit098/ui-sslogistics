"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LocationAutocompleteProps, LocationSuggestion } from "./locationAutocomplete.types";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 3;

const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({
  value,
  onChange,
  id,
  placeholder = "Search location...",
  disabled = false,
  invalid = false,
  className,
  "data-testid": dataTestId,
}) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (open && rootRef.current) {
      const updateRect = () => setDropdownRect(rootRef.current!.getBoundingClientRect());
      updateRect();
      window.addEventListener("scroll", updateRect, true);
      window.addEventListener("resize", updateRect);
      return () => {
        window.removeEventListener("scroll", updateRect, true);
        window.removeEventListener("resize", updateRect);
      };
    } else {
      const handle = requestAnimationFrame(() => setDropdownRect(null));
      return () => cancelAnimationFrame(handle);
    }
  }, [open]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        (rootRef.current && rootRef.current.contains(target)) ||
        (listboxRef.current && listboxRef.current.contains(target))
      ) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const fetchSuggestions = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      try {
        const res = await fetch(`/api/locations/autocomplete?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        if (requestId !== requestIdRef.current) return;
        const arr = json.data?.data ?? json.data;
        setSuggestions(Array.isArray(arr) ? arr : []);
      } catch {
        if (requestId === requestIdRef.current) setSuggestions([]);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const selectSuggestion = (suggestion: LocationSuggestion) => {
    onChange(suggestion.label);
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <Input
        ref={inputRef}
        id={inputId}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-invalid={invalid}
        autoComplete="off"
        disabled={disabled}
        data-testid={dataTestId}
        placeholder={placeholder}
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const nextValue = e.target.value;
          onChange(nextValue);
          setOpen(true);
          fetchSuggestions(nextValue);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
          }
        }}
        className={cn(invalid && "border-destructive focus-visible:ring-destructive")}
      />

      {open && !disabled && dropdownRect && (suggestions.length > 0 || loading) && createPortal(
        <div
          ref={listboxRef}
          role="listbox"
          style={{
            position: "fixed",
            left: dropdownRect.left,
            width: dropdownRect.width,
            top: dropdownRect.bottom + 6,
            maxHeight: 240,
          }}
          className="z-[9999] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-background p-1 text-sm text-foreground shadow-2xl drop-shadow-sm"
        >
          {loading ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">Searching...</div>
          ) : (
            suggestions.map((suggestion, index) => (
              <Button
                variant="ghost"
                key={`${suggestion.label}-${index}`}
                type="button"
                role="option"
                tabIndex={-1}
                className="flex min-h-11 w-full items-center gap-3 rounded-[calc(var(--input-radius)-1px)] px-3 py-2 text-left outline-none transition-colors h-auto justify-start font-normal"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectSuggestion(suggestion)}
              >
                <span className="min-w-0 flex-1 truncate">{suggestion.label}</span>
              </Button>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default LocationAutocomplete;

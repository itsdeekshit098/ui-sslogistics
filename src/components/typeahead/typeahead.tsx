"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TypeaheadProps } from "./typeahead.types";

const normalizeSearchText = (value: string): string =>
  value.trim().toLowerCase();

const compactSearchText = (value: string): string =>
  normalizeSearchText(value).replace(/\s+/g, "");

const Typeahead = <TOption,>({
  options,
  value,
  onValueChange,
  getOptionLabel,
  getOptionValue,
  getOptionDescription,
  getOptionKeywords,
  id,
  placeholder = "Search...",
  emptyMessage = "No results found.",
  disabled = false,
  invalid = false,
  className,
  inputClassName,
  clearable = true,
  "data-testid": dataTestId,
}: TypeaheadProps<TOption>) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listboxId = `${inputId}-listbox`;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const selectedOption = useMemo(
    () => options.find((option) => getOptionValue(option) === value) ?? null,
    [getOptionValue, options, value],
  );

  const selectedLabel = selectedOption ? getOptionLabel(selectedOption) : "";

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchText);
    const compactQuery = compactSearchText(searchText);

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => {
      const searchableText = [
        getOptionLabel(option),
        ...(getOptionKeywords?.(option) ?? []),
      ].join(" ");
      const normalizedText = normalizeSearchText(searchableText);
      const compactText = compactSearchText(searchableText);

      return (
        normalizedText.includes(normalizedQuery) ||
        compactText.includes(compactQuery)
      );
    });
  }, [getOptionKeywords, getOptionLabel, options, searchText]);

  const inputValue = open ? searchText : selectedLabel;
  const shouldShowClear = clearable && !disabled && Boolean(inputValue);
  const activeIndex =
    filteredOptions.length > 0
      ? Math.min(highlightedIndex, filteredOptions.length - 1)
      : -1;

  const selectOption = useCallback(
    (option: TOption) => {
      onValueChange(getOptionValue(option), option);
      setSearchText(getOptionLabel(option));
      setOpen(false);
      inputRef.current?.focus();
    },
    [getOptionLabel, getOptionValue, onValueChange],
  );

  const clearSelection = useCallback(() => {
    onValueChange("", null);
    setSearchText("");
    setHighlightedIndex(0);
    setOpen(false);
  }, [onValueChange]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (event.key === "Tab") {
      setOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlightedIndex((current) =>
        Math.min(current + 1, Math.max(filteredOptions.length - 1, 0)),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setHighlightedIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      if (!open || activeIndex < 0) return;
      event.preventDefault();
      selectOption(filteredOptions[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className={cn("relative w-full", className)}
      onBlur={(event) => {
        const nextFocusedElement = event.relatedTarget;
        if (
          nextFocusedElement instanceof Node &&
          rootRef.current?.contains(nextFocusedElement)
        ) {
          return;
        }
        setOpen(false);
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        id={inputId}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-invalid={invalid}
        aria-activedescendant={
          open && filteredOptions.length > 0
            ? `${inputId}-option-${activeIndex}`
            : undefined
        }
        autoComplete="off"
        disabled={disabled}
        data-testid={dataTestId}
        placeholder={placeholder}
        value={inputValue}
        onFocus={() => {
          setSearchText(selectedLabel);
          setHighlightedIndex(0);
          setOpen(true);
        }}
        onChange={(event) => {
          setSearchText(event.target.value);
          setHighlightedIndex(0);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          "h-[var(--input-height)] pl-9 pr-16",
          invalid && "border-red-500 focus-visible:ring-red-500",
          inputClassName,
        )}
      />
      {shouldShowClear && (
        <button
          type="button"
          aria-label="Clear selection"
          className="absolute right-8 top-1/2 z-10 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onMouseDown={(event) => event.preventDefault()}
          onClick={clearSelection}
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

      {open && !disabled && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-[calc(var(--input-radius)+4px)] border border-border bg-background p-1.5 text-sm text-foreground shadow-[0_24px_80px_-48px_rgba(15,23,42,0.32)]"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => {
              const optionValue = getOptionValue(option);
              const isSelected = optionValue === value;
              const isHighlighted = index === activeIndex;

              return (
                <button
                  key={optionValue}
                  id={`${inputId}-option-${index}`}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={isSelected}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 rounded-[calc(var(--input-radius)-1px)] px-3 py-2 text-left outline-none transition-colors",
                    isHighlighted && "bg-secondary text-foreground",
                    isSelected && "font-semibold",
                  )}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectOption(option)}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center text-primary">
                    {isSelected && <Check className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {getOptionLabel(option)}
                    </span>
                    {getOptionDescription && (
                      <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                        {getOptionDescription(option)}
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Typeahead;

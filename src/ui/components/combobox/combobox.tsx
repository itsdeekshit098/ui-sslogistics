"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { XIcon } from "../../icons";
import {
  ClearButton,
  Empty,
  Field,
  LeadingIcon,
  Listbox,
  Option,
  OptionDescription,
  OptionLabel,
  OptionText,
  Placement,
  Root,
  SelectedMark,
  TrailingIcon,
} from "./combobox.styles";
import type { ComboboxProps } from "./combobox.types";

const normalizeSearchText = (value: string): string =>
  value.trim().toLowerCase();

const compactSearchText = (value: string): string =>
  normalizeSearchText(value).replace(/\s+/g, "");

const Combobox = <TOption,>({
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
  footer,
  "data-testid": dataTestId,
}: ComboboxProps<TOption>) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listboxId = `${inputId}-listbox`;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const clearingRef = useRef(false);
  const programmaticFocusRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const selectedOption = useMemo(
    () => options.find((option) => getOptionValue(option) === value) ?? null,
    [getOptionValue, options, value],
  );

  const selectedLabel = selectedOption ? getOptionLabel(selectedOption) : "";

  const listboxRef = useRef<HTMLDivElement | null>(null);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (open && rootRef.current) {
      const measure = () => {
        const next = rootRef.current?.getBoundingClientRect();
        if (!next) return;
        // Keep the same object when nothing moved, so an unrelated scroll doesn't re-render the list.
        setDropdownRect((prev) =>
          prev &&
          prev.left === next.left &&
          prev.top === next.top &&
          prev.width === next.width &&
          prev.height === next.height
            ? prev
            : next,
        );
      };
      measure();

      // Scroll and resize events arrive many times per frame; measure once per frame.
      let frame = 0;
      const updateRect = (event?: Event) => {
        // The list scrolling inside itself doesn't move the field.
        if (event && listboxRef.current?.contains(event.target as Node)) return;
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          measure();
        });
      };
      window.addEventListener("scroll", updateRect, true);
      window.addEventListener("resize", updateRect);

      // On mobile, listen to visualViewport changes (keyboard open/close)
      const vv = window.visualViewport;
      if (vv) {
        vv.addEventListener("resize", updateRect);
        vv.addEventListener("scroll", updateRect);
      }

      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("scroll", updateRect, true);
        window.removeEventListener("resize", updateRect);
        if (vv) {
          vv.removeEventListener("resize", updateRect);
          vv.removeEventListener("scroll", updateRect);
        }
      };
    } else {
      const handle = requestAnimationFrame(() => setDropdownRect(null));
      return () => cancelAnimationFrame(handle);
    }
  }, [open]);

  // On a phone the keyboard eats half the screen, so a field left mid-form has
  // a sliver of room either side for its options. Once the keyboard has slid
  // up, scroll the field to the top of its container (keeping the label in
  // view via scroll-margin) so the list drops into the space beneath it.
  useEffect(() => {
    if (!open || !window.matchMedia("(pointer: coarse)").matches) return;
    const timer = window.setTimeout(() => {
      rootRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 300);
    return () => window.clearTimeout(timer);
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
      if (document.activeElement !== inputRef.current) {
        programmaticFocusRef.current = true;
        inputRef.current?.focus();
      }
    },
    [getOptionLabel, getOptionValue, onValueChange],
  );

  const clearSelection = useCallback(() => {
    onValueChange("", null);
    setSearchText("");
    setHighlightedIndex(0);
    setOpen(true);

    // Only set the clearing flag and trigger focus if the input isn't already focused.
    // This prevents clearingRef from getting "stuck" if onFocus doesn't fire.
    if (document.activeElement !== inputRef.current) {
      clearingRef.current = true;
      inputRef.current?.focus();
    }
  }, [onValueChange]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (event.key === "Tab") {
      setOpen(false);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        // The first press only opens the list, on the first option, whatever was highlighted last time.
        setSearchText(selectedLabel);
        setHighlightedIndex(0);
        setOpen(true);
        return;
      }
      setHighlightedIndex((current) =>
        event.key === "ArrowDown"
          ? Math.min(current + 1, Math.max(filteredOptions.length - 1, 0))
          : Math.max(current - 1, 0),
      );
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

  /**
   * Where the list sits. Trigger rect and `position: fixed` are both in
   * layout-viewport coordinates, but with the iOS keyboard up only the visual
   * viewport is on screen — and it's usually scrolled down inside the layout
   * one (offsetTop). Measuring free space against the visual viewport without
   * that offset made the list flip upward and land on top of its own input.
   */
  const placement = (rect: DOMRect): Placement => {
    const vv = window.visualViewport;
    const visibleTop = vv?.offsetTop ?? 0;
    const visibleBottom = visibleTop + (vv?.height ?? window.innerHeight);
    const spaceBelow = visibleBottom - rect.bottom - 8;
    const spaceAbove = rect.top - visibleTop - 8;
    if (spaceBelow < 160 && spaceAbove > spaceBelow) {
      // Open upward — anchor bottom to the top of the trigger
      return {
        left: rect.left,
        width: rect.width,
        bottom: document.documentElement.clientHeight - rect.top + 6,
        maxHeight: Math.max(spaceAbove - 6, 120),
      };
    }
    // Open downward — stop at the top of the keyboard
    return {
      left: rect.left,
      width: rect.width,
      top: rect.bottom + 6,
      maxHeight: Math.max(spaceBelow - 6, 120),
    };
  };

  return (
    <Root
      data-ui="combobox"
      ref={rootRef}
      className={className}
      onBlur={(event) => {
        const nextFocusedElement = event.relatedTarget;
        if (
          nextFocusedElement instanceof Node &&
          (rootRef.current?.contains(nextFocusedElement) ||
            listboxRef.current?.contains(nextFocusedElement))
        ) {
          return;
        }
        setOpen(false);
      }}
    >
      <LeadingIcon size={16} />
      <Field
        ref={inputRef}
        id={inputId}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-invalid={invalid}
        aria-activedescendant={
          open && filteredOptions.length > 0 ? `${inputId}-option-${activeIndex}` : undefined
        }
        autoComplete="off"
        disabled={disabled}
        data-testid={dataTestId}
        placeholder={placeholder}
        value={inputValue}
        onFocus={() => {
          if (clearingRef.current) {
            clearingRef.current = false;
            return;
          }
          if (programmaticFocusRef.current) {
            programmaticFocusRef.current = false;
            return;
          }
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
        className={inputClassName}
        $invalid={!!invalid}
      />
      {shouldShowClear && (
        <ClearButton
          variant="ghost"
          type="button"
          aria-label="Clear selection"
          onMouseDown={(event) => event.preventDefault()}
          onClick={clearSelection}
        >
          <XIcon size={16} />
        </ClearButton>
      )}
      <TrailingIcon size={16} />

      {open &&
        !disabled &&
        dropdownRect &&
        createPortal(
          <Listbox
            data-ui="combobox-listbox"
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            $placement={placement(dropdownRect)}
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => {
                const optionValue = getOptionValue(option);
                const isSelected = optionValue === value;
                const isHighlighted = index === activeIndex;

                return (
                  <Option
                    variant="ghost"
                    key={optionValue}
                    id={`${inputId}-option-${index}`}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={isSelected}
                    $highlighted={isHighlighted}
                    $selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectOption(option)}
                  >
                    <OptionText>
                      <OptionLabel>{getOptionLabel(option)}</OptionLabel>
                      {getOptionDescription && (
                        <OptionDescription>{getOptionDescription(option)}</OptionDescription>
                      )}
                    </OptionText>
                    {/* On the right, as in the Select dropdown. It used to sit
                        in a reserved slot on the left of every row, which left
                        a blank gutter on all the options that weren't selected. */}
                    {isSelected && <SelectedMark size={16} />}
                  </Option>
                );
              })
            ) : (
              <Empty>{emptyMessage}</Empty>
            )}
            {footer}
          </Listbox>,
          document.body,
        )}
    </Root>
  );
};

export { Combobox };
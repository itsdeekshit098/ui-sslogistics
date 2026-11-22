"use client";

import { Fragment, useCallback, useRef, useState, type KeyboardEvent } from "react";
import { BottomSheet } from "../bottomSheet";
import { Popover } from "../popover";
import { useIsMobile } from "../../hooks/useIsMobile";
import { Divider, IconSlot, Item, Label, List, Reason } from "./menu.styles";
import type { MenuItem, MenuProps } from "./menu.types";

/**
 * A menu of actions opened from a button (the "⋯" on a row). On a phone it
 * opens as a bottom sheet with thumb-sized rows; elsewhere as a popover with
 * the WAI-ARIA menu keyboard model: arrows move between items (skipping
 * disabled ones), Home/End jump, Enter/Space choose, Escape closes and returns
 * focus to the button, Tab closes.
 */
export function Menu({ trigger, items, label, placement = "bottom-end" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const isMobile = useIsMobile();
  const listRef = useRef<HTMLDivElement>(null);

  const itemNodes = () =>
    Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);

  // Move focus to the first item as the list mounts (the popover mounts it
  // after measuring, so an effect on `open` would run too early). On a phone
  // the sheet takes focus itself.
  const attachList = useCallback(
    (node: HTMLDivElement | null) => {
      listRef.current = node;
      if (node && !isMobile) {
        node.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
      }
    },
    [isMobile],
  );

  const choose = useCallback((item: MenuItem) => {
    setOpen(false);
    anchor?.focus?.({ preventScroll: true });
    item.onSelect();
  }, [anchor]);

  const move = (event: KeyboardEvent) => {
    const nodes = itemNodes();
    if (nodes.length === 0) return;
    const index = nodes.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | null = null;
    switch (event.key) {
      case "ArrowDown":
        next = (index + 1) % nodes.length;
        break;
      case "ArrowUp":
        next = (index - 1 + nodes.length) % nodes.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = nodes.length - 1;
        break;
      case "Tab":
        setOpen(false);
        return;
      default:
        return;
    }
    event.preventDefault();
    nodes[next]?.focus();
  };

  const list = (
    <List ref={attachList} role="menu" aria-label={label} onKeyDown={move}>
      {items.map((item) => (
        <Fragment key={item.key}>
          {item.separatorBefore && <Divider role="separator" />}
          <Item
            type="button"
            role="menuitem"
            disabled={item.disabled}
            $danger={item.tone === "danger"}
            onClick={() => choose(item)}
          >
            {item.icon && <IconSlot aria-hidden="true">{item.icon}</IconSlot>}
            <Label>
              {item.label}
              {item.disabled && item.disabledReason && <Reason>{item.disabledReason}</Reason>}
            </Label>
          </Item>
        </Fragment>
      ))}
    </List>
  );

  return (
    <>
      {trigger({
        ref: setAnchor,
        onClick: () => setOpen((o) => !o),
        onKeyDown: (event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        },
        "aria-haspopup": "menu",
        "aria-expanded": open,
      })}
      {isMobile ? (
        <BottomSheet open={open} onClose={() => setOpen(false)} title={label}>
          {list}
        </BottomSheet>
      ) : (
        <Popover open={open} onOpenChange={setOpen} anchor={anchor} placement={placement} role="presentation">
          {list}
        </Popover>
      )}
    </>
  );
}

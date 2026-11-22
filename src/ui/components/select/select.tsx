"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon as ChevronDown, ChevronUpIcon as ChevronUp } from "../../icons";
import {
  Content,
  IndicatorSlot,
  Item,
  Label,
  ScrollDown,
  ScrollUp,
  Separator,
  Trigger,
  TriggerChevron,
  Viewport,
} from "./select.styles";

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = forwardRef<
  ElementRef<typeof SelectPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ children, ...props }, ref) => (
  <Trigger ref={ref} data-ui="select-trigger" {...props}>
    {children}
    <SelectPrimitive.Icon asChild>
      <TriggerChevron size={16} />
    </SelectPrimitive.Icon>
  </Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = forwardRef<
  ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>((props, ref) => (
  <ScrollUp ref={ref} {...props}>
    <ChevronUp size={16} />
  </ScrollUp>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = forwardRef<
  ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>((props, ref) => (
  <ScrollDown ref={ref} {...props}>
    <ChevronDown size={16} />
  </ScrollDown>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = forwardRef<
  ElementRef<typeof SelectPrimitive.Content>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content> & {
    /**
     * Tighter spacing around the options, for a small few-item popover where
     * the default 4px inset reads as a loose gap rather than breathing room.
     */
    compact?: boolean;
    /** Pins the popover to the trigger's own width (not just a minimum). */
    matchTriggerWidth?: boolean;
  }
>(({ children, position = "popper", compact = false, matchTriggerWidth = false, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <Content
      ref={ref}
      data-ui="select-content"
      collisionPadding={16}
      position={position}
      sideOffset={8}
      $position={position}
      $matchTriggerWidth={matchTriggerWidth}
      {...props}
    >
      <SelectScrollUpButton />
      <Viewport $position={position} $compact={compact}>
        {children}
      </Viewport>
      <SelectScrollDownButton />
    </Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = forwardRef<
  ElementRef<typeof SelectPrimitive.Label>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>((props, ref) => <Label ref={ref} {...props} />);
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = forwardRef<
  ElementRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & {
    /**
     * Drops the checkmark, relying on the checked background/weight alone —
     * for short, self-explanatory option lists (e.g. a page-size picker) where
     * a checkmark plus its reserved gutter just adds width for no real gain in
     * clarity. Off by default; every other dropdown keeps the checkmark.
     */
    hideIndicator?: boolean;
    /** Inset a little from the popover edge, to sit with `SelectContent compact`. */
    compact?: boolean;
  }
>(({ children, hideIndicator = false, compact = false, ...props }, ref) => (
  <Item ref={ref} data-ui="select-item" $hideIndicator={hideIndicator} $compact={compact} {...props}>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    {!hideIndicator && (
      <IndicatorSlot>
        <SelectPrimitive.ItemIndicator>
          <CheckIcon size={16} />
        </SelectPrimitive.ItemIndicator>
      </IndicatorSlot>
    )}
  </Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = forwardRef<
  ElementRef<typeof SelectPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>((props, ref) => <Separator ref={ref} {...props} />);
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};

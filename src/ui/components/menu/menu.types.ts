import type { ReactNode, Ref } from "react";
import type { Placement } from "../../hooks/usePopoverPosition";

export interface MenuItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  /** `danger` colours the item red, for a destructive action. */
  tone?: "default" | "danger";
  disabled?: boolean;
  /** Why it is disabled, shown under the label. */
  disabledReason?: string;
  /** Draws a divider above this item. */
  separatorBefore?: boolean;
}

/** What the trigger must spread onto the element that opens the menu. */
export interface MenuTriggerProps {
  ref: Ref<HTMLElement>;
  onClick: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
}

export interface MenuProps {
  /** Renders the opening control, e.g. `(props) => <Button {...props}>⋯</Button>`. */
  trigger: (props: MenuTriggerProps) => ReactNode;
  items: MenuItem[];
  /** Names the menu for assistive technology, and titles the phone sheet. */
  label: string;
  placement?: Placement;
}

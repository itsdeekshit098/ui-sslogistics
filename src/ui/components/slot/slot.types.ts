import type { HTMLAttributes, ReactNode, Ref } from "react";

export interface SlotProps extends HTMLAttributes<HTMLElement> {
  /** The one element that receives this component's props. */
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
}

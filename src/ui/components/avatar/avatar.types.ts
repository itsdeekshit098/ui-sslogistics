import type { HTMLAttributes } from "react";

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  /** The person's or entity's name: gives the initials and the accessible label. */
  name: string;
  /** A photo. If it fails to load, the initials show instead. */
  src?: string | null;
  size?: "sm" | "md" | "lg";
}
